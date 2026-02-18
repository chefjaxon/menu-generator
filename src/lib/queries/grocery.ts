import { nanoid } from 'nanoid';
import { prisma } from '../prisma';
import { consolidateExactDuplicates } from '../grocery-utils';
import type { GroceryItem } from '../types';

function mapGroceryItem(row: {
  id: string;
  menuId: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  source: string;
  recipeItemId: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
}): GroceryItem {
  return {
    id: row.id,
    menuId: row.menuId,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    checked: row.checked,
    source: row.source as 'recipe' | 'manual',
    recipeItemId: row.recipeItemId,
    notes: row.notes,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getGroceryItemsForMenu(menuId: string): Promise<GroceryItem[]> {
  const rows = await prisma.groceryItem.findMany({
    where: { menuId },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map(mapGroceryItem);
}

export async function createGroceryItem(data: {
  menuId: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
  source: 'recipe' | 'manual';
  recipeItemId?: string | null;
  notes?: string | null;
  sortOrder?: number;
}): Promise<GroceryItem> {
  const row = await prisma.groceryItem.create({
    data: {
      id: nanoid(),
      menuId: data.menuId,
      name: data.name,
      quantity: data.quantity ?? null,
      unit: data.unit ?? null,
      checked: false,
      source: data.source,
      recipeItemId: data.recipeItemId ?? null,
      notes: data.notes ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  return mapGroceryItem(row);
}

export async function updateGroceryItem(
  id: string,
  data: Partial<{
    name: string;
    quantity: string | null;
    unit: string | null;
    checked: boolean;
    notes: string | null;
    sortOrder: number;
  }>
): Promise<GroceryItem | null> {
  try {
    const row = await prisma.groceryItem.update({ where: { id }, data });
    return mapGroceryItem(row);
  } catch {
    return null;
  }
}

export async function deleteGroceryItem(id: string): Promise<boolean> {
  try {
    await prisma.groceryItem.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function mergeGroceryItems(
  keepId: string,
  deleteId: string,
  mergedData: {
    name: string;
    quantity: string | null;
    unit: string | null;
    notes: string | null;
  }
): Promise<GroceryItem | null> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.groceryItem.update({
        where: { id: keepId },
        data: mergedData,
      });
      await tx.groceryItem.delete({ where: { id: deleteId } });
      return updated;
    });
    return mapGroceryItem(result);
  } catch {
    return null;
  }
}

/**
 * Regenerate recipe-sourced grocery items from all client-selected menu items.
 * Manual items are never touched.
 * Exact-name duplicates across recipes are auto-consolidated.
 */
export async function generateGroceryItemsFromMenu(menuId: string): Promise<GroceryItem[]> {
  const menuItems = await prisma.menuItem.findMany({
    where: { menuId, clientSelected: true },
    include: {
      recipe: {
        include: { ingredients: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  // Build raw ingredient list from all selected recipes
  const rawItems: GroceryItem[] = [];
  let sortIdx = 0;
  for (const menuItem of menuItems) {
    for (const ing of menuItem.recipe.ingredients) {
      rawItems.push({
        id: nanoid(),
        menuId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        checked: false,
        source: 'recipe',
        recipeItemId: ing.id,
        notes: null,
        sortOrder: sortIdx++,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Consolidate exact-name duplicates before persisting
  const consolidated = consolidateExactDuplicates(rawItems);

  // Reassign sort orders after consolidation
  const toCreate = consolidated.map((item, i) => ({
    id: nanoid(),
    menuId,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    checked: false,
    source: 'recipe' as const,
    recipeItemId: item.recipeItemId,
    notes: item.notes,
    sortOrder: i,
  }));

  // Atomic: delete existing recipe items and recreate consolidated set
  // Manual items are excluded from the delete (source !== 'recipe')
  await prisma.$transaction([
    prisma.groceryItem.deleteMany({ where: { menuId, source: 'recipe' } }),
    prisma.groceryItem.createMany({ data: toCreate }),
  ]);

  return getGroceryItemsForMenu(menuId);
}
