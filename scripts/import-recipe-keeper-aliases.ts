#!/usr/bin/env tsx
/**
 * import-recipe-keeper-aliases.ts
 *
 * One-time script: parse a Recipe Keeper HTML export, extract all unique
 * ingredient names, send them through Claude in batches to find canonical
 * clusters, then append the new alias entries to ingredient-aliases.ts.
 *
 * Usage:
 *   npx tsx scripts/import-recipe-keeper-aliases.ts <path-to-recipes.html>
 *
 * Requires ANTHROPIC_API_KEY in .env or environment.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { config } from 'dotenv';

// Explicitly load .env from the project root (two levels up from scripts/)
const envPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.env');
config({ path: envPath });

// ── Types ─────────────────────────────────────────────────────────────────────

interface IngredientCluster {
  canonical: string;
  variants: string[];
}

// ── HTML parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a Recipe Keeper HTML export.
 *
 * Recipe Keeper structure (actual):
 *   <div class="recipe-ingredients" itemprop="recipeIngredients">
 *     <p>Section header (no bullet)</p>
 *     <p>• 2 tbsp extra virgin olive oil  </p>
 *     <p>• ¾ tsp kosher salt  </p>
 *   </div>
 *
 * Bullet character is •  (U+2022) or sometimes a plain dash.
 * Lines without a bullet are section headers (e.g. "Roasted Sweet Potato")
 * and should be skipped.
 */
function parseRecipeKeeperHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const rawLines: string[] = [];

  // Primary strategy: <div class="recipe-ingredients"> containing <p> tags
  $('div.recipe-ingredients, [itemprop="recipeIngredients"]').each((_, container) => {
    $(container).find('p').each((_, p) => {
      const text = $(p).text().trim();
      // Skip empty lines and section-header lines (no bullet)
      if (!text) return;
      // Remove the leading bullet and whitespace
      const stripped = text.replace(/^[•\-–—]\s*/, '').trim();
      if (stripped) rawLines.push(stripped);
    });
  });

  // Fallback: schema.org itemprop="recipeIngredient" (singular) on individual elements
  if (rawLines.length === 0) {
    $('[itemprop="recipeIngredient"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) rawLines.push(text);
    });
  }

  console.log(`  Extracted ${rawLines.length} raw ingredient lines from HTML`);

  // Parse each line: strip leading quantity + unit to get just the name
  const names: string[] = [];
  for (const line of rawLines) {
    const name = extractIngredientName(line);
    if (name && name.length >= 2) {
      names.push(name);
    }
  }

  // Deduplicate case-insensitively
  const seen = new Map<string, string>();
  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (!seen.has(key)) seen.set(key, name);
  }

  const unique = Array.from(seen.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  console.log(`  ${unique.length} unique ingredient names after deduplication`);
  return unique;
}

/**
 * Extract the ingredient name from a raw line like:
 *   "2 tbsp extra virgin olive oil"  →  "extra virgin olive oil"
 *   "¾ tsp kosher salt"              →  "kosher salt"
 *   "8 large eggs"                   →  "large eggs"
 *   "salt and pepper"                →  "salt and pepper"
 *
 * Handles:
 *   - Unicode fractions (¼ ½ ¾ ⅓ ⅔ ⅛ ⅜ ⅝ ⅞)
 *   - ASCII fractions (1/2, 3/4)
 *   - Mixed numbers (1 1/2)
 *   - Decimal numbers (0.5)
 */
function extractIngredientName(line: string): string {
  // Normalise unicode fractions to ASCII so the regex works uniformly
  const normalised = line
    .replace(/¼/g, '1/4')
    .replace(/½/g, '1/2')
    .replace(/¾/g, '3/4')
    .replace(/⅓/g, '1/3')
    .replace(/⅔/g, '2/3')
    .replace(/⅛/g, '1/8')
    .replace(/⅜/g, '3/8')
    .replace(/⅝/g, '5/8')
    .replace(/⅞/g, '7/8')
    .trim();

  const UNITS = new Set([
    'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons',
    'tsp', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces',
    'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams',
    'kg', 'ml', 'l', 'liter', 'liters', 'quart', 'quarts',
    'pint', 'pints', 'gallon', 'gallons', 'bunch', 'bunches',
    'clove', 'cloves', 'head', 'heads', 'stalk', 'stalks',
    'slice', 'slices', 'can', 'cans', 'package', 'packages',
    'pkg', 'bag', 'bags', 'pinch', 'pinches', 'handful', 'handfuls',
    'piece', 'pieces', 'sprig', 'sprigs', 'jar', 'jars',
    'bottle', 'bottles', 'block', 'blocks', 'sheet', 'sheets',
  ]);

  // Pattern: optional leading number (including mixed fractions), optional unit, rest = name
  const match = normalised.match(
    /^(\d+(?:[/.]\d+)?(?:\s+\d+\/\d+)?)\s+([a-zA-Z]+)\s+(.+)$/
  );
  if (match) {
    const [, , maybeUnit, rest] = match;
    if (UNITS.has(maybeUnit.toLowerCase())) {
      return rest.trim();
    }
    // Unit token not recognised — treat second word as part of name
    return `${maybeUnit} ${rest}`.trim();
  }

  // Just a number at the start
  const numOnly = normalised.match(/^(\d+(?:[/.]\d+)?)\s+(.+)$/);
  if (numOnly) {
    return numOnly[2].trim();
  }

  return normalised;
}

// ── Claude batching ───────────────────────────────────────────────────────────

const BATCH_SIZE = 150;

const SYSTEM_PROMPT = `You are an expert at analyzing recipe ingredient lists for a professional meal prep chef. Your task is to group ingredient name variants that refer to the same grocery item.

Rules for grouping:
1. Preparation descriptors do NOT make ingredients different grocery items:
   - "garlic clove, thinly sliced", "minced garlic", "garlic cloves" → all mean "garlic"
   - "fresh basil", "basil leaves" → both mean "basil"
   - "mustard greens, chopped" → "mustard greens"
   - "chicken breast, pounded thin" → "chicken breast"

2. Form/product changes DO make them different items (keep separate):
   - "ground beef" ≠ "beef" (different product)
   - "garlic powder" ≠ "garlic" (different product)
   - "cream cheese" ≠ "cream" (different product)
   - "tomato paste" ≠ "tomato" (different product)
   - "dried cranberries" can be grouped with "cranberries" since you'd always buy dried

3. Canonical name rules:
   - Use singular form ("chicken breast" not "chicken breasts")
   - No preparation method in canonical ("garlic" not "minced garlic")
   - Minimal but specific ("chicken breast" not just "chicken" when all variants specify breast)
   - Keep it as it would appear on a grocery list

4. Only group items you are highly confident are the same grocery item.
   When uncertain, leave items as their own single-item cluster.

5. Do NOT create clusters for single items with no variants in the list.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
[
  { "canonical": "garlic", "variants": ["garlic clove", "minced garlic", "garlic cloves", "garlic clove, thinly sliced"] },
  { "canonical": "chicken breast", "variants": ["chicken breast", "chicken breasts", "boneless skinless chicken breast"] }
]

Only include clusters with 2 or more variants. Do not include single-item clusters.`;

async function callClaude(ingredientNames: string[], batchNum: number): Promise<IngredientCluster[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const nameList = ingredientNames.map((n, i) => `${i + 1}. ${n}`).join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here are ${ingredientNames.length} ingredient names from my recipe collection. Group the variants that refer to the same grocery item:\n\n${nameList}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as { content?: Array<{ text: string }> };
  const text: string = data?.content?.[0]?.text ?? '';

  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as IngredientCluster[]).filter(
      (item): item is IngredientCluster =>
        typeof item.canonical === 'string' &&
        Array.isArray(item.variants) &&
        item.variants.length >= 2
    );
  } catch {
    console.error(`  Batch ${batchNum}: Failed to parse JSON response`);
    console.error('  First 500 chars:', jsonText.slice(0, 500));
    return [];
  }
}

async function generateClusters(names: string[]): Promise<IngredientCluster[]> {
  const allClusters: IngredientCluster[] = [];
  const totalBatches = Math.ceil(names.length / BATCH_SIZE);

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = names.slice(i, i + BATCH_SIZE);
    console.log(`  Batch ${batchNum}/${totalBatches}: ${batch.length} ingredients...`);

    try {
      const clusters = await callClaude(batch, batchNum);
      console.log(`    → ${clusters.length} clusters found`);
      allClusters.push(...clusters);
    } catch (err) {
      console.error(`    Batch ${batchNum} failed:`, err);
    }

    // Small delay between batches to be nice to the API
    if (i + BATCH_SIZE < names.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Deduplicate: first cluster wins for each variant
  const seenVariants = new Set<string>();
  const deduplicated: IngredientCluster[] = [];

  for (const cluster of allClusters) {
    const uniqueVariants = cluster.variants.filter((v) => {
      const key = v.toLowerCase().trim();
      if (seenVariants.has(key)) return false;
      seenVariants.add(key);
      return true;
    });
    if (uniqueVariants.length >= 2) {
      deduplicated.push({ canonical: cluster.canonical, variants: uniqueVariants });
    }
  }

  return deduplicated.sort((a, b) =>
    a.canonical.toLowerCase().localeCompare(b.canonical.toLowerCase())
  );
}

// ── Alias file writer ─────────────────────────────────────────────────────────

function writeAliasesToFile(clusters: IngredientCluster[], aliasFilePath: string): {
  added: number;
  skipped: number;
} {
  const currentContent = fs.readFileSync(aliasFilePath, 'utf8');

  // Parse existing keys so we don't add duplicates
  const existingKeys = new Set<string>();
  const keyMatches = currentContent.matchAll(/\['([^']+)'/g);
  for (const m of keyMatches) {
    existingKeys.add(m[1].toLowerCase().trim());
  }

  let added = 0;
  let skipped = 0;
  const newSections: string[] = [];

  for (const cluster of clusters) {
    const entries: string[] = [];

    for (const variant of cluster.variants) {
      const key = variant.toLowerCase().trim();
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      const escapedKey = key.replace(/'/g, "\\'");
      const escapedCanonical = cluster.canonical.toLowerCase().replace(/'/g, "\\'");
      entries.push(`  ['${escapedKey}', '${escapedCanonical}'],`);
      existingKeys.add(key);
      added++;
    }

    if (entries.length > 0) {
      const sectionHeader = `\n  // ── ${cluster.canonical} (from Recipe Keeper import) ${'─'.repeat(Math.max(0, 40 - cluster.canonical.length))}`;
      newSections.push(sectionHeader + '\n' + entries.join('\n'));
    }
  }

  if (newSections.length === 0) {
    return { added: 0, skipped };
  }

  // Append before the closing ]);
  const insertPoint = currentContent.lastIndexOf(']);');
  if (insertPoint === -1) {
    throw new Error('Could not find closing ]); in alias file');
  }

  const newContent =
    currentContent.slice(0, insertPoint) +
    newSections.join('\n') +
    '\n' +
    currentContent.slice(insertPoint);

  fs.writeFileSync(aliasFilePath, newContent, 'utf8');
  return { added, skipped };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const htmlPath = process.argv[2];
  if (!htmlPath) {
    console.error('Usage: npx tsx scripts/import-recipe-keeper-aliases.ts <path-to-recipes.html>');
    process.exit(1);
  }

  if (!fs.existsSync(htmlPath)) {
    console.error(`File not found: ${htmlPath}`);
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Make sure .env is present.');
    process.exit(1);
  }

  const aliasFilePath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../src/lib/ingredient-aliases.ts'
  );

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' Recipe Keeper → Alias Table Importer');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Parse HTML
  console.log('Step 1: Parsing HTML file...');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const ingredientNames = parseRecipeKeeperHtml(html);

  if (ingredientNames.length === 0) {
    console.error('No ingredients found. Check the HTML file format.');
    process.exit(1);
  }

  console.log(`\nStep 2: Sending ${ingredientNames.length} ingredients to Claude for clustering...`);
  const clusters = await generateClusters(ingredientNames);
  console.log(`\n  Total clusters found: ${clusters.length}`);

  // Step 3: Write to alias file
  console.log('\nStep 3: Writing new aliases to ingredient-aliases.ts...');
  const { added, skipped } = writeAliasesToFile(clusters, aliasFilePath);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(` Done!`);
  console.log(`   ${added} new alias entries added`);
  console.log(`   ${skipped} entries skipped (already existed)`);
  console.log(`   ${clusters.length} clusters processed`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
