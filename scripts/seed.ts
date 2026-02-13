/**
 * Seed script – run with: npx tsx scripts/seed.ts
 *
 * Populates the database with sample recipes, clients, and a default admin user
 * so the app is ready to demo immediately.
 */

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DATABASE_PATH
  || path.join(process.cwd(), 'data', 'menu-generator.db');

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Skip seeding if the database already exists and has data
if (fs.existsSync(DB_PATH)) {
  const existingDb = new Database(DB_PATH);
  const row = existingDb.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='recipes'").get() as { cnt: number };
  if (row.cnt > 0) {
    const recipeCount = existingDb.prepare("SELECT count(*) as cnt FROM recipes").get() as { cnt: number };
    if (recipeCount.cnt > 0) {
      console.log(`Database already seeded (${recipeCount.cnt} recipes). Skipping.`);
      existingDb.close();
      process.exit(0);
    }
  }
  existingDb.close();
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema (mirrors src/lib/schema.ts) ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    instructions  TEXT,
    cuisine_type  TEXT NOT NULL,
    item_type     TEXT NOT NULL DEFAULT 'meal',
    serving_size  INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id         TEXT PRIMARY KEY,
    recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    quantity   TEXT,
    unit       TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
  CREATE TABLE IF NOT EXISTS recipe_protein_swaps (
    id         TEXT PRIMARY KEY,
    recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    protein    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_recipe_proteins_recipe ON recipe_protein_swaps(recipe_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_protein_unique ON recipe_protein_swaps(recipe_id, protein);
  CREATE TABLE IF NOT EXISTS recipe_tags (
    id        TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe ON recipe_tags(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag ON recipe_tags(tag);
  CREATE TABLE IF NOT EXISTS clients (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    items_per_menu  INTEGER NOT NULL DEFAULT 5,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS client_proteins (
    id        TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    protein   TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_client_protein_unique ON client_proteins(client_id, protein);
  CREATE TABLE IF NOT EXISTS client_restrictions (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    restriction TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_client_restriction_unique ON client_restrictions(client_id, restriction);
  CREATE TABLE IF NOT EXISTS client_cuisine_preferences (
    id           TEXT PRIMARY KEY,
    client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    cuisine_type TEXT NOT NULL,
    weight       INTEGER NOT NULL DEFAULT 3
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_client_cuisine_unique ON client_cuisine_preferences(client_id, cuisine_type);
  CREATE TABLE IF NOT EXISTS client_menu_composition (
    id        TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    category  TEXT NOT NULL,
    count     INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_client_composition_unique ON client_menu_composition(client_id, category);
  CREATE TABLE IF NOT EXISTS menus (
    id          TEXT PRIMARY KEY,
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    finalized   INTEGER NOT NULL DEFAULT 0,
    week_label  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_menus_client ON menus(client_id);
  CREATE INDEX IF NOT EXISTS idx_menus_finalized ON menus(finalized);
  CREATE TABLE IF NOT EXISTS menu_items (
    id              TEXT PRIMARY KEY,
    menu_id         TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    recipe_id       TEXT NOT NULL REFERENCES recipes(id),
    selected_protein TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON menu_items(menu_id);
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
`);

// ── Helpers ──────────────────────────────────────────────────────────────────

interface RecipeSeed {
  name: string;
  description: string;
  instructions: string;
  cuisineType: string;
  itemType: string;
  servingSize: number;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  proteins: string[];
  tags: string[]; // "contains" tags — what the recipe contains (dairy, gluten, nuts, etc.)
}

function insertRecipe(r: RecipeSeed): string {
  const id = nanoid();
  db.prepare(
    `INSERT INTO recipes (id, name, description, instructions, cuisine_type, item_type, serving_size)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, r.name, r.description, r.instructions, r.cuisineType, r.itemType, r.servingSize);

  for (let i = 0; i < r.ingredients.length; i++) {
    const ing = r.ingredients[i];
    db.prepare(
      `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, unit, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(nanoid(), id, ing.name, ing.quantity || null, ing.unit || null, i);
  }

  for (const protein of r.proteins) {
    db.prepare(
      'INSERT INTO recipe_protein_swaps (id, recipe_id, protein) VALUES (?, ?, ?)'
    ).run(nanoid(), id, protein);
  }

  for (const tag of r.tags) {
    db.prepare(
      'INSERT INTO recipe_tags (id, recipe_id, tag) VALUES (?, ?, ?)'
    ).run(nanoid(), id, tag);
  }

  return id;
}

interface ClientSeed {
  name: string;
  notes: string;
  proteins: string[];
  restrictions: string[]; // free-text exclusions — what the client wants to avoid
  cuisinePreferences: Array<{ cuisineType: string; weight: number }>;
  menuComposition: Array<{ category: string; count: number }>;
}

function insertClient(c: ClientSeed): string {
  const id = nanoid();
  const itemsPerMenu = c.menuComposition.reduce((sum, comp) => sum + comp.count, 0);

  db.prepare(
    `INSERT INTO clients (id, name, items_per_menu, notes) VALUES (?, ?, ?, ?)`
  ).run(id, c.name, itemsPerMenu, c.notes || null);

  for (const protein of c.proteins) {
    db.prepare(
      'INSERT INTO client_proteins (id, client_id, protein) VALUES (?, ?, ?)'
    ).run(nanoid(), id, protein);
  }
  for (const restriction of c.restrictions) {
    db.prepare(
      'INSERT INTO client_restrictions (id, client_id, restriction) VALUES (?, ?, ?)'
    ).run(nanoid(), id, restriction);
  }
  for (const pref of c.cuisinePreferences) {
    db.prepare(
      'INSERT INTO client_cuisine_preferences (id, client_id, cuisine_type, weight) VALUES (?, ?, ?, ?)'
    ).run(nanoid(), id, pref.cuisineType, pref.weight);
  }
  for (const comp of c.menuComposition) {
    if (comp.count > 0) {
      db.prepare(
        'INSERT INTO client_menu_composition (id, client_id, category, count) VALUES (?, ?, ?, ?)'
      ).run(nanoid(), id, comp.category, comp.count);
    }
  }

  return id;
}

// ── Recipes ──────────────────────────────────────────────────────────────────
// Tags now represent what the recipe CONTAINS (e.g., 'dairy', 'gluten', 'nuts').
// If a client excludes 'dairy', any recipe tagged 'dairy' becomes ineligible.

const recipes: RecipeSeed[] = [
  // ─── MEALS ─────────────────────────────────────────────────────────────────
  {
    name: 'Chicken Burrito Bowl',
    description: 'A hearty burrito bowl with cilantro-lime rice, black beans, and fresh toppings.',
    instructions: '1. Cook rice with cilantro and lime. 2. Season and grill protein. 3. Warm black beans. 4. Assemble bowls with toppings.',
    cuisineType: 'mexican',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Rice', quantity: '2', unit: 'cups' },
      { name: 'Black beans', quantity: '1', unit: 'can' },
      { name: 'Cilantro', quantity: '1/4', unit: 'cup' },
      { name: 'Lime', quantity: '2', unit: '' },
      { name: 'Avocado', quantity: '1', unit: '' },
      { name: 'Salsa', quantity: '1/2', unit: 'cup' },
    ],
    proteins: ['chicken', 'steak', 'pork', 'tofu'],
    tags: ['cilantro'],
  },
  {
    name: 'Garlic Butter Pasta',
    description: 'Simple yet delicious garlic butter pasta with parmesan and fresh herbs.',
    instructions: '1. Cook pasta al dente. 2. Sauté garlic in butter. 3. Toss pasta with garlic butter, parmesan, and parsley.',
    cuisineType: 'italian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Spaghetti', quantity: '1', unit: 'lb' },
      { name: 'Butter', quantity: '4', unit: 'tbsp' },
      { name: 'Garlic', quantity: '6', unit: 'cloves' },
      { name: 'Parmesan', quantity: '1/2', unit: 'cup' },
      { name: 'Parsley', quantity: '2', unit: 'tbsp' },
    ],
    proteins: ['chicken', 'seafood', 'vegetarian'],
    tags: ['gluten', 'dairy'],
  },
  {
    name: 'Teriyaki Stir Fry',
    description: 'Quick stir fry with crisp vegetables and a sweet-savory teriyaki glaze.',
    instructions: '1. Slice vegetables. 2. Cook protein in hot wok. 3. Add vegetables and stir fry. 4. Pour in teriyaki sauce and toss.',
    cuisineType: 'asian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Broccoli', quantity: '2', unit: 'cups' },
      { name: 'Bell pepper', quantity: '2', unit: '' },
      { name: 'Carrot', quantity: '2', unit: '' },
      { name: 'Teriyaki sauce', quantity: '1/3', unit: 'cup' },
      { name: 'Rice', quantity: '2', unit: 'cups' },
      { name: 'Sesame seeds', quantity: '1', unit: 'tbsp' },
    ],
    proteins: ['chicken', 'steak', 'pork', 'tofu', 'seafood'],
    tags: ['soy'],
  },
  {
    name: 'Greek Salad Bowl',
    description: 'Fresh Mediterranean bowl with cucumbers, tomatoes, olives, and feta.',
    instructions: '1. Chop vegetables. 2. Combine with olives and feta. 3. Dress with olive oil and oregano. 4. Serve over greens.',
    cuisineType: 'mediterranean',
    itemType: 'meal',
    servingSize: 2,
    ingredients: [
      { name: 'Cucumber', quantity: '1', unit: '' },
      { name: 'Tomatoes', quantity: '2', unit: '' },
      { name: 'Kalamata olives', quantity: '1/3', unit: 'cup' },
      { name: 'Feta cheese', quantity: '1/2', unit: 'cup' },
      { name: 'Red onion', quantity: '1/4', unit: '' },
      { name: 'Olive oil', quantity: '2', unit: 'tbsp' },
    ],
    proteins: ['chicken', 'vegetarian'],
    tags: ['dairy', 'olives'],
  },
  {
    name: 'BBQ Pulled Pork Sliders',
    description: 'Smoky pulled pork sliders with tangy coleslaw on brioche buns.',
    instructions: '1. Slow cook pork with BBQ rub. 2. Shred and mix with BBQ sauce. 3. Make coleslaw. 4. Assemble sliders.',
    cuisineType: 'american',
    itemType: 'meal',
    servingSize: 6,
    ingredients: [
      { name: 'Pork shoulder', quantity: '3', unit: 'lbs' },
      { name: 'BBQ sauce', quantity: '1', unit: 'cup' },
      { name: 'Slider buns', quantity: '12', unit: '' },
      { name: 'Cabbage', quantity: '2', unit: 'cups' },
      { name: 'Apple cider vinegar', quantity: '2', unit: 'tbsp' },
    ],
    proteins: ['pork', 'chicken', 'steak'],
    tags: ['gluten'],
  },
  {
    name: 'Butter Chicken',
    description: 'Creamy, aromatic butter chicken with warm spices and basmati rice.',
    instructions: '1. Marinate chicken in yogurt and spices. 2. Cook in tomato-cream sauce. 3. Simmer until thickened. 4. Serve over basmati rice.',
    cuisineType: 'indian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Yogurt', quantity: '1/2', unit: 'cup' },
      { name: 'Tomato sauce', quantity: '1', unit: 'cup' },
      { name: 'Heavy cream', quantity: '1/2', unit: 'cup' },
      { name: 'Garam masala', quantity: '2', unit: 'tsp' },
      { name: 'Turmeric', quantity: '1', unit: 'tsp' },
      { name: 'Basmati rice', quantity: '2', unit: 'cups' },
    ],
    proteins: ['chicken', 'tofu'],
    tags: ['dairy'],
  },
  {
    name: 'Fish Tacos',
    description: 'Crispy fish tacos with mango salsa and chipotle crema.',
    instructions: '1. Season and pan-fry fish. 2. Prepare mango salsa. 3. Mix chipotle crema. 4. Assemble tacos with slaw.',
    cuisineType: 'mexican',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Corn tortillas', quantity: '8', unit: '' },
      { name: 'Mango', quantity: '1', unit: '' },
      { name: 'Red cabbage', quantity: '1', unit: 'cup' },
      { name: 'Sour cream', quantity: '1/4', unit: 'cup' },
      { name: 'Chipotle in adobo', quantity: '1', unit: 'tbsp' },
      { name: 'Lime', quantity: '2', unit: '' },
    ],
    proteins: ['seafood', 'chicken', 'tofu'],
    tags: ['dairy'],
  },
  {
    name: 'Margherita Pizza',
    description: 'Classic Neapolitan pizza with fresh mozzarella, basil, and San Marzano tomatoes.',
    instructions: '1. Stretch pizza dough. 2. Spread crushed tomatoes. 3. Add mozzarella slices. 4. Bake at 500F. 5. Top with fresh basil.',
    cuisineType: 'italian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Pizza dough', quantity: '1', unit: 'lb' },
      { name: 'San Marzano tomatoes', quantity: '1', unit: 'can' },
      { name: 'Fresh mozzarella', quantity: '8', unit: 'oz' },
      { name: 'Fresh basil', quantity: '1/4', unit: 'cup' },
      { name: 'Olive oil', quantity: '1', unit: 'tbsp' },
    ],
    proteins: ['vegetarian', 'chicken'],
    tags: ['gluten', 'dairy'],
  },
  {
    name: 'Thai Green Curry',
    description: 'Fragrant coconut curry with green beans, bamboo shoots, and Thai basil.',
    instructions: '1. Sauté curry paste in oil. 2. Add coconut milk and simmer. 3. Cook protein and vegetables. 4. Finish with basil and lime.',
    cuisineType: 'asian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Green curry paste', quantity: '3', unit: 'tbsp' },
      { name: 'Coconut milk', quantity: '1', unit: 'can' },
      { name: 'Green beans', quantity: '1', unit: 'cup' },
      { name: 'Bamboo shoots', quantity: '1/2', unit: 'cup' },
      { name: 'Thai basil', quantity: '1/4', unit: 'cup' },
      { name: 'Jasmine rice', quantity: '2', unit: 'cups' },
    ],
    proteins: ['chicken', 'tofu', 'seafood'],
    tags: [],
  },
  {
    name: 'Mediterranean Stuffed Peppers',
    description: 'Bell peppers stuffed with quinoa, sun-dried tomatoes, and herbs.',
    instructions: '1. Cook quinoa. 2. Mix with tomatoes, herbs, and cheese. 3. Stuff peppers. 4. Bake 25 minutes at 375F.',
    cuisineType: 'mediterranean',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Bell peppers', quantity: '4', unit: '' },
      { name: 'Quinoa', quantity: '1', unit: 'cup' },
      { name: 'Sun-dried tomatoes', quantity: '1/3', unit: 'cup' },
      { name: 'Feta cheese', quantity: '1/4', unit: 'cup' },
      { name: 'Oregano', quantity: '1', unit: 'tsp' },
      { name: 'Spinach', quantity: '2', unit: 'cups' },
    ],
    proteins: ['vegetarian', 'chicken'],
    tags: ['dairy', 'spinach'],
  },
  {
    name: 'Classic Cheeseburger',
    description: 'Juicy smash burgers with American cheese, lettuce, tomato, and special sauce.',
    instructions: '1. Form thin patties. 2. Smash on hot griddle. 3. Season and add cheese. 4. Assemble with toppings.',
    cuisineType: 'american',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Ground beef', quantity: '1.5', unit: 'lbs' },
      { name: 'American cheese', quantity: '4', unit: 'slices' },
      { name: 'Burger buns', quantity: '4', unit: '' },
      { name: 'Lettuce', quantity: '4', unit: 'leaves' },
      { name: 'Tomato', quantity: '1', unit: '' },
      { name: 'Pickles', quantity: '8', unit: 'slices' },
    ],
    proteins: ['steak', 'chicken', 'vegetarian'],
    tags: ['gluten', 'dairy', 'beef'],
  },
  {
    name: 'Chickpea Tikka Masala',
    description: 'Plant-based tikka masala with roasted chickpeas in a rich tomato-cream sauce.',
    instructions: '1. Roast chickpeas with spices. 2. Simmer tomato sauce with cream and spices. 3. Combine and serve over rice.',
    cuisineType: 'indian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Chickpeas', quantity: '2', unit: 'cans' },
      { name: 'Crushed tomatoes', quantity: '1', unit: 'can' },
      { name: 'Coconut cream', quantity: '1/2', unit: 'cup' },
      { name: 'Garam masala', quantity: '2', unit: 'tsp' },
      { name: 'Cumin', quantity: '1', unit: 'tsp' },
      { name: 'Basmati rice', quantity: '2', unit: 'cups' },
    ],
    proteins: ['tofu', 'vegetarian', 'chicken'],
    tags: [],
  },
  {
    name: 'Shrimp Ceviche',
    description: 'Zesty lime-cured shrimp with avocado, red onion, and jalapeño.',
    instructions: '1. Cook and chill shrimp. 2. Toss with lime, vegetables, and cilantro. 3. Serve with tostadas.',
    cuisineType: 'mexican',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Shrimp', quantity: '1', unit: 'lb' },
      { name: 'Lime juice', quantity: '1/2', unit: 'cup' },
      { name: 'Avocado', quantity: '1', unit: '' },
      { name: 'Red onion', quantity: '1/4', unit: '' },
      { name: 'Jalapeño', quantity: '1', unit: '' },
      { name: 'Cilantro', quantity: '1/4', unit: 'cup' },
    ],
    proteins: ['seafood'],
    tags: ['shrimp', 'shellfish', 'cilantro'],
  },
  {
    name: 'Pad Thai',
    description: 'Classic Thai rice noodles with tamarind sauce, peanuts, and bean sprouts.',
    instructions: '1. Soak rice noodles. 2. Stir fry protein and vegetables. 3. Add noodles and sauce. 4. Top with peanuts and lime.',
    cuisineType: 'asian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Rice noodles', quantity: '8', unit: 'oz' },
      { name: 'Tamarind paste', quantity: '2', unit: 'tbsp' },
      { name: 'Fish sauce', quantity: '2', unit: 'tbsp' },
      { name: 'Peanuts', quantity: '1/4', unit: 'cup' },
      { name: 'Bean sprouts', quantity: '1', unit: 'cup' },
      { name: 'Egg', quantity: '2', unit: '' },
      { name: 'Green onion', quantity: '3', unit: '' },
    ],
    proteins: ['chicken', 'tofu', 'seafood'],
    tags: ['nuts', 'eggs'],
  },
  {
    name: 'Korean Bibimbap',
    description: 'Colorful rice bowl with sautéed vegetables, gochujang sauce, and a fried egg.',
    instructions: '1. Cook rice. 2. Sauté vegetables separately. 3. Cook protein. 4. Assemble bowl and top with egg and gochujang.',
    cuisineType: 'asian',
    itemType: 'meal',
    servingSize: 2,
    ingredients: [
      { name: 'Rice', quantity: '2', unit: 'cups' },
      { name: 'Spinach', quantity: '2', unit: 'cups' },
      { name: 'Carrot', quantity: '1', unit: '' },
      { name: 'Zucchini', quantity: '1', unit: '' },
      { name: 'Gochujang', quantity: '2', unit: 'tbsp' },
      { name: 'Egg', quantity: '2', unit: '' },
      { name: 'Sesame oil', quantity: '1', unit: 'tbsp' },
    ],
    proteins: ['steak', 'chicken', 'pork', 'tofu'],
    tags: ['eggs', 'soy', 'spinach'],
  },
  {
    name: 'Lemon Herb Salmon',
    description: 'Pan-seared salmon with a bright lemon-herb butter sauce and roasted asparagus.',
    instructions: '1. Season salmon. 2. Pan-sear skin-side down. 3. Flip and add butter, lemon, and herbs. 4. Roast asparagus alongside.',
    cuisineType: 'mediterranean',
    itemType: 'meal',
    servingSize: 2,
    ingredients: [
      { name: 'Salmon fillets', quantity: '2', unit: '' },
      { name: 'Lemon', quantity: '1', unit: '' },
      { name: 'Butter', quantity: '2', unit: 'tbsp' },
      { name: 'Fresh dill', quantity: '2', unit: 'tbsp' },
      { name: 'Asparagus', quantity: '1', unit: 'bunch' },
      { name: 'Garlic', quantity: '3', unit: 'cloves' },
    ],
    proteins: ['seafood'],
    tags: ['dairy', 'salmon'],
  },
  {
    name: 'Carnitas Tacos',
    description: 'Tender, crispy-edged pork carnitas in warm tortillas with pickled onion and salsa verde.',
    instructions: '1. Slow cook pork with orange, cumin, and oregano. 2. Shred and crisp in a skillet. 3. Pickle red onions. 4. Serve in tortillas with salsa verde.',
    cuisineType: 'mexican',
    itemType: 'meal',
    servingSize: 6,
    ingredients: [
      { name: 'Pork shoulder', quantity: '3', unit: 'lbs' },
      { name: 'Orange', quantity: '1', unit: '' },
      { name: 'Cumin', quantity: '1', unit: 'tbsp' },
      { name: 'Corn tortillas', quantity: '12', unit: '' },
      { name: 'Red onion', quantity: '1', unit: '' },
      { name: 'Salsa verde', quantity: '1', unit: 'cup' },
    ],
    proteins: ['pork'],
    tags: ['cilantro'],
  },
  {
    name: 'Black Bean & Sweet Potato Tacos',
    description: 'Roasted sweet potato and seasoned black beans in corn tortillas with avocado crema.',
    instructions: '1. Roast cubed sweet potatoes with cumin and chili powder. 2. Warm black beans with garlic and lime. 3. Assemble tacos with avocado and pickled onion.',
    cuisineType: 'mexican',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Sweet potatoes', quantity: '2', unit: '' },
      { name: 'Black beans', quantity: '1', unit: 'can' },
      { name: 'Corn tortillas', quantity: '8', unit: '' },
      { name: 'Avocado', quantity: '1', unit: '' },
      { name: 'Lime', quantity: '1', unit: '' },
      { name: 'Cumin', quantity: '1', unit: 'tsp' },
    ],
    proteins: ['vegetarian', 'tofu'],
    tags: [],
  },
  {
    name: 'Coconut Lentil Dal',
    description: 'Creamy red lentil dal simmered in coconut milk with warming spices and served over rice.',
    instructions: '1. Sauté onion, garlic, and ginger. 2. Add lentils, coconut milk, and spices. 3. Simmer 25 minutes until lentils are tender. 4. Serve over basmati rice with fresh cilantro.',
    cuisineType: 'indian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Red lentils', quantity: '1.5', unit: 'cups' },
      { name: 'Coconut milk', quantity: '1', unit: 'can' },
      { name: 'Onion', quantity: '1', unit: '' },
      { name: 'Garlic', quantity: '4', unit: 'cloves' },
      { name: 'Ginger', quantity: '1', unit: 'tbsp' },
      { name: 'Turmeric', quantity: '1', unit: 'tsp' },
      { name: 'Basmati rice', quantity: '2', unit: 'cups' },
    ],
    proteins: ['vegetarian', 'tofu'],
    tags: [],
  },
  {
    name: 'Vegetable Fried Rice',
    description: 'Quick and flavorful fried rice packed with vegetables and seasoned with soy and sesame.',
    instructions: '1. Cook and cool rice. 2. Stir fry vegetables in a hot wok. 3. Add rice and soy sauce. 4. Toss until crispy.',
    cuisineType: 'asian',
    itemType: 'meal',
    servingSize: 4,
    ingredients: [
      { name: 'Rice', quantity: '3', unit: 'cups' },
      { name: 'Carrot', quantity: '1', unit: '' },
      { name: 'Peas', quantity: '1/2', unit: 'cup' },
      { name: 'Green onion', quantity: '3', unit: '' },
      { name: 'Soy sauce', quantity: '2', unit: 'tbsp' },
      { name: 'Sesame oil', quantity: '1', unit: 'tbsp' },
    ],
    proteins: ['vegetarian', 'tofu', 'chicken'],
    tags: ['soy'],
  },

  // ─── SAVORY SNACKS ─────────────────────────────────────────────────────────
  {
    name: 'Guacamole & Chips',
    description: 'Fresh guacamole with tortilla chips — a crowd-pleasing snack.',
    instructions: '1. Mash avocados. 2. Mix in lime, cilantro, onion, and jalapeño. 3. Serve with chips.',
    cuisineType: 'mexican',
    itemType: 'savory-snack',
    servingSize: 4,
    ingredients: [
      { name: 'Avocado', quantity: '3', unit: '' },
      { name: 'Lime', quantity: '1', unit: '' },
      { name: 'Cilantro', quantity: '2', unit: 'tbsp' },
      { name: 'Red onion', quantity: '1/4', unit: '' },
      { name: 'Tortilla chips', quantity: '1', unit: 'bag' },
    ],
    proteins: [],
    tags: ['cilantro'],
  },
  {
    name: 'Caprese Skewers',
    description: 'Bite-size skewers of fresh mozzarella, cherry tomatoes, and basil.',
    instructions: '1. Thread mozzarella, tomato, and basil onto picks. 2. Drizzle with balsamic glaze.',
    cuisineType: 'italian',
    itemType: 'savory-snack',
    servingSize: 6,
    ingredients: [
      { name: 'Cherry tomatoes', quantity: '1', unit: 'pint' },
      { name: 'Fresh mozzarella pearls', quantity: '8', unit: 'oz' },
      { name: 'Fresh basil', quantity: '1/4', unit: 'cup' },
      { name: 'Balsamic glaze', quantity: '2', unit: 'tbsp' },
    ],
    proteins: [],
    tags: ['dairy'],
  },
  {
    name: 'Edamame with Sea Salt',
    description: 'Steamed edamame pods tossed with flaky sea salt.',
    instructions: '1. Boil or steam edamame 5 minutes. 2. Drain and toss with sea salt.',
    cuisineType: 'asian',
    itemType: 'savory-snack',
    servingSize: 4,
    ingredients: [
      { name: 'Frozen edamame', quantity: '1', unit: 'lb' },
      { name: 'Sea salt', quantity: '1', unit: 'tsp' },
    ],
    proteins: [],
    tags: ['soy'],
  },
  {
    name: 'Hummus & Veggie Platter',
    description: 'Classic hummus served with fresh-cut vegetables and warm pita.',
    instructions: '1. Blend chickpeas, tahini, lemon, and garlic. 2. Slice vegetables. 3. Warm pita and serve.',
    cuisineType: 'mediterranean',
    itemType: 'savory-snack',
    servingSize: 6,
    ingredients: [
      { name: 'Chickpeas', quantity: '1', unit: 'can' },
      { name: 'Tahini', quantity: '2', unit: 'tbsp' },
      { name: 'Lemon', quantity: '1', unit: '' },
      { name: 'Garlic', quantity: '2', unit: 'cloves' },
      { name: 'Pita bread', quantity: '4', unit: '' },
      { name: 'Carrots', quantity: '2', unit: '' },
      { name: 'Cucumber', quantity: '1', unit: '' },
    ],
    proteins: [],
    tags: ['gluten'],
  },
  {
    name: 'Buffalo Cauliflower Bites',
    description: 'Crispy baked cauliflower florets coated in tangy buffalo sauce.',
    instructions: '1. Coat cauliflower in batter. 2. Bake at 425F for 20 min. 3. Toss in buffalo sauce. 4. Bake 10 more min.',
    cuisineType: 'american',
    itemType: 'savory-snack',
    servingSize: 4,
    ingredients: [
      { name: 'Cauliflower', quantity: '1', unit: 'head' },
      { name: 'Flour', quantity: '1/2', unit: 'cup' },
      { name: 'Hot sauce', quantity: '1/3', unit: 'cup' },
      { name: 'Butter', quantity: '2', unit: 'tbsp' },
    ],
    proteins: [],
    tags: ['gluten', 'dairy'],
  },
  {
    name: 'Samosas',
    description: 'Crispy pastry pockets stuffed with spiced potatoes and peas.',
    instructions: '1. Cook filling with potatoes, peas, and spices. 2. Wrap in pastry dough. 3. Bake or fry until golden.',
    cuisineType: 'indian',
    itemType: 'savory-snack',
    servingSize: 8,
    ingredients: [
      { name: 'Potatoes', quantity: '3', unit: '' },
      { name: 'Peas', quantity: '1/2', unit: 'cup' },
      { name: 'Cumin', quantity: '1', unit: 'tsp' },
      { name: 'Pastry sheets', quantity: '1', unit: 'pkg' },
      { name: 'Garam masala', quantity: '1', unit: 'tsp' },
    ],
    proteins: [],
    tags: ['gluten'],
  },
  {
    name: 'Spinach Artichoke Dip',
    description: 'Warm, cheesy spinach and artichoke dip served with toasted bread.',
    instructions: '1. Sauté spinach and chop artichokes. 2. Mix with cream cheese, sour cream, and parmesan. 3. Bake until bubbly. 4. Serve with bread.',
    cuisineType: 'american',
    itemType: 'savory-snack',
    servingSize: 6,
    ingredients: [
      { name: 'Spinach', quantity: '10', unit: 'oz' },
      { name: 'Artichoke hearts', quantity: '1', unit: 'can' },
      { name: 'Cream cheese', quantity: '8', unit: 'oz' },
      { name: 'Parmesan', quantity: '1/4', unit: 'cup' },
      { name: 'Sour cream', quantity: '1/4', unit: 'cup' },
      { name: 'Sourdough bread', quantity: '1', unit: 'loaf' },
    ],
    proteins: [],
    tags: ['dairy', 'gluten', 'spinach', 'artichokes'],
  },

  // ─── SWEET SNACKS ──────────────────────────────────────────────────────────
  {
    name: 'Fruit & Yogurt Parfait',
    description: 'Layers of Greek yogurt, fresh berries, and crunchy granola.',
    instructions: '1. Layer yogurt, berries, and granola in glasses. 2. Drizzle with honey. 3. Repeat layers.',
    cuisineType: 'american',
    itemType: 'sweet-snack',
    servingSize: 4,
    ingredients: [
      { name: 'Greek yogurt', quantity: '2', unit: 'cups' },
      { name: 'Mixed berries', quantity: '2', unit: 'cups' },
      { name: 'Granola', quantity: '1', unit: 'cup' },
      { name: 'Honey', quantity: '2', unit: 'tbsp' },
    ],
    proteins: [],
    tags: ['dairy', 'gluten', 'honey'],
  },
  {
    name: 'Dark Chocolate Energy Bites',
    description: 'No-bake energy bites with oats, peanut butter, dark chocolate, and flax.',
    instructions: '1. Mix oats, peanut butter, honey, chocolate chips, and flax. 2. Roll into balls. 3. Chill 30 minutes.',
    cuisineType: 'american',
    itemType: 'sweet-snack',
    servingSize: 12,
    ingredients: [
      { name: 'Rolled oats', quantity: '1', unit: 'cup' },
      { name: 'Peanut butter', quantity: '1/2', unit: 'cup' },
      { name: 'Honey', quantity: '1/3', unit: 'cup' },
      { name: 'Dark chocolate chips', quantity: '1/3', unit: 'cup' },
      { name: 'Ground flaxseed', quantity: '2', unit: 'tbsp' },
    ],
    proteins: [],
    tags: ['nuts', 'honey'],
  },
  {
    name: 'Banana Oat Muffins',
    description: 'Moist banana muffins made with whole wheat flour and a touch of maple syrup.',
    instructions: '1. Mash bananas. 2. Mix wet ingredients. 3. Fold in flour and oats. 4. Bake at 350F for 20 minutes.',
    cuisineType: 'american',
    itemType: 'sweet-snack',
    servingSize: 12,
    ingredients: [
      { name: 'Ripe bananas', quantity: '3', unit: '' },
      { name: 'Whole wheat flour', quantity: '1.5', unit: 'cups' },
      { name: 'Rolled oats', quantity: '1/2', unit: 'cup' },
      { name: 'Maple syrup', quantity: '1/4', unit: 'cup' },
      { name: 'Egg', quantity: '1', unit: '' },
      { name: 'Coconut oil', quantity: '1/4', unit: 'cup' },
    ],
    proteins: [],
    tags: ['gluten', 'eggs', 'maple syrup'],
  },
  {
    name: 'Mango Coconut Chia Pudding',
    description: 'Creamy chia pudding with coconut milk and fresh mango.',
    instructions: '1. Mix chia seeds with coconut milk and sweetener. 2. Refrigerate overnight. 3. Top with diced mango.',
    cuisineType: 'asian',
    itemType: 'sweet-snack',
    servingSize: 4,
    ingredients: [
      { name: 'Chia seeds', quantity: '1/4', unit: 'cup' },
      { name: 'Coconut milk', quantity: '1', unit: 'cup' },
      { name: 'Mango', quantity: '1', unit: '' },
      { name: 'Agave', quantity: '1', unit: 'tbsp' },
    ],
    proteins: [],
    tags: ['agave'],
  },
];

// ── Clients ──────────────────────────────────────────────────────────────────
// Restrictions now list what the client wants to EXCLUDE (free-text).
// Menu composition specifies exactly how many of each protein/snack type.

const clients: ClientSeed[] = [
  {
    name: 'Sarah Johnson',
    notes: 'Prefers lighter meals during the week. Loves trying new cuisines. No dairy, no mushrooms.',
    proteins: ['chicken', 'seafood', 'vegetarian'],
    restrictions: ['dairy', 'mushrooms'],
    cuisinePreferences: [
      { cuisineType: 'asian', weight: 5 },
      { cuisineType: 'mediterranean', weight: 4 },
      { cuisineType: 'mexican', weight: 3 },
      { cuisineType: 'italian', weight: 2 },
    ],
    menuComposition: [
      { category: 'chicken', count: 2 },
      { category: 'seafood', count: 2 },
      { category: 'vegetarian', count: 1 },
      { category: 'savory-snack', count: 1 },
      { category: 'sweet-snack', count: 1 },
    ],
  },
  {
    name: 'Mike Chen',
    notes: 'Family of four. Needs high-volume recipes. Kids love Italian and American. No restrictions.',
    proteins: ['chicken', 'steak', 'pork', 'seafood'],
    restrictions: [],
    cuisinePreferences: [
      { cuisineType: 'italian', weight: 5 },
      { cuisineType: 'american', weight: 5 },
      { cuisineType: 'asian', weight: 3 },
      { cuisineType: 'mexican', weight: 4 },
    ],
    menuComposition: [
      { category: 'chicken', count: 2 },
      { category: 'steak', count: 1 },
      { category: 'pork', count: 1 },
      { category: 'seafood', count: 1 },
      { category: 'savory-snack', count: 2 },
      { category: 'sweet-snack', count: 1 },
    ],
  },
  {
    name: 'Emma Rodriguez',
    notes: 'Plant-based athlete. No dairy, no eggs, no honey, no processed ingredients. High-protein vegan meals.',
    proteins: ['tofu', 'vegetarian'],
    restrictions: ['dairy', 'eggs', 'honey', 'processed ingredients'],
    cuisinePreferences: [
      { cuisineType: 'indian', weight: 5 },
      { cuisineType: 'asian', weight: 4 },
      { cuisineType: 'mexican', weight: 4 },
      { cuisineType: 'mediterranean', weight: 3 },
    ],
    menuComposition: [
      { category: 'tofu', count: 2 },
      { category: 'vegetarian', count: 2 },
      { category: 'savory-snack', count: 1 },
    ],
  },
];

// ── Run seed in a transaction ────────────────────────────────────────────────

const existingRecipeCount = (db.prepare('SELECT COUNT(*) as c FROM recipes').get() as { c: number }).c;
const existingClientCount = (db.prepare('SELECT COUNT(*) as c FROM clients').get() as { c: number }).c;

if (existingRecipeCount > 0 || existingClientCount > 0) {
  console.log(`Database already has ${existingRecipeCount} recipes and ${existingClientCount} clients.`);
  console.log('Skipping seed to avoid duplicates. Delete data/menu-generator.db to re-seed.');
  process.exit(0);
}

const seed = db.transaction(() => {
  const recipeIds: string[] = [];
  for (const recipe of recipes) {
    recipeIds.push(insertRecipe(recipe));
  }
  console.log(`Inserted ${recipeIds.length} recipes.`);

  const clientIds: string[] = [];
  for (const client of clients) {
    clientIds.push(insertClient(client));
  }
  console.log(`Inserted ${clientIds.length} clients.`);

  // Create default admin user
  const adminId = nanoid();
  const passwordHash = bcrypt.hashSync('changeme', 12);
  db.prepare(
    'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)'
  ).run(adminId, 'admin', passwordHash);
  console.log('Created default admin user (username: admin, password: changeme).');
});

seed();
console.log('Seed complete!');
db.close();
