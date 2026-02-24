import { prisma } from '@/lib/prisma';

export interface GroceryCategory {
  slug: string;
  label: string;
  sortOrder: number;
}

/** Returns all user-defined custom categories, ordered by sortOrder then createdAt. */
export async function getAllGroceryCategories(): Promise<GroceryCategory[]> {
  const rows = await prisma.groceryCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map((r) => ({ slug: r.slug, label: r.label, sortOrder: r.sortOrder }));
}

/** Derives a URL-safe slug from a display label (e.g. "Frozen Foods" → "frozen-foods"). */
export function labelToSlug(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Creates a new custom category (upserts by slug so double-clicks are safe).
 * Returns the persisted category.
 */
export async function createGroceryCategory(label: string): Promise<GroceryCategory> {
  const slug = labelToSlug(label);
  const row = await prisma.groceryCategory.upsert({
    where: { slug },
    update: { label },
    create: { slug, label },
  });
  return { slug: row.slug, label: row.label, sortOrder: row.sortOrder };
}

/**
 * Deletes a custom category and migrates all CategoryOverride rows that used it
 * to the given reassignment category.
 */
export async function deleteGroceryCategory(
  slug: string,
  reassignTo: string
): Promise<void> {
  await prisma.$transaction([
    prisma.categoryOverride.updateMany({
      where: { category: slug },
      data: { category: reassignTo },
    }),
    prisma.groceryCategory.delete({ where: { slug } }),
  ]);
}
