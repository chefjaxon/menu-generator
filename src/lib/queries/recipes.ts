import { nanoid } from 'nanoid';
import { getDb } from '../db';
import type { Recipe, Ingredient, Protein, CuisineType, ItemType } from '../types';

interface RecipeRow {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  cuisine_type: string;
  item_type: string;
  serving_size: number;
  created_at: string;
  updated_at: string;
}

interface IngredientRow {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  sort_order: number;
}

function hydrateRecipe(row: RecipeRow): Recipe {
  const db = getDb();
  const ingredients = db.prepare(
    'SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order'
  ).all(row.id) as IngredientRow[];

  const proteins = db.prepare(
    'SELECT protein FROM recipe_protein_swaps WHERE recipe_id = ?'
  ).all(row.id) as Array<{ protein: string }>;

  const tags = db.prepare(
    'SELECT tag FROM recipe_tags WHERE recipe_id = ?'
  ).all(row.id) as Array<{ tag: string }>;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    cuisineType: row.cuisine_type as CuisineType,
    itemType: row.item_type as ItemType,
    servingSize: row.serving_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ingredients: ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      sortOrder: i.sort_order,
    })),
    proteinSwaps: proteins.map((p) => p.protein as Protein),
    tags: tags.map((t) => t.tag),
  };
}

export function getAllRecipes(filters?: {
  cuisine?: string;
  itemType?: string;
  tag?: string;
  protein?: string;
  search?: string;
}): Recipe[] {
  const db = getDb();
  let query = 'SELECT DISTINCT r.* FROM recipes r';
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters?.tag) {
    query += ' JOIN recipe_tags rt ON rt.recipe_id = r.id';
    conditions.push('rt.tag = ?');
    params.push(filters.tag);
  }

  if (filters?.protein) {
    query += ' JOIN recipe_protein_swaps rp ON rp.recipe_id = r.id';
    conditions.push('rp.protein = ?');
    params.push(filters.protein);
  }

  if (filters?.cuisine) {
    conditions.push('r.cuisine_type = ?');
    params.push(filters.cuisine);
  }

  if (filters?.itemType) {
    conditions.push('r.item_type = ?');
    params.push(filters.itemType);
  }

  if (filters?.search) {
    conditions.push('r.name LIKE ?');
    params.push(`%${filters.search}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.updated_at DESC';

  const rows = db.prepare(query).all(...params) as RecipeRow[];
  return rows.map(hydrateRecipe);
}

export function getRecipeById(id: string): Recipe | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as RecipeRow | undefined;
  if (!row) return null;
  return hydrateRecipe(row);
}

export interface RecipeInput {
  name: string;
  description?: string;
  instructions?: string;
  cuisineType: string;
  itemType: string;
  servingSize: number;
  ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
  proteinSwaps: string[];
  tags: string[];
}

export function createRecipe(data: RecipeInput): Recipe {
  const db = getDb();
  const id = nanoid();

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO recipes (id, name, description, instructions, cuisine_type, item_type, serving_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.name, data.description || null, data.instructions || null, data.cuisineType, data.itemType, data.servingSize);

    for (let i = 0; i < data.ingredients.length; i++) {
      const ing = data.ingredients[i];
      db.prepare(
        `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, unit, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(nanoid(), id, ing.name, ing.quantity || null, ing.unit || null, i);
    }

    for (const protein of data.proteinSwaps) {
      db.prepare(
        'INSERT INTO recipe_protein_swaps (id, recipe_id, protein) VALUES (?, ?, ?)'
      ).run(nanoid(), id, protein);
    }

    for (const tag of data.tags) {
      db.prepare(
        'INSERT INTO recipe_tags (id, recipe_id, tag) VALUES (?, ?, ?)'
      ).run(nanoid(), id, tag);
    }
  });

  insert();
  return getRecipeById(id)!;
}

export function updateRecipe(id: string, data: RecipeInput): Recipe | null {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM recipes WHERE id = ?').get(id);
  if (!existing) return null;

  const update = db.transaction(() => {
    db.prepare(
      `UPDATE recipes SET name = ?, description = ?, instructions = ?, cuisine_type = ?, item_type = ?, serving_size = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(data.name, data.description || null, data.instructions || null, data.cuisineType, data.itemType, data.servingSize, id);

    // Replace ingredients
    db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
    for (let i = 0; i < data.ingredients.length; i++) {
      const ing = data.ingredients[i];
      db.prepare(
        `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, unit, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(nanoid(), id, ing.name, ing.quantity || null, ing.unit || null, i);
    }

    // Replace proteins
    db.prepare('DELETE FROM recipe_protein_swaps WHERE recipe_id = ?').run(id);
    for (const protein of data.proteinSwaps) {
      db.prepare(
        'INSERT INTO recipe_protein_swaps (id, recipe_id, protein) VALUES (?, ?, ?)'
      ).run(nanoid(), id, protein);
    }

    // Replace tags
    db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').run(id);
    for (const tag of data.tags) {
      db.prepare(
        'INSERT INTO recipe_tags (id, recipe_id, tag) VALUES (?, ?, ?)'
      ).run(nanoid(), id, tag);
    }
  });

  update();
  return getRecipeById(id);
}

export function deleteRecipe(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  return result.changes > 0;
}
