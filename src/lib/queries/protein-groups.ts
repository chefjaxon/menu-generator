import { nanoid } from 'nanoid';
import { getDb } from '../db';
import type { ProteinGroup } from '../types';

interface GroupRow {
  id: string;
  name: string;
  sort_order: number;
}

function hydrateGroup(row: GroupRow): ProteinGroup {
  const db = getDb();
  const members = db.prepare(
    'SELECT protein FROM protein_group_members WHERE group_id = ? ORDER BY protein ASC'
  ).all(row.id) as Array<{ protein: string }>;

  return {
    id: row.id,
    name: row.name,
    members: members.map((m) => m.protein),
  };
}

export function getAllProteinGroups(): ProteinGroup[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM protein_groups ORDER BY sort_order ASC, name ASC').all() as GroupRow[];
  return rows.map(hydrateGroup);
}

export function getProteinGroupById(id: string): ProteinGroup | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM protein_groups WHERE id = ?').get(id) as GroupRow | undefined;
  if (!row) return null;
  return hydrateGroup(row);
}

export function getProteinGroupByName(name: string): ProteinGroup | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM protein_groups WHERE name = ?').get(name) as GroupRow | undefined;
  if (!row) return null;
  return hydrateGroup(row);
}

export function createProteinGroup(name: string, members: string[]): ProteinGroup {
  const db = getDb();
  const id = nanoid();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM protein_groups').get() as { max_order: number };

  const insert = db.transaction(() => {
    db.prepare('INSERT INTO protein_groups (id, name, sort_order) VALUES (?, ?, ?)').run(
      id, name.toLowerCase().trim(), maxOrder.max_order + 1
    );
    for (const member of members) {
      db.prepare('INSERT INTO protein_group_members (id, group_id, protein) VALUES (?, ?, ?)').run(
        nanoid(), id, member.toLowerCase().trim()
      );
    }
  });

  insert();
  return getProteinGroupById(id)!;
}

export function updateProteinGroup(id: string, name: string, members: string[]): ProteinGroup | null {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM protein_groups WHERE id = ?').get(id);
  if (!existing) return null;

  const update = db.transaction(() => {
    db.prepare('UPDATE protein_groups SET name = ? WHERE id = ?').run(name.toLowerCase().trim(), id);
    db.prepare('DELETE FROM protein_group_members WHERE group_id = ?').run(id);
    for (const member of members) {
      db.prepare('INSERT INTO protein_group_members (id, group_id, protein) VALUES (?, ?, ?)').run(
        nanoid(), id, member.toLowerCase().trim()
      );
    }
  });

  update();
  return getProteinGroupById(id);
}

export function deleteProteinGroup(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM protein_groups WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Given a protein name, find which group(s) it belongs to.
 */
export function getGroupsForProtein(protein: string): ProteinGroup[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT pg.* FROM protein_groups pg
     JOIN protein_group_members pgm ON pgm.group_id = pg.id
     WHERE pgm.protein = ?
     ORDER BY pg.sort_order ASC`
  ).all(protein) as GroupRow[];
  return rows.map(hydrateGroup);
}
