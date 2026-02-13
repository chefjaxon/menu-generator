import { nanoid } from 'nanoid';
import { getDb } from '../db';

export function getAllProteins(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT name FROM proteins ORDER BY sort_order ASC, name ASC').all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export function addProtein(name: string): void {
  const db = getDb();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM proteins').get() as { max_order: number };
  db.prepare('INSERT INTO proteins (id, name, sort_order) VALUES (?, ?, ?)').run(
    nanoid(),
    name.toLowerCase().trim(),
    maxOrder.max_order + 1
  );
}

export function removeProtein(name: string): boolean {
  const db = getDb();
  const usage = getProteinUsageCount(name);
  if (usage > 0) return false;
  const result = db.prepare('DELETE FROM proteins WHERE name = ?').run(name);
  return result.changes > 0;
}

export function getProteinUsageCount(name: string): number {
  const db = getDb();
  const clientCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM client_proteins WHERE protein = ?'
  ).get(name) as { cnt: number };
  const recipeCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM recipe_protein_swaps WHERE protein = ?'
  ).get(name) as { cnt: number };
  return clientCount.cnt + recipeCount.cnt;
}

export function getProteinUsages(): Record<string, number> {
  const db = getDb();
  const proteins = getAllProteins();
  const usages: Record<string, number> = {};
  for (const p of proteins) {
    usages[p] = getProteinUsageCount(p);
  }
  return usages;
}
