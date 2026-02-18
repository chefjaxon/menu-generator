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
  client?: { name: string };
  items: Array<{
    id: string;
    menuId: string;
    recipeId: string;
    selectedProtein: string | null;
    sortOrder: number;
    clientSelected: boolean;
  }>;
}, includeRecipes = false, recipes: Record<string, Awaited<ReturnType<typeof getRecipeById>>> = {}): Menu {
  const items: MenuItem[] = row.items.map((ir) => ({
    id: ir.id,
    menuId: ir.menuId,
    recipeId: ir.recipeId,
    selectedProtein: ir.selectedProtein,
    sortOrder: ir.sortOrder,
    clientSelected: ir.clientSelected,
    recipe: includeRecipes ? (recipes[ir.recipeId] || undefined) : undefined,
  }));

  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client?.name,
    createdAt: row.createdAt.toISOString(),
    finalized: row.finalized,
    weekLabel: row.weekLabel,
    items,
  };
}

export async function getAllMenus(clientId?: string): Promise<Menu[]> {
  const rows = await prisma.menu.findMany({
    where: clientId ? { clientId } : undefined,
    include: {
      client: { select: { name: true } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => mapMenu(r));
}

export async function getMenuById(id: string): Promise<Menu | null> {
  const row = await prisma.menu.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      items: { orderBy: { sortOrder: 'asc' } },
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
  items: Array<{ recipeId: string; selectedProtein: string | null }>
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
