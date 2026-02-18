/**
 * alias-generator.ts
 *
 * Uses Claude (claude-sonnet) to analyze a list of raw ingredient name strings
 * and group them into canonical clusters. Each cluster identifies a single
 * grocery item and all the name variants that refer to it.
 *
 * This is a one-time analysis tool, not a runtime normalization step.
 * Results are reviewed by the user and then committed to ingredient-aliases.ts.
 *
 * SERVER-SIDE ONLY — requires ANTHROPIC_API_KEY environment variable.
 */

export interface IngredientCluster {
  canonical: string;
  variants: string[];
}

const BATCH_SIZE = 150; // ingredient names per Claude call

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
   - "dried cranberries" ≠ "cranberries" — these can be grouped together since you'd buy dried

3. Canonical name rules:
   - Use singular form ("chicken breast" not "chicken breasts")
   - No preparation method in canonical ("garlic" not "minced garlic")
   - Minimal but specific ("chicken breast" not just "chicken" when all variants specify breast)
   - Keep it as it would appear on a grocery list

4. Only group items you are highly confident are the same grocery item.
   When uncertain, leave items as their own single-item cluster.

5. Do NOT create clusters for:
   - Single items that have no variants in the list
   - Items where any grouping would be ambiguous

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
[
  { "canonical": "garlic", "variants": ["garlic clove", "minced garlic", "garlic cloves", "garlic clove, thinly sliced"] },
  { "canonical": "chicken breast", "variants": ["chicken breast", "chicken breasts", "boneless skinless chicken breast"] }
]

Only include clusters with 2 or more variants. Do not include single-item clusters.`;

async function callClaude(ingredientNames: string[]): Promise<IngredientCluster[]> {
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
      model: 'claude-sonnet-4-5',
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

  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '';

  // Parse JSON from Claude's response
  // Strip any accidental markdown fences
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is IngredientCluster =>
        typeof item.canonical === 'string' &&
        Array.isArray(item.variants) &&
        item.variants.length >= 2
    );
  } catch {
    console.error('Failed to parse Claude response as JSON:', jsonText.slice(0, 500));
    return [];
  }
}

/**
 * Analyze a list of ingredient name strings and return clusters of variants
 * that should be treated as the same grocery item.
 *
 * Processes in batches of BATCH_SIZE to stay within API limits.
 * Deduplicates any variant that appears in multiple clusters (first cluster wins).
 *
 * @param ingredientNames - Unique raw ingredient name strings to analyze
 * @returns Array of clusters, each with a canonical name and its variants
 */
export async function generateIngredientClusters(
  ingredientNames: string[]
): Promise<IngredientCluster[]> {
  if (ingredientNames.length === 0) return [];

  const allClusters: IngredientCluster[] = [];

  // Process in batches
  for (let i = 0; i < ingredientNames.length; i += BATCH_SIZE) {
    const batch = ingredientNames.slice(i, i + BATCH_SIZE);
    try {
      const batchClusters = await callClaude(batch);
      allClusters.push(...batchClusters);
    } catch (err) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err);
      // Continue with other batches — partial results are still useful
    }
  }

  // Deduplicate: if a variant appears in multiple clusters, keep only the first occurrence
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

  // Sort clusters alphabetically by canonical name for consistent display
  return deduplicated.sort((a, b) =>
    a.canonical.toLowerCase().localeCompare(b.canonical.toLowerCase())
  );
}
