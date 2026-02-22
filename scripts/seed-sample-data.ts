/**
 * Seed sample data for manual testing.
 *
 * Creates 20 sample recipes and 8 sample clients covering all engine edge cases:
 *   - Clean recipes (no restrictions) — always eligible
 *   - Dairy restriction: core with swap, optional omit, core NO swap (excluded), dual swap
 *   - Gluten restriction: core with swap, optional omit, core NO swap (excluded)
 *   - Egg restriction: core with swap, garnish omit
 *   - Nut restriction: core with swap, optional omit
 *   - Multi-protein recipes (4 options, 3 options)
 *   - Snacks (sweet-snack, savory-snack)
 *
 * All names prefixed with [SAMPLE] for easy identification and cleanup.
 * Idempotent: skips if [SAMPLE] data already exists.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/seed-sample-data.ts
 *
 * Removal (when done testing):
 *   DATABASE_URL=<url> npx tsx scripts/seed-sample-data.ts --remove
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { nanoid } from 'nanoid';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────

function id() { return nanoid(); }

interface IngredientInput {
  name: string;
  quantity?: string;
  unit?: string;
  role?: 'core' | 'optional' | 'garnish';
  swaps?: Array<{
    substituteIngredient: string;
    substituteQty?: string;
    substituteUnit?: string;
    restriction: string;
    priority?: number;
  }>;
}

interface RecipeInput {
  name: string;
  description?: string;
  cuisineType: string;
  itemType?: string;
  servingSize?: number;
  ingredients: IngredientInput[];
  proteinSwaps?: string[];
  tags?: string[];
}

async function createRecipe(data: RecipeInput) {
  const recipeId = id();
  const ingredientIds: { name: string; ingId: string; swaps: IngredientInput['swaps'] }[] = [];

  await prisma.recipe.create({
    data: {
      id: recipeId,
      name: data.name,
      description: data.description ?? null,
      instructions: null,
      cuisineType: data.cuisineType,
      itemType: data.itemType ?? 'meal',
      servingSize: data.servingSize ?? 4,
      recipeKeeperUrl: null,
      ingredients: {
        create: data.ingredients.map((ing, i) => {
          const ingId = id();
          ingredientIds.push({ name: ing.name, ingId, swaps: ing.swaps ?? [] });
          return {
            id: ingId,
            name: ing.name,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
            role: ing.role ?? 'core',
            sortOrder: i,
          };
        }),
      },
      proteinSwaps: {
        create: (data.proteinSwaps ?? []).map((protein) => ({
          id: id(),
          protein,
        })),
      },
      tags: {
        create: (data.tags ?? []).map((tag) => ({
          id: id(),
          tag,
        })),
      },
    },
  });

  // Create swaps after ingredients exist
  for (const { ingId, swaps } of ingredientIds) {
    for (const swap of swaps ?? []) {
      await prisma.ingredientSwap.create({
        data: {
          id: id(),
          recipeIngredientId: ingId,
          substituteIngredient: swap.substituteIngredient,
          substituteQty: swap.substituteQty ?? null,
          substituteUnit: swap.substituteUnit ?? null,
          restriction: swap.restriction,
          priority: swap.priority ?? 1,
        },
      });
    }
  }

  return recipeId;
}

interface ClientInput {
  name: string;
  itemsPerMenu?: number;
  servingsPerDish?: number;
  dishCount?: number;
  notes?: string;
  proteins: string[];
  restrictions?: string[];
  cuisinePreferences?: Array<{ cuisineType: string; weight: number }>;
  menuComposition?: Array<{ category: string; count: number }>;
}

async function createClient(data: ClientInput) {
  const compositionTotal = (data.menuComposition ?? []).reduce((s, c) => s + c.count, 0);
  return prisma.client.create({
    data: {
      id: id(),
      name: data.name,
      itemsPerMenu: compositionTotal > 0 ? compositionTotal : (data.itemsPerMenu ?? 5),
      servingsPerDish: data.servingsPerDish ?? 4,
      dishCount: data.dishCount ?? 5,
      notes: data.notes ?? null,
      chefNotes: null,
      proteins: {
        create: data.proteins.map((protein) => ({ id: id(), protein })),
      },
      restrictions: {
        create: (data.restrictions ?? []).map((restriction) => ({ id: id(), restriction })),
      },
      cuisinePreferences: {
        create: (data.cuisinePreferences ?? []).map((cp) => ({
          id: id(),
          cuisineType: cp.cuisineType,
          weight: cp.weight,
        })),
      },
      menuComposition: {
        create: (data.menuComposition ?? [])
          .filter((c) => c.count > 0)
          .map((c) => ({ id: id(), category: c.category, count: c.count })),
      },
    },
  });
}

// ── Remove mode ───────────────────────────────────────────────────────────────

async function remove() {
  const recipes = await prisma.recipe.deleteMany({ where: { name: { startsWith: '[SAMPLE]' } } });
  const clients = await prisma.client.deleteMany({ where: { name: { startsWith: '[SAMPLE]' } } });
  console.log(`✓ Removed ${recipes.count} sample recipes and ${clients.count} sample clients.`);
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  // Idempotency check
  const existing = await prisma.recipe.count({ where: { name: { startsWith: '[SAMPLE]' } } });
  if (existing > 0) {
    console.log(`⚠️  ${existing} [SAMPLE] recipes already exist. Skipping. Run with --remove first to re-seed.`);
    return;
  }

  console.log('Seeding sample data...\n');

  // ────────────────────────────────────────────────────────────────────────────
  // GROUP 1: Clean recipes — no restrictions (always eligible for any client)
  // ────────────────────────────────────────────────────────────────────────────

  await createRecipe({
    name: '[SAMPLE] Simple Roast Chicken',
    description: 'A classic roast chicken with herbs and garlic. No restrictions.',
    cuisineType: 'american',
    proteinSwaps: ['chicken'],
    tags: ['chicken'],
    ingredients: [
      { name: 'chicken', quantity: '1', unit: 'whole', role: 'core' },
      { name: 'garlic', quantity: '4', unit: 'cloves', role: 'core' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp', role: 'core' },
      { name: 'rosemary', quantity: '2', unit: 'sprigs', role: 'optional' },
      { name: 'lemon', quantity: '1', unit: 'whole', role: 'optional' },
    ],
  });

  await createRecipe({
    name: '[SAMPLE] Beef Stir Fry',
    description: 'Quick beef stir fry with vegetables. No restrictions.',
    cuisineType: 'asian',
    proteinSwaps: ['steak'],
    tags: ['steak'],
    ingredients: [
      { name: 'steak', quantity: '1', unit: 'lb', role: 'core' },
      { name: 'broccoli', quantity: '2', unit: 'cups', role: 'core' },
      { name: 'bell pepper', quantity: '1', unit: 'whole', role: 'core' },
      { name: 'sesame oil', quantity: '1', unit: 'tbsp', role: 'core' },
      { name: 'ginger', quantity: '1', unit: 'tsp', role: 'core' },
      { name: 'garlic', quantity: '3', unit: 'cloves', role: 'core' },
    ],
  });

  await createRecipe({
    name: '[SAMPLE] Salmon with Lemon',
    description: 'Simple baked salmon with lemon and herbs. No restrictions.',
    cuisineType: 'mediterranean',
    proteinSwaps: ['salmon'],
    tags: ['salmon'],
    ingredients: [
      { name: 'salmon fillet', quantity: '4', unit: 'oz', role: 'core' },
      { name: 'lemon', quantity: '1', unit: 'whole', role: 'core' },
      { name: 'dill', quantity: '2', unit: 'tbsp', role: 'optional' },
      { name: 'olive oil', quantity: '1', unit: 'tbsp', role: 'core' },
      { name: 'capers', quantity: '1', unit: 'tbsp', role: 'garnish' },
    ],
  });

  await createRecipe({
    name: '[SAMPLE] Veggie Fried Rice',
    description: 'Vegetable fried rice — works with tofu or as vegetarian. No restrictions.',
    cuisineType: 'asian',
    proteinSwaps: ['tofu', 'vegetarian'],
    tags: ['tofu', 'vegetarian'],
    ingredients: [
      { name: 'tofu', quantity: '8', unit: 'oz', role: 'core' },
      { name: 'brown rice', quantity: '2', unit: 'cups', role: 'core' },
      { name: 'peas', quantity: '1', unit: 'cup', role: 'core' },
      { name: 'carrots', quantity: '2', unit: 'whole', role: 'core' },
      { name: 'soy sauce', quantity: '2', unit: 'tbsp', role: 'core' },
      { name: 'sesame oil', quantity: '1', unit: 'tbsp', role: 'core' },
    ],
  });

  await createRecipe({
    name: '[SAMPLE] Pork Tenderloin',
    description: 'Herb-crusted pork tenderloin. No restrictions.',
    cuisineType: 'american',
    proteinSwaps: ['pork'],
    tags: ['pork'],
    ingredients: [
      { name: 'pork tenderloin', quantity: '1', unit: 'lb', role: 'core' },
      { name: 'garlic', quantity: '3', unit: 'cloves', role: 'core' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp', role: 'core' },
      { name: 'thyme', quantity: '1', unit: 'tsp', role: 'optional' },
      { name: 'dijon mustard', quantity: '1', unit: 'tbsp', role: 'optional' },
    ],
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GROUP 2: Dairy restriction edge cases
  // Engine uses word-boundary match: ingredient name must contain the word 'dairy'
  // ────────────────────────────────────────────────────────────────────────────

  // Recipe 6: Core dairy ingredient WITH swap → ELIGIBLE for dairy-free clients (swap applied)
  await createRecipe({
    name: '[SAMPLE] Creamy Pasta',
    description: 'Pasta with a rich cream sauce. Core dairy ingredient has a swap for dairy-free clients.',
    cuisineType: 'italian',
    proteinSwaps: ['chicken'],
    tags: ['chicken', 'dairy'],
    ingredients: [
      { name: 'chicken breast', quantity: '1', unit: 'lb', role: 'core' },
      { name: 'pasta', quantity: '8', unit: 'oz', role: 'core' },
      {
        name: 'dairy cream',
        quantity: '1',
        unit: 'cup',
        role: 'core',
        swaps: [{ substituteIngredient: 'coconut cream', substituteQty: '1', substituteUnit: 'cup', restriction: 'dairy', priority: 2 }],
      },
      { name: 'garlic', quantity: '3', unit: 'cloves', role: 'core' },
      { name: 'parsley', quantity: '2', unit: 'tbsp', role: 'garnish' },
    ],
  });

  // Recipe 7: Optional dairy ingredient, no swap → ELIGIBLE, omit note added
  await createRecipe({
    name: '[SAMPLE] Cheesy Chicken',
    description: 'Grilled chicken with an optional dairy cheese garnish. Dairy clients get the omit note.',
    cuisineType: 'american',
    proteinSwaps: ['chicken'],
    tags: ['chicken', 'dairy'],
    ingredients: [
      { name: 'chicken thigh', quantity: '1.5', unit: 'lbs', role: 'core' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp', role: 'core' },
      { name: 'paprika', quantity: '1', unit: 'tsp', role: 'core' },
      { name: 'dairy cheese garnish', quantity: '2', unit: 'tbsp', role: 'optional' },
    ],
  });

  // Recipe 8: Core dairy ingredient, NO swap → EXCLUDED for dairy-free clients
  await createRecipe({
    name: '[SAMPLE] Butter Chicken No Swap',
    description: 'Traditional butter chicken — core dairy butter with no swap. EXCLUDED for dairy-free clients.',
    cuisineType: 'indian',
    proteinSwaps: ['chicken'],
    tags: ['chicken', 'dairy'],
    ingredients: [
      { name: 'chicken thigh', quantity: '1.5', unit: 'lbs', role: 'core' },
      { name: 'tomato sauce', quantity: '1', unit: 'cup', role: 'core' },
      { name: 'dairy butter', quantity: '3', unit: 'tbsp', role: 'core' /* NO swaps */ },
      { name: 'garam masala', quantity: '1', unit: 'tsp', role: 'core' },
      { name: 'ginger', quantity: '1', unit: 'tsp', role: 'core' },
    ],
  });

  // Recipe 9: Two core dairy ingredients, each with a swap (dual swap scenario)
  await createRecipe({
    name: '[SAMPLE] Mac and Cheese Dual Swap',
    description: 'Mac and cheese with two dairy ingredients — both have swaps. Tests dual swap logic.',
    cuisineType: 'american',
    tags: ['dairy'],
    ingredients: [
      { name: 'pasta', quantity: '8', unit: 'oz', role: 'core' },
      {
        name: 'dairy milk',
        quantity: '2',
        unit: 'cups',
        role: 'core',
        swaps: [{ substituteIngredient: 'oat milk', substituteQty: '2', substituteUnit: 'cups', restriction: 'dairy', priority: 1 }],
      },
      {
        name: 'dairy cheese',
        quantity: '1',
        unit: 'cup',
        role: 'core',
        swaps: [{ substituteIngredient: 'vegan cheese', substituteQty: '1', substituteUnit: 'cup', restriction: 'dairy', priority: 2 }],
      },
      { name: 'butter', quantity: '2', unit: 'tbsp', role: 'optional' },
    ],
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GROUP 3: Gluten restriction edge cases
  // ────────────────────────────────────────────────────────────────────────────

  // Recipe 10: Core gluten ingredient WITH swap → ELIGIBLE for gluten-free clients
  await createRecipe({
    name: '[SAMPLE] Pasta Bowl Gluten Swap',
    description: 'Pasta bowl — core gluten pasta has a swap for gluten-free clients.',
    cuisineType: 'italian',
    proteinSwaps: ['chicken'],
    tags: ['chicken', 'gluten'],
    ingredients: [
      { name: 'chicken breast', quantity: '1', unit: 'lb', role: 'core' },
      {
        name: 'gluten pasta',
        quantity: '8',
        unit: 'oz',
        role: 'core',
        swaps: [{ substituteIngredient: 'rice pasta', substituteQty: '8', substituteUnit: 'oz', restriction: 'gluten', priority: 1 }],
      },
      { name: 'tomato sauce', quantity: '1', unit: 'cup', role: 'core' },
      { name: 'basil', quantity: '2', unit: 'tbsp', role: 'garnish' },
    ],
  });

  // Recipe 11: Optional gluten ingredient → ELIGIBLE, omit note
  await createRecipe({
    name: '[SAMPLE] Teriyaki Bowl',
    description: 'Teriyaki chicken bowl. Optional gluten soy sauce can be omitted for gluten-free clients.',
    cuisineType: 'asian',
    proteinSwaps: ['chicken'],
    tags: ['chicken', 'gluten'],
    ingredients: [
      { name: 'chicken thigh', quantity: '1.5', unit: 'lbs', role: 'core' },
      { name: 'rice', quantity: '2', unit: 'cups', role: 'core' },
      { name: 'gluten soy sauce', quantity: '3', unit: 'tbsp', role: 'optional' },
      { name: 'sesame seeds', quantity: '1', unit: 'tbsp', role: 'garnish' },
      { name: 'ginger', quantity: '1', unit: 'tsp', role: 'core' },
    ],
  });

  // Recipe 12: Core gluten ingredient, NO swap → EXCLUDED for gluten-free clients
  await createRecipe({
    name: '[SAMPLE] Flour Tacos No Swap',
    description: 'Flour tortilla tacos — core gluten flour tortilla with no swap. EXCLUDED for gluten-free clients.',
    cuisineType: 'mexican',
    proteinSwaps: ['chicken', 'steak'],
    tags: ['chicken', 'steak', 'gluten'],
    ingredients: [
      { name: 'chicken breast', quantity: '1', unit: 'lb', role: 'core' },
      { name: 'gluten flour tortilla', quantity: '8', unit: 'count', role: 'core' /* NO swap */ },
      { name: 'salsa', quantity: '½', unit: 'cup', role: 'core' },
      { name: 'lime', quantity: '1', unit: 'whole', role: 'optional' },
      { name: 'cilantro', quantity: '2', unit: 'tbsp', role: 'garnish' },
    ],
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GROUP 4: Egg restriction edge cases
  // 'eggs' restriction matches ingredient name 'eggs' exactly (word boundary)
  // ────────────────────────────────────────────────────────────────────────────

  // Recipe 13: Core eggs WITH swap → ELIGIBLE for egg-free clients
  await createRecipe({
    name: '[SAMPLE] Frittata Egg Swap',
    description: 'Italian frittata — core eggs have a tofu scramble swap for egg-free clients.',
    cuisineType: 'italian',
    tags: ['eggs'],
    ingredients: [
      {
        name: 'eggs',
        quantity: '6',
        unit: 'count',
        role: 'core',
        swaps: [{ substituteIngredient: 'tofu scramble', substituteQty: '8', substituteUnit: 'oz', restriction: 'eggs', priority: 1 }],
      },
      { name: 'spinach', quantity: '2', unit: 'cups', role: 'core' },
      { name: 'cherry tomatoes', quantity: '1', unit: 'cup', role: 'core' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp', role: 'core' },
      { name: 'feta cheese', quantity: '¼', unit: 'cup', role: 'optional' },
    ],
  });

  // Recipe 14: Garnish eggs, NO swap → ELIGIBLE, omit note
  await createRecipe({
    name: '[SAMPLE] Caesar Salad Egg Garnish',
    description: 'Caesar salad with egg garnish. Egg clients get an omit note — recipe remains eligible.',
    cuisineType: 'american',
    proteinSwaps: ['chicken'],
    tags: ['chicken', 'eggs'],
    ingredients: [
      { name: 'romaine lettuce', quantity: '1', unit: 'head', role: 'core' },
      { name: 'chicken breast', quantity: '1', unit: 'lb', role: 'core' },
      { name: 'parmesan', quantity: '¼', unit: 'cup', role: 'optional' },
      { name: 'eggs', quantity: '2', unit: 'count', role: 'garnish' /* no swap — garnish triggers omit, not hard-block */ },
      { name: 'croutons', quantity: '½', unit: 'cup', role: 'optional' },
    ],
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GROUP 5: Nut restriction edge cases
  // IMPORTANT: word-boundary regex \bnuts?\b matches "nuts", "nut", "mixed nuts"
  // but does NOT match "peanuts" or "walnuts" (no boundary inside compound words).
  // Use "mixed nuts", "sliced nuts", "nut butter" as ingredient names.
  // ────────────────────────────────────────────────────────────────────────────

  // Recipe 15: Core nuts WITH swap → ELIGIBLE for nut-free clients
  await createRecipe({
    name: '[SAMPLE] Thai Nut Noodles',
    description: 'Thai noodles with mixed nuts — has a sunflower seed swap for nut-free clients.',
    cuisineType: 'asian',
    proteinSwaps: ['chicken'],
    tags: ['chicken'],
    ingredients: [
      { name: 'chicken breast', quantity: '1', unit: 'lb', role: 'core' },
      { name: 'rice noodles', quantity: '8', unit: 'oz', role: 'core' },
      { name: 'coconut milk', quantity: '1', unit: 'cup', role: 'core' },
      {
        name: 'mixed nuts',
        quantity: '¼',
        unit: 'cup',
        role: 'core',
        swaps: [{ substituteIngredient: 'sunflower seeds', substituteQty: '¼', substituteUnit: 'cup', restriction: 'nuts', priority: 1 }],
      },
      { name: 'lime', quantity: '1', unit: 'whole', role: 'optional' },
    ],
  });

  // Recipe 16: Optional nuts, NO swap → ELIGIBLE, omit note
  await createRecipe({
    name: '[SAMPLE] Almond Cake Optional Nuts',
    description: 'Cake with optional sliced nuts on top. Nut-free clients get omit note.',
    cuisineType: 'other',
    itemType: 'sweet-snack',
    ingredients: [
      { name: 'flour', quantity: '2', unit: 'cups', role: 'core' },
      { name: 'sugar', quantity: '1', unit: 'cup', role: 'core' },
      { name: 'olive oil', quantity: '½', unit: 'cup', role: 'core' },
      { name: 'sliced nuts', quantity: '¼', unit: 'cup', role: 'optional' /* no swap — optional triggers omit */ },
      { name: 'vanilla extract', quantity: '1', unit: 'tsp', role: 'core' },
    ],
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GROUP 6: Multi-protein recipes
  // ────────────────────────────────────────────────────────────────────────────

  // Recipe 17: 4-protein recipe
  await createRecipe({
    name: '[SAMPLE] Protein Bowl',
    description: 'Versatile grain bowl — works with chicken, steak, tofu, or vegetarian.',
    cuisineType: 'american',
    proteinSwaps: ['chicken', 'steak', 'tofu', 'vegetarian'],
    tags: ['chicken', 'steak', 'tofu', 'vegetarian'],
    ingredients: [
      { name: 'chicken', quantity: '1', unit: 'lb', role: 'core' },
      { name: 'quinoa', quantity: '1', unit: 'cup', role: 'core' },
      { name: 'roasted vegetables', quantity: '2', unit: 'cups', role: 'core' },
      { name: 'tahini dressing', quantity: '3', unit: 'tbsp', role: 'core' },
      { name: 'avocado', quantity: '1', unit: 'whole', role: 'optional' },
    ],
  });

  // Recipe 18: 3-protein seafood/steak recipe
  await createRecipe({
    name: '[SAMPLE] Surf and Turf',
    description: 'Elegant surf and turf — choose salmon, shrimp, or steak.',
    cuisineType: 'american',
    proteinSwaps: ['salmon', 'shrimp', 'steak'],
    tags: ['salmon', 'shrimp', 'steak'],
    ingredients: [
      { name: 'salmon fillet', quantity: '6', unit: 'oz', role: 'core' },
      { name: 'asparagus', quantity: '1', unit: 'bunch', role: 'core' },
      { name: 'garlic butter', quantity: '2', unit: 'tbsp', role: 'core' },
      { name: 'lemon', quantity: '1', unit: 'whole', role: 'optional' },
    ],
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GROUP 7: Snacks
  // ────────────────────────────────────────────────────────────────────────────

  await createRecipe({
    name: '[SAMPLE] Energy Bites',
    description: 'No-bake energy bites — sweet snack with oats and honey.',
    cuisineType: 'american',
    itemType: 'sweet-snack',
    ingredients: [
      { name: 'rolled oats', quantity: '1', unit: 'cup', role: 'core' },
      { name: 'honey', quantity: '⅓', unit: 'cup', role: 'core' },
      { name: 'chocolate chips', quantity: '½', unit: 'cup', role: 'optional' },
      { name: 'chia seeds', quantity: '2', unit: 'tbsp', role: 'optional' },
    ],
  });

  await createRecipe({
    name: '[SAMPLE] Veggie Chips',
    description: 'Baked veggie chips — savory snack with kale and sweet potato.',
    cuisineType: 'american',
    itemType: 'savory-snack',
    ingredients: [
      { name: 'kale', quantity: '2', unit: 'cups', role: 'core' },
      { name: 'sweet potato', quantity: '1', unit: 'large', role: 'core' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp', role: 'core' },
      { name: 'sea salt', quantity: '1', unit: 'tsp', role: 'core' },
    ],
  });

  // ────────────────────────────────────────────────────────────────────────────
  // CLIENTS
  // ────────────────────────────────────────────────────────────────────────────

  // Client 1: Control — no restrictions, mixed proteins
  await createClient({
    name: '[SAMPLE] Control Client',
    notes: 'No dietary restrictions. Should see all clean recipes plus any restricted recipes with swaps/omits.',
    proteins: ['chicken', 'steak', 'salmon'],
    restrictions: [],
    itemsPerMenu: 5,
  });

  // Client 2: Dairy free — tests swap and exclusion logic
  await createClient({
    name: '[SAMPLE] Dairy Free Client',
    notes: 'Dairy restriction. Creamy Pasta and Mac and Cheese should appear with swap notes. Butter Chicken No Swap should be EXCLUDED.',
    proteins: ['chicken', 'pork'],
    restrictions: ['dairy'],
    itemsPerMenu: 5,
  });

  // Client 3: Gluten free — tests gluten swap and exclusion
  await createClient({
    name: '[SAMPLE] Gluten Free Client',
    notes: 'Gluten restriction. Pasta Bowl should appear with swap. Flour Tacos should be EXCLUDED.',
    proteins: ['chicken', 'steak'],
    restrictions: ['gluten'],
    itemsPerMenu: 5,
  });

  // Client 4: Egg free — tests egg swap and garnish omit
  await createClient({
    name: '[SAMPLE] Egg Free Client',
    notes: 'Egg restriction. Frittata should appear with tofu scramble swap. Caesar Salad should appear with garnish omit note.',
    proteins: ['tofu', 'vegetarian'],
    restrictions: ['eggs'],
    itemsPerMenu: 5,
  });

  // Client 5: Nut free — tests nut matching
  await createClient({
    name: '[SAMPLE] Nut Free Client',
    notes: 'Nut restriction. Thai Nut Noodles should appear with sunflower seed swap. Almond Cake should appear with omit note.',
    proteins: ['chicken', 'salmon'],
    restrictions: ['nuts'],
    itemsPerMenu: 5,
  });

  // Client 6: Multi-restriction — dairy AND gluten
  await createClient({
    name: '[SAMPLE] Multi-Restriction Client',
    notes: 'Both dairy and gluten restrictions. Both sets of rules apply simultaneously.',
    proteins: ['chicken'],
    restrictions: ['dairy', 'gluten'],
    itemsPerMenu: 5,
  });

  // Client 7: Cuisine preference — heavy asian preference
  await createClient({
    name: '[SAMPLE] Asian Preference Client',
    notes: 'No restrictions but strongly prefers Asian cuisine (weight 5). American cuisine weighted low (1).',
    proteins: ['chicken', 'steak', 'pork'],
    restrictions: [],
    itemsPerMenu: 5,
    cuisinePreferences: [
      { cuisineType: 'asian', weight: 5 },
      { cuisineType: 'mediterranean', weight: 3 },
      { cuisineType: 'american', weight: 1 },
    ],
  });

  // Client 8: Composition mode — protein categories + snacks
  await createClient({
    name: '[SAMPLE] Composition Mode Client',
    notes: 'Uses menuComposition: chicken×2, steak×2, sweet-snack×1, savory-snack×1. Tests composition mode logic.',
    proteins: ['chicken', 'steak', 'salmon', 'shrimp'],
    restrictions: [],
    menuComposition: [
      { category: 'chicken', count: 2 },
      { category: 'steak', count: 2 },
      { category: 'sweet-snack', count: 1 },
      { category: 'savory-snack', count: 1 },
    ],
  });

  console.log('✓ Created 20 sample recipes');
  console.log('✓ Created 8 sample clients');
  console.log('\nSample data is ready. All names prefixed with [SAMPLE].');
  console.log('\nExpected behaviour when generating menus:');
  console.log('  [SAMPLE] Dairy Free Client     → Butter Chicken No Swap EXCLUDED; Creamy Pasta has swap note');
  console.log('  [SAMPLE] Gluten Free Client    → Flour Tacos EXCLUDED; Pasta Bowl has swap note');
  console.log('  [SAMPLE] Egg Free Client       → Frittata has tofu swap; Caesar Salad has garnish omit');
  console.log('  [SAMPLE] Nut Free Client       → Thai Nut Noodles has sunflower seed swap; Almond Cake has omit');
  console.log('  [SAMPLE] Multi-Restriction     → Both dairy AND gluten rules applied simultaneously');
  console.log('  [SAMPLE] Asian Preference      → Asian recipes scored higher; American recipes ranked lower');
  console.log('  [SAMPLE] Composition Mode      → chicken×2, steak×2, sweet-snack×1, savory-snack×1');
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isRemove = args.includes('--remove');

(isRemove ? remove() : seed())
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
