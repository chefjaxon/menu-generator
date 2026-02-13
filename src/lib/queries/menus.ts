import { nanoid } from 'nanoid';
import { getDb } from '../db';
import type { Menu, MenuItem } from '../types';
import { getRecipeById } from './recipes';

interface MenuRow {
  id: string;
  client_id: string;
  created_at: string;
  finalized: number;
  week_label: string | null;
  client_name?: string;
}

interface MenuItemRow {
  id: string;
  menu_id: string;
  recipe_id: string;
  selected_protein: string | null;
  sort_order: number;
}

function hydrateMenu(row: MenuRow, includeRecipes = false): Menu {
  const db = getDb();
  const itemRows = db.prepare(
    'SELECT * FROM menu_items WHERE menu_id = ? ORDER BY sort_order'
  ).all(row.id) as MenuItemRow[];

  const items: MenuItem[] = itemRows.map((ir) => ({
    id: ir.id,
    menuId: ir.menu_id,
    recipeId: ir.recipe_id,
    selectedProtein: ir.selected_protein,
    sortOrder: ir.sort_order,
    recipe: includeRecipes ? getRecipeById(ir.recipe_id) || undefined : undefined,
  }));

  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    createdAt: row.created_at,
    finalized: row.finalized === 1,
    weekLabel: row.week_label,
    items,
  };
}

export function getAllMenus(clientId?: string): Menu[] {
  const db = getDb();
  let query = `
    SELECT m.*, c.name as client_name
    FROM menus m
    JOIN clients c ON c.id = m.client_id
  `;
  const params: string[] = [];

  if (clientId) {
    query += ' WHERE m.client_id = ?';
    params.push(clientId);
  }

  query += ' ORDER BY m.created_at DESC';

  const rows = db.prepare(query).all(...params) as MenuRow[];
  return rows.map((r) => hydrateMenu(r));
}

export function getMenuById(id: string): Menu | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT m.*, c.name as client_name
    FROM menus m
    JOIN clients c ON c.id = m.client_id
    WHERE m.id = ?
  `).get(id) as MenuRow | undefined;

  if (!row) return null;
  return hydrateMenu(row, true);
}

export function getRecentRecipeIdsForClient(clientId: string, menuCount = 6): Set<string> {
  const db = getDb();
  const menus = db.prepare(
    'SELECT id FROM menus WHERE client_id = ? AND finalized = 1 ORDER BY created_at DESC LIMIT ?'
  ).all(clientId, menuCount) as Array<{ id: string }>;

  const menuIds = menus.map((m) => m.id);
  if (menuIds.length === 0) return new Set();

  const placeholders = menuIds.map(() => '?').join(',');
  const items = db.prepare(
    `SELECT DISTINCT recipe_id FROM menu_items WHERE menu_id IN (${placeholders})`
  ).all(...menuIds) as Array<{ recipe_id: string }>;

  return new Set(items.map((i) => i.recipe_id));
}

export function createDraftMenu(
  clientId: string,
  items: Array<{ recipeId: string; selectedProtein: string | null }>
): Menu {
  const db = getDb();
  const menuId = nanoid();

  // Delete any existing drafts for this client
  const existingDrafts = db.prepare(
    'SELECT id FROM menus WHERE client_id = ? AND finalized = 0'
  ).all(clientId) as Array<{ id: string }>;

  const insert = db.transaction(() => {
    for (const draft of existingDrafts) {
      db.prepare('DELETE FROM menu_items WHERE menu_id = ?').run(draft.id);
      db.prepare('DELETE FROM menus WHERE id = ?').run(draft.id);
    }

    db.prepare(
      'INSERT INTO menus (id, client_id, finalized) VALUES (?, ?, 0)'
    ).run(menuId, clientId);

    for (let i = 0; i < items.length; i++) {
      db.prepare(
        'INSERT INTO menu_items (id, menu_id, recipe_id, selected_protein, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(nanoid(), menuId, items[i].recipeId, items[i].selectedProtein, i);
    }
  });

  insert();
  return getMenuById(menuId)!;
}

export function finalizeMenu(menuId: string, weekLabel?: string): Menu | null {
  const db = getDb();
  const label = weekLabel || new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const result = db.prepare(
    `UPDATE menus SET finalized = 1, week_label = ? WHERE id = ? AND finalized = 0`
  ).run(label, menuId);

  if (result.changes === 0) return null;
  return getMenuById(menuId);
}

export function updateMenuItem(menuItemId: string, recipeId: string, selectedProtein: string | null): boolean {
  const db = getDb();
  const result = db.prepare(
    'UPDATE menu_items SET recipe_id = ?, selected_protein = ? WHERE id = ?'
  ).run(recipeId, selectedProtein, menuItemId);
  return result.changes > 0;
}

export function deleteMenu(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM menus WHERE id = ?').run(id);
  return result.changes > 0;
}
