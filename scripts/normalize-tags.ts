/**
 * One-time script to normalize recipe tags against the standard vocabulary.
 *
 * Tags in the database may have been entered as free text (e.g. "dairy-free",
 * "no gluten", "Nuts") before the form was locked to the COMMON_EXCLUSIONS
 * vocabulary. This script canonicalizes them so the menu engine's restriction
 * matching works correctly.
 *
 * Normalization rules (mirrors canonicalizeRestriction in restriction-utils.ts):
 *   - Lowercase
 *   - Strip qualifier words: no, free, avoid, without
 *   - Replace hyphens/underscores with spaces
 *   - Collapse whitespace
 *   - Trim
 *
 * If the result matches a value in COMMON_EXCLUSIONS, the tag is updated.
 * Tags that cannot be mapped are listed as UNRESOLVED and left untouched.
 *
 * Usage (dry run — shows what would change, makes no DB changes):
 *   DATABASE_URL=<url> npx tsx scripts/normalize-tags.ts
 *
 * Apply changes:
 *   DATABASE_URL=<url> npx tsx scripts/normalize-tags.ts --apply
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const COMMON_EXCLUSIONS: string[] = [
  'dairy', 'gluten', 'nuts', 'soy', 'eggs', 'beef', 'pork', 'shellfish',
  'cilantro', 'mushrooms', 'olives', 'eggplant', 'spinach', 'beets',
  'artichokes', 'cherries', 'coffee', 'corn', 'cornstarch',
  'white sugar', 'honey', 'maple syrup', 'agave',
  'fermented foods', 'processed ingredients', 'white flour', 'white rice',
  'cod', 'salmon', 'shrimp',
];

function canonicalize(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/\b(no|free|avoid|without)\b/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveTag(raw: string): string | null {
  // Already in vocabulary — no change needed
  if (COMMON_EXCLUSIONS.includes(raw)) return raw;

  const canon = canonicalize(raw);

  // Direct match after canonicalization
  if (COMMON_EXCLUSIONS.includes(canon)) return canon;

  // Check if the canonicalized form is a substring of a vocabulary entry, or vice versa
  // (handles cases like "nut" → "nuts" or "gluten free" → "gluten")
  const match = COMMON_EXCLUSIONS.find(
    (v) => v === canon || v.startsWith(canon + ' ') || canon.startsWith(v + ' ') || canon.startsWith(v)
  );
  if (match) return match;

  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    // Get all distinct tags currently in the database
    const rows = await prisma.recipeTag.findMany({
      select: { tag: true },
      distinct: ['tag'],
      orderBy: { tag: 'asc' },
    });

    const allTags = rows.map((r) => r.tag);
    console.log(`\nFound ${allTags.length} distinct tags in database.\n`);

    const toUpdate: { from: string; to: string }[] = [];
    const alreadyGood: string[] = [];
    const unresolved: string[] = [];

    for (const tag of allTags) {
      const resolved = resolveTag(tag);
      if (resolved === null) {
        unresolved.push(tag);
      } else if (resolved === tag) {
        alreadyGood.push(tag);
      } else {
        toUpdate.push({ from: tag, to: resolved });
      }
    }

    // Report
    if (alreadyGood.length > 0) {
      console.log(`✓ Already correct (${alreadyGood.length}):`);
      alreadyGood.forEach((t) => console.log(`    ${t}`));
      console.log('');
    }

    if (toUpdate.length > 0) {
      console.log(`→ Will normalize (${toUpdate.length}):`);
      toUpdate.forEach(({ from, to }) => console.log(`    "${from}"  →  "${to}"`));
      console.log('');
    } else {
      console.log('No tags need normalization.\n');
    }

    if (unresolved.length > 0) {
      console.log(`⚠ Cannot resolve (${unresolved.length}) — leaving untouched:`);
      unresolved.forEach((t) => console.log(`    "${t}"`));
      console.log('  → Add these to COMMON_EXCLUSIONS in src/lib/types.ts if they should be standard tags.\n');
    }

    if (toUpdate.length === 0) {
      console.log('Nothing to do. All tags are already in the standard vocabulary.');
      return;
    }

    if (!apply) {
      console.log('DRY RUN — no changes made. Re-run with --apply to apply the changes above.');
      return;
    }

    // Apply updates: for each changed tag, update all rows with that tag value.
    // We need to handle the unique constraint on (recipeId, tag): if a recipe already
    // has the target tag, we delete the duplicate source row instead of updating it.
    console.log('Applying changes...\n');
    let updated = 0;
    let deleted = 0;

    for (const { from, to } of toUpdate) {
      // Get all rows with the old tag value
      const staleRows = await prisma.recipeTag.findMany({
        where: { tag: from },
        select: { id: true, recipeId: true },
      });

      for (const row of staleRows) {
        // Check if this recipe already has the target tag
        const existing = await prisma.recipeTag.findUnique({
          where: { recipeId_tag: { recipeId: row.recipeId, tag: to } },
        });

        if (existing) {
          // Duplicate — delete the stale row instead of updating
          await prisma.recipeTag.delete({ where: { id: row.id } });
          deleted++;
        } else {
          // Safe to rename
          await prisma.recipeTag.update({
            where: { id: row.id },
            data: { tag: to },
          });
          updated++;
        }
      }

      console.log(`  "${from}" → "${to}" (${staleRows.length} recipe(s))`);
    }

    console.log(`\nDone. ${updated} tag(s) updated, ${deleted} duplicate(s) removed.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
