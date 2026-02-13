import { nanoid } from 'nanoid';
import { getDb } from '../db';
import type { Client, CuisineType, MenuComposition } from '../types';

interface ClientRow {
  id: string;
  name: string;
  items_per_menu: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function hydrateClient(row: ClientRow): Client {
  const db = getDb();

  const proteins = db.prepare(
    'SELECT protein FROM client_proteins WHERE client_id = ?'
  ).all(row.id) as Array<{ protein: string }>;

  const restrictions = db.prepare(
    'SELECT restriction FROM client_restrictions WHERE client_id = ?'
  ).all(row.id) as Array<{ restriction: string }>;

  const cuisinePrefs = db.prepare(
    'SELECT cuisine_type, weight FROM client_cuisine_preferences WHERE client_id = ?'
  ).all(row.id) as Array<{ cuisine_type: string; weight: number }>;

  const compositionRows = db.prepare(
    'SELECT category, count FROM client_menu_composition WHERE client_id = ?'
  ).all(row.id) as Array<{ category: string; count: number }>;

  const menuComposition: MenuComposition[] = compositionRows.map((c) => ({
    category: c.category,
    count: c.count,
  }));

  // Compute itemsPerMenu from composition if available, otherwise use stored value
  const compositionTotal = menuComposition.reduce((sum, c) => sum + c.count, 0);
  const itemsPerMenu = compositionTotal > 0 ? compositionTotal : row.items_per_menu;

  return {
    id: row.id,
    name: row.name,
    itemsPerMenu,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    proteins: proteins.map((p) => p.protein),
    restrictions: restrictions.map((r) => r.restriction),
    cuisinePreferences: cuisinePrefs.map((c) => ({
      cuisineType: c.cuisine_type as CuisineType,
      weight: c.weight,
    })),
    menuComposition,
  };
}

export function getAllClients(): Client[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM clients ORDER BY name ASC').all() as ClientRow[];
  return rows.map(hydrateClient);
}

export function getClientById(id: string): Client | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as ClientRow | undefined;
  if (!row) return null;
  return hydrateClient(row);
}

export interface ClientInput {
  name: string;
  itemsPerMenu?: number;
  notes?: string;
  proteins: string[];
  restrictions: string[];
  cuisinePreferences: Array<{ cuisineType: string; weight: number }>;
  menuComposition?: Array<{ category: string; count: number }>;
}

export function createClient(data: ClientInput): Client {
  const db = getDb();
  const id = nanoid();

  // Compute total from composition
  const composition = data.menuComposition || [];
  const compositionTotal = composition.reduce((sum, c) => sum + c.count, 0);
  const itemsPerMenu = compositionTotal > 0 ? compositionTotal : (data.itemsPerMenu || 5);

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO clients (id, name, items_per_menu, notes) VALUES (?, ?, ?, ?)`
    ).run(id, data.name, itemsPerMenu, data.notes || null);

    for (const protein of data.proteins) {
      db.prepare(
        'INSERT INTO client_proteins (id, client_id, protein) VALUES (?, ?, ?)'
      ).run(nanoid(), id, protein);
    }

    for (const restriction of data.restrictions) {
      db.prepare(
        'INSERT INTO client_restrictions (id, client_id, restriction) VALUES (?, ?, ?)'
      ).run(nanoid(), id, restriction);
    }

    for (const pref of data.cuisinePreferences) {
      db.prepare(
        'INSERT INTO client_cuisine_preferences (id, client_id, cuisine_type, weight) VALUES (?, ?, ?, ?)'
      ).run(nanoid(), id, pref.cuisineType, pref.weight);
    }

    for (const comp of composition) {
      if (comp.count > 0) {
        db.prepare(
          'INSERT INTO client_menu_composition (id, client_id, category, count) VALUES (?, ?, ?, ?)'
        ).run(nanoid(), id, comp.category, comp.count);
      }
    }
  });

  insert();
  return getClientById(id)!;
}

export function updateClient(id: string, data: ClientInput): Client | null {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(id);
  if (!existing) return null;

  const composition = data.menuComposition || [];
  const compositionTotal = composition.reduce((sum, c) => sum + c.count, 0);
  const itemsPerMenu = compositionTotal > 0 ? compositionTotal : (data.itemsPerMenu || 5);

  const update = db.transaction(() => {
    db.prepare(
      `UPDATE clients SET name = ?, items_per_menu = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(data.name, itemsPerMenu, data.notes || null, id);

    db.prepare('DELETE FROM client_proteins WHERE client_id = ?').run(id);
    for (const protein of data.proteins) {
      db.prepare(
        'INSERT INTO client_proteins (id, client_id, protein) VALUES (?, ?, ?)'
      ).run(nanoid(), id, protein);
    }

    db.prepare('DELETE FROM client_restrictions WHERE client_id = ?').run(id);
    for (const restriction of data.restrictions) {
      db.prepare(
        'INSERT INTO client_restrictions (id, client_id, restriction) VALUES (?, ?, ?)'
      ).run(nanoid(), id, restriction);
    }

    db.prepare('DELETE FROM client_cuisine_preferences WHERE client_id = ?').run(id);
    for (const pref of data.cuisinePreferences) {
      db.prepare(
        'INSERT INTO client_cuisine_preferences (id, client_id, cuisine_type, weight) VALUES (?, ?, ?, ?)'
      ).run(nanoid(), id, pref.cuisineType, pref.weight);
    }

    db.prepare('DELETE FROM client_menu_composition WHERE client_id = ?').run(id);
    for (const comp of composition) {
      if (comp.count > 0) {
        db.prepare(
          'INSERT INTO client_menu_composition (id, client_id, category, count) VALUES (?, ?, ?, ?)'
        ).run(nanoid(), id, comp.category, comp.count);
      }
    }
  });

  update();
  return getClientById(id);
}

export function deleteClient(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  return result.changes > 0;
}
