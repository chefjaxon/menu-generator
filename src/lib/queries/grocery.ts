import { nanoid } from 'nanoid';
import { prisma } from '../prisma';
import {
  consolidateExactDuplicates,
  normalizeIngredientNames,
  applyClaudeGrayZoneNormalization,
} from '../grocery-utils';
import type { GroceryItem, RemovedItem, GenerateGroceryResponse } from '../types';

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
    source: row.source as 'recipe' | 'manual' | 'removed',
    recipeItemId: row.recipeItemId,
    notes: row.notes,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getGroceryItemsForMenu(menuId: string): Promise<GroceryItem[]> {
  const rows = await prisma.groceryItem.findMany({
    where: { menuId, NOT: { source: 'removed' } },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map(mapGroceryItem);
}

export async function getRemovedItemsForMenu(menuId: string): Promise<RemovedItem[]> {
  const rows = await prisma.groceryItem.findMany({
    where: { menuId, source: 'removed' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, menuId: true, name: true, recipeItemId: true },
  });
  return rows.map((r) => ({
    id: r.id,
    menuId: r.menuId,
    name: r.name,
    recipeItemId: r.recipeItemId,
  }));
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
 * Restore a removed grocery item back to the main list as a manual item.
 * The restored item is appended at the end of the list (highest sortOrder + 1).
 */
export async function restoreRemovedItem(itemId: string): Promise<GroceryItem | null> {
  try {
    const existing = await prisma.groceryItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.source !== 'removed') return null;

    const maxSort = await prisma.groceryItem.aggregate({
      where: { menuId: existing.menuId, NOT: { source: 'removed' } },
      _max: { sortOrder: true },
    });

    const row = await prisma.groceryItem.update({
      where: { id: itemId },
      data: {
        source: 'manual',
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
    return mapGroceryItem(row);
  } catch {
    return null;
  }
}

/**
 * Regenerate recipe-sourced grocery items from all client-selected menu items.
 * Manual items are never touched.
 *
 * Pipeline:
 * 1. Collect raw ingredients from selected recipes
 * 2. Normalize names via static alias table
 * 3. Apply Claude gray-zone normalization (optional, never blocks on failure)
 * 4. Separate items with no quantity AND no unit into the "removed" set
 * 5. Consolidate exact-name duplicates among kept items
 * 6. Atomically replace recipe/removed items in the DB, persist both sets
 * 7. Return { items, removedItems }
 */
export async function generateGroceryItemsFromMenu(menuId: string): Promise<GenerateGroceryResponse> {
  // Fetch menu to get clientId, then fetch client restrictions
  const menu = await prisma.menu.findUnique({
    where: { id: menuId },
    select: {
      clientId: true,
      client: { select: { restrictions: { select: { restriction: true } } } },
    },
  });
  const clientRestrictions = menu?.client.restrictions.map((r) => r.restriction.toLowerCase().trim()) ?? [];

  const menuItems = await prisma.menuItem.findMany({
    where: { menuId, clientSelected: true },
    include: {
      recipe: {
        include: { ingredients: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  // Build raw ingredient list from all selected recipes
  // Skip optional/garnish ingredients that conflict with client restrictions
  const rawItems: GroceryItem[] = [];
  let sortIdx = 0;
  for (const menuItem of menuItems) {
    for (const ing of menuItem.recipe.ingredients) {
      if (clientRestrictions.length > 0 && ing.role !== 'core') {
        const nameNorm = ing.name.toLowerCase().trim();
        const isRestricted = clientRestrictions.some(
          (r) => nameNorm.includes(r) || r.includes(nameNorm)
        );
        if (isRestricted) continue;
      }
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

  // Step 1: Static alias normalization (synchronous, never fails)
  const aliasNormalized = normalizeIngredientNames(rawItems);

  // Step 2: Claude gray-zone normalization (async, silently no-ops on failure)
  const fullyNormalized = await applyClaudeGrayZoneNormalization(aliasNormalized);

  // Step 3: Separate items with no quantity AND no unit
  const toKeep: GroceryItem[] = [];
  const toRemoveRaw: GroceryItem[] = [];
  for (const item of fullyNormalized) {
    if (item.quantity === null && item.unit === null) {
      toRemoveRaw.push(item);
    } else {
      toKeep.push(item);
    }
  }

  // Step 4: Consolidate exact duplicates among kept items
  const consolidated = consolidateExactDuplicates(toKeep);

  // Step 5: Deduplicate removed items by canonical name
  // (same no-measurement ingredient from multiple recipes → one removed entry)
  const removedByName = new Map<string, GroceryItem>();
  for (const item of toRemoveRaw) {
    const key = item.name.toLowerCase().trim();
    if (!removedByName.has(key)) removedByName.set(key, item);
  }
  const deduplicatedRemoved = Array.from(removedByName.values());

  // Build DB rows
  const toCreateItems = consolidated.map((item, i) => ({
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

  const toCreateRemoved = deduplicatedRemoved.map((item, i) => ({
    id: nanoid(),
    menuId,
    name: item.name,
    quantity: null,
    unit: null,
    checked: false,
    source: 'removed' as const,
    recipeItemId: item.recipeItemId,
    notes: null,
    sortOrder: i,
  }));

  // Step 6: Atomic replace — delete stale recipe/removed rows, persist new split
  // Manual items (source='manual') are never deleted.
  await prisma.$transaction([
    prisma.groceryItem.deleteMany({
      where: { menuId, source: { in: ['recipe', 'removed'] } },
    }),
    prisma.groceryItem.createMany({ data: toCreateItems }),
    prisma.groceryItem.createMany({ data: toCreateRemoved }),
  ]);

  // Step 7: Fetch and return both sets
  const [items, removedItems] = await Promise.all([
    getGroceryItemsForMenu(menuId),
    getRemovedItemsForMenu(menuId),
  ]);

  return { items, removedItems };
}

export interface GroceryListSummary {
  menuId: string;
  clientName: string;
  weekLabel: string | null;
  createdAt: string;
  totalItems: number;
  checkedItems: number;
  selectedCount: number;
}

/**
 * Fetch a summary of all finalized menus with grocery data for the index page.
 * Returns all finalized menus ordered by most recently created,
 * with grocery item counts and client selection counts.
 * Excludes 'removed' items from the count (only main list items are counted).
 */
export async function getAllGroceryListSummaries(): Promise<GroceryListSummary[]> {
  const menus = await prisma.menu.findMany({
    where: { finalized: true },
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { name: true } },
      groceryItems: { select: { checked: true, source: true } },
      items: { select: { clientSelected: true } },
    },
  });

  return menus.map((m) => {
    const mainItems = m.groceryItems.filter((g) => g.source !== 'removed');
    return {
      menuId: m.id,
      clientName: m.client.name,
      weekLabel: m.weekLabel,
      createdAt: m.createdAt.toISOString(),
      totalItems: mainItems.length,
      checkedItems: mainItems.filter((g) => g.checked).length,
      selectedCount: m.items.filter((i) => i.clientSelected).length,
    };
  });
}
