import { nanoid } from 'nanoid';
import { prisma } from '../prisma';
import { getRecipeById } from './recipes';
import type { Menu, MenuItem } from '../types';

function mapMenu(row: {
  id: string;
  clientId: string;
  createdAt: Date;
  finalized: boolean;
  weekLabel: string | null;
  groceryGenerated: boolean;
  publishedAt: Date | null;
  clientToken: string | null;
  pantryToken: string | null;
  pantrySubmitted: boolean;
  client?: { name: string };
  items: Array<{
    id: string;
    menuId: string;
    recipeId: string;
    selectedProtein: string | null;
    sortOrder: number;
    clientSelected: boolean;
    omitNotes: string | null;
    clientNote: string | null;
  }>;
}, includeRecipes = false, recipes: Record<string, Awaited<ReturnType<typeof getRecipeById>>> = {}): Menu {
  const items: MenuItem[] = row.items.map((ir) => ({
    id: ir.id,
    menuId: ir.menuId,
    recipeId: ir.recipeId,
    selectedProtein: ir.selectedProtein,
    sortOrder: ir.sortOrder,
    clientSelected: ir.clientSelected,
    omitNotes: ir.omitNotes ? JSON.parse(ir.omitNotes) as string[] : undefined,
    clientNote: ir.clientNote,
    recipe: includeRecipes ? (recipes[ir.recipeId] || undefined) : undefined,
  }));

  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client?.name,
    createdAt: row.createdAt.toISOString(),
    finalized: row.finalized,
    weekLabel: row.weekLabel,
    groceryGenerated: row.groceryGenerated,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    clientToken: row.clientToken,
    pantryToken: row.pantryToken,
    pantrySubmitted: row.pantrySubmitted,
    items,
  };
}

const MENU_SELECT_ITEMS = {
  id: true, menuId: true, recipeId: true, selectedProtein: true,
  sortOrder: true, clientSelected: true, omitNotes: true, clientNote: true,
} as const;

export async function getAllMenus(clientId?: string): Promise<Menu[]> {
  const rows = await prisma.menu.findMany({
    where: clientId ? { clientId } : undefined,
    select: {
      id: true, clientId: true, createdAt: true, finalized: true, weekLabel: true,
      groceryGenerated: true, publishedAt: true, clientToken: true, pantryToken: true,
      pantrySubmitted: true,
      client: { select: { name: true } },
      items: {
        orderBy: { sortOrder: 'asc' },
        select: MENU_SELECT_ITEMS,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => mapMenu(r));
}

export async function getMenuById(id: string): Promise<Menu | null> {
  const row = await prisma.menu.findUnique({
    where: { id },
    select: {
      id: true, clientId: true, createdAt: true, finalized: true, weekLabel: true,
      groceryGenerated: true, publishedAt: true, clientToken: true, pantryToken: true,
      pantrySubmitted: true,
      client: { select: { name: true } },
      items: {
        orderBy: { sortOrder: 'asc' },
        select: MENU_SELECT_ITEMS,
      },
    },
  });
  if (!row) return null;

  const recipeIds = [...new Set(row.items.map((i) => i.recipeId))];
  const recipeList = await Promise.all(recipeIds.map((rid) => getRecipeById(rid)));
  const recipes: Record<string, Awaited<ReturnType<typeof getRecipeById>>> = {};
  for (let i = 0; i < recipeIds.length; i++) {
    recipes[recipeIds[i]] = recipeList[i];
  }

  return mapMenu(row, true, recipes);
}

export async function getRecentRecipeIdsForClient(clientId: string, menuCount = 6): Promise<Set<string>> {
  const menus = await prisma.menu.findMany({
    where: { clientId, finalized: true },
    orderBy: { createdAt: 'desc' },
    take: menuCount,
    select: { id: true },
  });

  if (menus.length === 0) return new Set();

  const menuIds = menus.map((m) => m.id);
  const items = await prisma.menuItem.findMany({
    where: { menuId: { in: menuIds } },
    select: { recipeId: true },
    distinct: ['recipeId'],
  });

  return new Set(items.map((i) => i.recipeId));
}

export async function createDraftMenu(
  clientId: string,
  items: Array<{ recipeId: string; selectedProtein: string | null; omitNotes?: string[] }>
): Promise<Menu> {
  const menuId = nanoid();

  const existingDrafts = await prisma.menu.findMany({
    where: { clientId, finalized: false },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const draft of existingDrafts) {
      await tx.menuItem.deleteMany({ where: { menuId: draft.id } });
      await tx.menu.delete({ where: { id: draft.id } });
    }

    await tx.menu.create({
      data: {
        id: menuId,
        clientId,
        finalized: false,
        items: {
          create: items.map((item, i) => ({
            id: nanoid(),
            recipeId: item.recipeId,
            selectedProtein: item.selectedProtein,
            sortOrder: i,
            omitNotes: item.omitNotes && item.omitNotes.length > 0
              ? JSON.stringify(item.omitNotes)
              : null,
          })),
        },
      },
    });
  });

  return (await getMenuById(menuId))!;
}

export async function finalizeMenu(menuId: string, weekLabel?: string): Promise<Menu | null> {
  const label = weekLabel || new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  try {
    await prisma.menu.update({
      where: { id: menuId, finalized: false },
      data: { finalized: true, weekLabel: label },
    });
  } catch {
    return null;
  }

  return getMenuById(menuId);
}

export async function updateMenuItem(menuItemId: string, recipeId: string, selectedProtein: string | null): Promise<boolean> {
  try {
    await prisma.menuItem.update({
      where: { id: menuItemId },
      data: { recipeId, selectedProtein },
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteMenu(id: string): Promise<boolean> {
  try {
    await prisma.menu.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function setMenuItemSelected(menuItemId: string, selected: boolean): Promise<boolean> {
  try {
    await prisma.menuItem.update({
      where: { id: menuItemId },
      data: { clientSelected: selected },
    });
    return true;
  } catch {
    return false;
  }
}

export async function publishMenu(menuId: string): Promise<{ clientToken: string } | null> {
  const token = nanoid(24);
  try {
    await prisma.menu.update({
      where: { id: menuId },
      data: { publishedAt: new Date(), clientToken: token },
    });
    return { clientToken: token };
  } catch {
    return null;
  }
}

export async function getMenuByClientToken(token: string): Promise<Menu | null> {
  const row = await prisma.menu.findUnique({
    where: { clientToken: token },
    select: {
      id: true, clientId: true, createdAt: true, finalized: true, weekLabel: true,
      groceryGenerated: true, publishedAt: true, clientToken: true, pantryToken: true,
      pantrySubmitted: true,
      client: { select: { name: true } },
      items: {
        orderBy: { sortOrder: 'asc' },
        select: MENU_SELECT_ITEMS,
      },
    },
  });
  if (!row) return null;

  const recipeIds = [...new Set(row.items.map((i) => i.recipeId))];
  const recipeList = await Promise.all(recipeIds.map((rid) => getRecipeById(rid)));
  const recipes: Record<string, Awaited<ReturnType<typeof getRecipeById>>> = {};
  for (let i = 0; i < recipeIds.length; i++) {
    recipes[recipeIds[i]] = recipeList[i];
  }

  return mapMenu(row, true, recipes);
}

export async function submitClientSelections(
  menuId: string,
  selections: Array<{ menuItemId: string; note?: string }>
): Promise<boolean> {
  try {
    // First clear all selections for this menu
    await prisma.menuItem.updateMany({
      where: { menuId },
      data: { clientSelected: false, clientNote: null },
    });
    // Set selected items
    for (const sel of selections) {
      await prisma.menuItem.update({
        where: { id: sel.menuItemId },
        data: { clientSelected: true, clientNote: sel.note || null },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function sendPantryLink(menuId: string): Promise<{ pantryToken: string } | null> {
  const token = nanoid(24);
  try {
    await prisma.menu.update({
      where: { id: menuId },
      data: { pantryToken: token },
    });
    return { pantryToken: token };
  } catch {
    return null;
  }
}

export async function getMenuByPantryToken(token: string): Promise<Menu | null> {
  const row = await prisma.menu.findUnique({
    where: { pantryToken: token },
    select: {
      id: true, clientId: true, createdAt: true, finalized: true, weekLabel: true,
      groceryGenerated: true, publishedAt: true, clientToken: true, pantryToken: true,
      pantrySubmitted: true,
      client: { select: { name: true } },
      items: {
        orderBy: { sortOrder: 'asc' },
        select: MENU_SELECT_ITEMS,
      },
    },
  });
  if (!row) return null;
  return mapMenu(row);
}

export async function submitPantryChecklist(
  menuId: string,
  checkedItemIds: string[]
): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.groceryItem.updateMany({
        where: { menuId, id: { in: checkedItemIds } },
        data: { checked: true },
      }),
      prisma.menu.update({
        where: { id: menuId },
        data: { pantrySubmitted: true },
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function getMenusByClientId(clientId: string): Promise<Menu[]> {
  return getAllMenus(clientId);
}
