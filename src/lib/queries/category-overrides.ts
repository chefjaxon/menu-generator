import { prisma } from '@/lib/prisma';

/**
 * Returns all user-taught category overrides as a plain map.
 * { "orange juice": "produce", "almond milk": "pantry", ... }
 * Keys are canonical (lowercased, trimmed) ingredient names.
 */
export async function getAllCategoryOverrides(): Promise<Record<string, string>> {
  const rows = await prisma.categoryOverride.findMany();
  return Object.fromEntries(rows.map((r) => [r.ingredientName, r.category]));
}

/**
 * Persist (or update) a user-taught category override.
 * ingredientName should be lowercased and trimmed before calling.
 */
export async function upsertCategoryOverride(
  ingredientName: string,
  category: string
): Promise<void> {
  await prisma.categoryOverride.upsert({
    where: { ingredientName },
    update: { category },
    create: { ingredientName, category },
  });
}
