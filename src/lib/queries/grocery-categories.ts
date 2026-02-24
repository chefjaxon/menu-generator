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

// ─── Built-in category overrides ───────────────────────────────────────────

export interface BuiltinCategoryOverride {
  originalSlug: string;
  currentSlug: string;
  label: string;
}

/**
 * Returns all persisted built-in category renames.
 * Keys are the original (factory) slugs.
 */
export async function getAllBuiltinOverrides(): Promise<
  Record<string, { currentSlug: string; label: string }>
> {
  const rows = await prisma.builtinCategoryOverride.findMany();
  return Object.fromEntries(
    rows.map((r) => [r.originalSlug, { currentSlug: r.currentSlug, label: r.label }])
  );
}

/**
 * Renames a built-in category (label + slug) and migrates all CategoryOverride
 * rows that referenced the old current slug to the new slug.
 *
 * @param originalSlug  The factory slug ('produce', 'protein', etc.) — never changes.
 * @param newLabel      The user-supplied display label.
 * @returns The updated override record.
 */
export async function renameBuiltinCategory(
  originalSlug: string,
  newLabel: string
): Promise<BuiltinCategoryOverride> {
  const newSlug = labelToSlug(newLabel);

  // Find the current slug so we know what to migrate from
  const existing = await prisma.builtinCategoryOverride.findUnique({
    where: { originalSlug },
  });
  const oldSlug = existing?.currentSlug ?? originalSlug;

  await prisma.$transaction([
    // Migrate CategoryOverride rows from old slug → new slug
    prisma.categoryOverride.updateMany({
      where: { category: oldSlug },
      data: { category: newSlug },
    }),
    // Upsert the builtin override record
    prisma.builtinCategoryOverride.upsert({
      where: { originalSlug },
      update: { currentSlug: newSlug, label: newLabel },
      create: { originalSlug, currentSlug: newSlug, label: newLabel },
    }),
  ]);

  return { originalSlug, currentSlug: newSlug, label: newLabel };
}
