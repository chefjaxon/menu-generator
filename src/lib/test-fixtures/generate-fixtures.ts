/**
 * Deterministic fixture generator for menu engine and grocery engine tests.
 *
 * Produces 200 recipes and 50 client profiles using a seeded PRNG.
 * Includes intentional edge cases for restrictions, swaps, synonyms, and unit mixing.
 *
 * ALL output is plain in-memory objects — no DB calls.
 */

import type {
  Recipe,
  Client,
  Ingredient,
  IngredientSwap,
  CuisineType,
  ItemType,
  IngredientRole,
} from '../types';

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
// Produces deterministic floats in [0, 1) from a fixed seed.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 42;
const rand = mulberry32(SEED);

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
}

let _idCounter = 1;
function id(): string {
  return `fix-${String(_idCounter++).padStart(5, '0')}`;
}

// ── Domain constants ──────────────────────────────────────────────────────────

const CUISINE_TYPES: CuisineType[] = [
  'mexican', 'italian', 'asian', 'mediterranean', 'american', 'indian', 'other',
];

const ITEM_TYPES: ItemType[] = ['meal', 'meal', 'meal', 'sweet-snack', 'savory-snack'];

const ALL_PROTEINS = ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'shrimp', 'tofu'];

// Common restrictions used across fixtures
const RESTRICTIONS = [
  'dairy', 'gluten', 'nuts', 'soy', 'eggs', 'beef', 'pork', 'shellfish',
  'corn', 'mushrooms', 'cilantro',
];

// Ingredient pools by category (name, qty, unit, role)
type IngPool = { name: string; qty: string | null; unit: string | null; role: IngredientRole };

const BASE_INGREDIENTS: IngPool[] = [
  { name: 'olive oil', qty: '2', unit: 'tbsp', role: 'core' },
  { name: 'garlic', qty: '3', unit: 'cloves', role: 'core' },
  { name: 'onion', qty: '1', unit: null, role: 'core' },
  { name: 'salt', qty: null, unit: null, role: 'optional' },
  { name: 'black pepper', qty: null, unit: null, role: 'optional' },
  { name: 'chicken broth', qty: '1', unit: 'cup', role: 'core' },
  { name: 'tomatoes', qty: '2', unit: null, role: 'core' },
  { name: 'lemon juice', qty: '1', unit: 'tbsp', role: 'core' },
  { name: 'vegetable oil', qty: '1', unit: 'tbsp', role: 'core' },
  { name: 'water', qty: '2', unit: 'cups', role: 'core' },
];

const DAIRY_INGREDIENTS: IngPool[] = [
  { name: 'butter', qty: '2', unit: 'tbsp', role: 'core' },
  { name: 'milk', qty: '1', unit: 'cup', role: 'core' },
  { name: 'heavy cream', qty: '1/2', unit: 'cup', role: 'core' },
  { name: 'parmesan cheese', qty: '1/4', unit: 'cup', role: 'optional' },
  { name: 'cheddar cheese', qty: '1/2', unit: 'cup', role: 'core' },
  { name: 'cream cheese', qty: '4', unit: 'oz', role: 'core' },
  { name: 'Greek yogurt', qty: '1/2', unit: 'cup', role: 'core' },
  { name: 'sour cream', qty: '1/4', unit: 'cup', role: 'optional' },
];

const GLUTEN_INGREDIENTS: IngPool[] = [
  { name: 'all-purpose flour', qty: '1', unit: 'cup', role: 'core' },
  { name: 'bread crumbs', qty: '1/2', unit: 'cup', role: 'core' },
  { name: 'soy sauce', qty: '2', unit: 'tbsp', role: 'core' },
  { name: 'pasta', qty: '8', unit: 'oz', role: 'core' },
  { name: 'wheat tortillas', qty: '4', unit: null, role: 'core' },
];

const NUT_INGREDIENTS: IngPool[] = [
  { name: 'almond butter', qty: '2', unit: 'tbsp', role: 'core' },
  { name: 'walnuts', qty: '1/4', unit: 'cup', role: 'optional' },
  { name: 'cashews', qty: '1/4', unit: 'cup', role: 'optional' },
  { name: 'peanut butter', qty: '3', unit: 'tbsp', role: 'core' },
  { name: 'pine nuts', qty: '2', unit: 'tbsp', role: 'garnish' },
];

const EGGS_INGREDIENTS: IngPool[] = [
  { name: 'eggs', qty: '2', unit: null, role: 'core' },
  { name: 'egg whites', qty: '3', unit: null, role: 'core' },
];

const CORN_INGREDIENTS: IngPool[] = [
  { name: 'corn', qty: '1', unit: 'cup', role: 'core' },
  { name: 'cornstarch', qty: '1', unit: 'tbsp', role: 'core' },
  { name: 'corn tortillas', qty: '4', unit: null, role: 'core' },
];

// Synonym pairs to test normalization
const SYNONYM_INGREDIENTS: IngPool[] = [
  { name: 'scallion', qty: '2', unit: null, role: 'optional' },      // → green onion
  { name: 'green onion', qty: '2', unit: null, role: 'optional' },    // canonical
  { name: 'eggplant', qty: '1', unit: null, role: 'core' },           // → aubergine alias check
  { name: 'cilantro', qty: '1', unit: 'tbsp', role: 'garnish' },
  { name: 'coriander', qty: '1', unit: 'tsp', role: 'core' },
  { name: 'zucchini', qty: '1', unit: null, role: 'core' },           // → courgette alias
  { name: 'bell pepper', qty: '1', unit: null, role: 'core' },
  { name: 'jalapeño', qty: '1', unit: null, role: 'optional' },
];

// Mixed units — same ingredient in different unit systems (to test consolidation)
const MIXED_UNIT_INGREDIENTS: IngPool[] = [
  { name: 'olive oil', qty: '30', unit: 'ml', role: 'core' },        // ml + tbsp → must merge
  { name: 'butter', qty: '50', unit: 'g', role: 'core' },            // g + oz → incompatible concat
  { name: 'lemon juice', qty: '1', unit: 'tsp', role: 'core' },      // tsp + tbsp → volume merge
  { name: 'garlic', qty: '2', unit: null, role: 'core' },             // bare count + cloves
  { name: 'chicken broth', qty: '1/2', unit: 'cup', role: 'core' },
  { name: 'chicken broth', qty: '4', unit: 'oz', role: 'core' },     // oz + cup → merge
];

const PROTEIN_INGREDIENTS: Record<string, IngPool> = {
  chicken: { name: 'chicken breast', qty: '1', unit: 'lb', role: 'core' },
  beef:    { name: 'ground beef', qty: '1', unit: 'lb', role: 'core' },
  pork:    { name: 'pork tenderloin', qty: '1', unit: 'lb', role: 'core' },
  turkey:  { name: 'ground turkey', qty: '1', unit: 'lb', role: 'core' },
  salmon:  { name: 'salmon fillet', qty: '6', unit: 'oz', role: 'core' },
  shrimp:  { name: 'shrimp', qty: '1/2', unit: 'lb', role: 'core' },
  tofu:    { name: 'firm tofu', qty: '14', unit: 'oz', role: 'core' },
};

function makeIngredient(pool: IngPool, swaps: IngredientSwap[] = []): Ingredient {
  return {
    id: id(),
    name: pool.name,
    quantity: pool.qty,
    unit: pool.unit,
    role: pool.role,
    swaps,
    sortOrder: 0,
  };
}

function makeSwap(
  restriction: string,
  substituteIngredient: string,
  substituteQty: string | null = null,
  substituteUnit: string | null = null,
  priority = 1
): IngredientSwap {
  return {
    id: id(),
    substituteIngredient,
    substituteQty,
    substituteUnit,
    restriction,
    priority,
  };
}

// ── Recipe builders ───────────────────────────────────────────────────────────

function makeBaseRecipe(
  name: string,
  cuisineType: CuisineType,
  itemType: ItemType,
  ingredients: Ingredient[],
  proteinSwaps: string[] = [],
  tags: string[] = [],
  servingSize = 4
): Recipe {
  return {
    id: id(),
    name,
    description: null,
    instructions: null,
    cuisineType,
    itemType,
    servingSize,
    recipeKeeperUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ingredients,
    proteinSwaps,
    tags,
  };
}

// ── 200 Recipe generation ────────────────────────────────────────────────────

export function generateRecipes(): Recipe[] {
  const recipes: Recipe[] = [];

  // ── Group A (recipes 1–20): Clean meals, no restrictions ─────────────────
  const cleanMealNames = [
    'Grilled Chicken Bowl', 'Beef Stir Fry', 'Turkey Tacos', 'Salmon with Asparagus',
    'Shrimp Fried Rice', 'Tofu Buddha Bowl', 'Pork Tenderloin', 'Chicken Soup',
    'Beef Burger', 'Turkey Meatballs', 'Salmon Cakes', 'Shrimp Scampi',
    'Chicken Tikka Masala', 'Beef Bolognese', 'Pork Carnitas', 'Turkey Chili',
    'Salmon Teriyaki', 'Shrimp Tacos', 'Tofu Stir Fry', 'Chicken Fajitas',
  ];
  const cleanCuisines: CuisineType[] = [
    'american', 'asian', 'mexican', 'mediterranean', 'indian', 'asian', 'american',
    'american', 'american', 'italian', 'american', 'italian', 'indian', 'italian',
    'mexican', 'mexican', 'asian', 'mexican', 'asian', 'mexican',
  ];
  for (let i = 0; i < 20; i++) {
    const protein = ALL_PROTEINS[i % ALL_PROTEINS.length];
    const ingPool = PROTEIN_INGREDIENTS[protein];
    recipes.push(makeBaseRecipe(
      cleanMealNames[i],
      cleanCuisines[i],
      'meal',
      [
        makeIngredient(ingPool),
        makeIngredient(BASE_INGREDIENTS[i % BASE_INGREDIENTS.length]),
        makeIngredient(BASE_INGREDIENTS[(i + 2) % BASE_INGREDIENTS.length]),
        makeIngredient({ name: 'salt', qty: null, unit: null, role: 'optional' }),
      ],
      [protein],
    ));
  }

  // ── Group B (recipes 21–40): Dairy-containing meals ──────────────────────
  // Some have swaps, some don't, some have dairy only in optional/garnish
  for (let i = 0; i < 20; i++) {
    const protein = ALL_PROTEINS[i % ALL_PROTEINS.length];
    const dairyIng = DAIRY_INGREDIENTS[i % DAIRY_INGREDIENTS.length];
    const hasDairySwap = i < 12; // first 12 have a swap
    const isOptional = i >= 16 && i < 20; // last 4 have dairy only as optional

    const dairySwaps = hasDairySwap && !isOptional
      ? [makeSwap('dairy', 'coconut cream', '1/2', 'cup', 2)]
      : [];

    const dairyIngredient = makeIngredient(
      isOptional ? { ...dairyIng, role: 'optional' } : dairyIng,
      dairySwaps
    );

    recipes.push(makeBaseRecipe(
      `Creamy ${protein.charAt(0).toUpperCase() + protein.slice(1)} Dish ${i + 1}`,
      pick(CUISINE_TYPES),
      'meal',
      [
        makeIngredient(PROTEIN_INGREDIENTS[protein]),
        dairyIngredient,
        makeIngredient(BASE_INGREDIENTS[i % BASE_INGREDIENTS.length]),
      ],
      [protein],
      hasDairySwap || isOptional ? [] : ['dairy'],
    ));
  }

  // ── Group C (recipes 41–60): Gluten-containing meals ─────────────────────
  // Some swappable, some not
  for (let i = 0; i < 20; i++) {
    const protein = ALL_PROTEINS[i % ALL_PROTEINS.length];
    const glutenIng = GLUTEN_INGREDIENTS[i % GLUTEN_INGREDIENTS.length];
    const hasGlutenSwap = i < 14;

    const glutenSwaps = hasGlutenSwap
      ? [makeSwap('gluten', i % 2 === 0 ? 'rice flour' : 'gluten-free breadcrumbs', '1', 'cup', 1)]
      : [];

    recipes.push(makeBaseRecipe(
      `Hearty ${protein.charAt(0).toUpperCase() + protein.slice(1)} ${i + 1}`,
      pick(CUISINE_TYPES),
      'meal',
      [
        makeIngredient(PROTEIN_INGREDIENTS[protein]),
        makeIngredient(glutenIng, glutenSwaps),
        makeIngredient(BASE_INGREDIENTS[(i + 1) % BASE_INGREDIENTS.length]),
      ],
      [protein],
      hasGlutenSwap ? [] : ['gluten'],
    ));
  }

  // ── Group D (recipes 61–80): Nut-containing meals ────────────────────────
  for (let i = 0; i < 20; i++) {
    const protein = ALL_PROTEINS[i % ALL_PROTEINS.length];
    const nutIng = NUT_INGREDIENTS[i % NUT_INGREDIENTS.length];
    const hasNutSwap = i < 10;
    const isGarnish = nutIng.role === 'garnish';

    const nutSwaps = hasNutSwap && !isGarnish
      ? [makeSwap('nuts', 'sunflower seeds', '1/4', 'cup', 1)]
      : [];

    recipes.push(makeBaseRecipe(
      `Nutty ${protein.charAt(0).toUpperCase() + protein.slice(1)} ${i + 1}`,
      pick(CUISINE_TYPES),
      'meal',
      [
        makeIngredient(PROTEIN_INGREDIENTS[protein]),
        makeIngredient({ ...nutIng, role: isGarnish ? 'garnish' : nutIng.role }, nutSwaps),
        makeIngredient(BASE_INGREDIENTS[i % BASE_INGREDIENTS.length]),
      ],
      [protein],
    ));
  }

  // ── Group E (recipes 81–100): Egg-containing meals ───────────────────────
  for (let i = 0; i < 20; i++) {
    const protein = ALL_PROTEINS[i % ALL_PROTEINS.length];
    const eggIng = EGGS_INGREDIENTS[i % 2];
    const hasEggSwap = i < 10;

    const eggSwaps = hasEggSwap
      ? [makeSwap('eggs', 'flax egg', '1', 'tbsp', 1)]
      : [];

    recipes.push(makeBaseRecipe(
      `Egg-Based ${protein.charAt(0).toUpperCase() + protein.slice(1)} ${i + 1}`,
      pick(CUISINE_TYPES),
      'meal',
      [
        makeIngredient(PROTEIN_INGREDIENTS[protein]),
        makeIngredient(eggIng, eggSwaps),
        makeIngredient(BASE_INGREDIENTS[i % BASE_INGREDIENTS.length]),
      ],
      [protein],
    ));
  }

  // ── Group F (recipes 101–120): Multi-protein swap recipes ─────────────────
  // Recipes that support multiple proteins (OR logic)
  const multiProteinSets = [
    ['chicken', 'turkey'],
    ['beef', 'pork'],
    ['salmon', 'shrimp'],
    ['chicken', 'tofu'],
    ['beef', 'turkey'],
  ];
  for (let i = 0; i < 20; i++) {
    const proteinSet = multiProteinSets[i % multiProteinSets.length];
    const primaryProtein = proteinSet[0];
    recipes.push(makeBaseRecipe(
      `Flexible Protein Dish ${i + 1}`,
      pick(CUISINE_TYPES),
      'meal',
      [
        makeIngredient(PROTEIN_INGREDIENTS[primaryProtein]),
        makeIngredient(BASE_INGREDIENTS[i % BASE_INGREDIENTS.length]),
        makeIngredient(BASE_INGREDIENTS[(i + 3) % BASE_INGREDIENTS.length]),
      ],
      proteinSet,
    ));
  }

  // ── Group G (recipes 121–140): Synonym ingredient recipes ─────────────────
  // Tests alias normalization (scallion→green onion, etc.)
  for (let i = 0; i < 20; i++) {
    const synIng = SYNONYM_INGREDIENTS[i % SYNONYM_INGREDIENTS.length];
    const protein = ALL_PROTEINS[i % ALL_PROTEINS.length];
    recipes.push(makeBaseRecipe(
      `Herby ${protein.charAt(0).toUpperCase() + protein.slice(1)} ${i + 1}`,
      pick(CUISINE_TYPES),
      'meal',
      [
        makeIngredient(PROTEIN_INGREDIENTS[protein]),
        makeIngredient(synIng),
        makeIngredient(BASE_INGREDIENTS[i % BASE_INGREDIENTS.length]),
      ],
      [protein],
    ));
  }

  // ── Group H (recipes 141–160): Mixed-unit recipes ─────────────────────────
  // Same logical ingredient with different units across recipes
  // This tests grocery consolidation across recipe sets
  const mixedUnitPoolPairs: Array<[IngPool, IngPool]> = [
    [
      { name: 'olive oil', qty: '2', unit: 'tbsp', role: 'core' },
      { name: 'olive oil', qty: '30', unit: 'ml', role: 'core' },
    ],
    [
      { name: 'lemon juice', qty: '1', unit: 'tbsp', role: 'core' },
      { name: 'lemon juice', qty: '3', unit: 'tsp', role: 'core' },
    ],
    [
      { name: 'chicken broth', qty: '1', unit: 'cup', role: 'core' },
      { name: 'chicken broth', qty: '8', unit: 'oz', role: 'core' },
    ],
    [
      { name: 'butter', qty: '2', unit: 'tbsp', role: 'core' },
      { name: 'butter', qty: '1', unit: 'oz', role: 'core' },
    ],
    [
      { name: 'garlic', qty: '2', unit: 'cloves', role: 'core' },
      { name: 'garlic', qty: '2', unit: null, role: 'core' },
    ],
  ];
  for (let i = 0; i < 20; i++) {
    const [ingA] = mixedUnitPoolPairs[i % mixedUnitPoolPairs.length];
    const protein = ALL_PROTEINS[i % ALL_PROTEINS.length];
    recipes.push(makeBaseRecipe(
      `Mixed Unit Recipe ${i + 1}`,
      pick(CUISINE_TYPES),
      'meal',
      [
        makeIngredient(PROTEIN_INGREDIENTS[protein]),
        makeIngredient(ingA),
        makeIngredient(BASE_INGREDIENTS[(i + 1) % BASE_INGREDIENTS.length]),
      ],
      [protein],
    ));
  }

  // ── Group I (recipes 161–170): Corn-restricted recipes ────────────────────
  for (let i = 0; i < 10; i++) {
    const cornIng = CORN_INGREDIENTS[i % CORN_INGREDIENTS.length];
    const hasCornSwap = i < 6;
    const protein = ALL_PROTEINS[i % ALL_PROTEINS.length];

    const cornSwaps = hasCornSwap
      ? [makeSwap('corn', 'rice', '1', 'cup', 1)]
      : [];

    recipes.push(makeBaseRecipe(
      `Corn Dish ${i + 1}`,
      pick(CUISINE_TYPES),
      'meal',
      [
        makeIngredient(PROTEIN_INGREDIENTS[protein]),
        makeIngredient(cornIng, cornSwaps),
        makeIngredient(BASE_INGREDIENTS[i % BASE_INGREDIENTS.length]),
      ],
      [protein],
    ));
  }

  // ── Group J (recipes 171–180): Sweet snacks ───────────────────────────────
  const sweetSnackNames = [
    'Energy Balls', 'Fruit Parfait', 'Granola Bars', 'Banana Muffins',
    'Protein Bites', 'Date Squares', 'Rice Cake with Almond Butter',
    'Berry Smoothie Bowl', 'Apple Slices with Peanut Butter', 'Coconut Macaroons',
  ];
  for (let i = 0; i < 10; i++) {
    recipes.push(makeBaseRecipe(
      sweetSnackNames[i],
      'other',
      'sweet-snack',
      [
        makeIngredient({ name: 'oats', qty: '1', unit: 'cup', role: 'core' }),
        makeIngredient({ name: 'honey', qty: '2', unit: 'tbsp', role: 'core' }),
        makeIngredient({ name: 'banana', qty: '1', unit: null, role: 'core' }),
      ],
      [],
    ));
  }

  // ── Group K (recipes 181–190): Savory snacks ──────────────────────────────
  const savorySnackNames = [
    'Veggie Chips', 'Hummus with Crudités', 'Cheese Crackers', 'Guacamole',
    'Trail Mix', 'Deviled Eggs', 'Stuffed Mini Peppers', 'Cucumber Bites',
    'Olive Tapenade', 'Roasted Chickpeas',
  ];
  for (let i = 0; i < 10; i++) {
    recipes.push(makeBaseRecipe(
      savorySnackNames[i],
      pick(['mediterranean', 'american', 'mexican'] as CuisineType[]),
      'savory-snack',
      [
        makeIngredient({ name: 'cucumber', qty: '1', unit: null, role: 'core' }),
        makeIngredient({ name: 'olive oil', qty: '1', unit: 'tbsp', role: 'core' }),
        makeIngredient({ name: 'salt', qty: null, unit: null, role: 'optional' }),
      ],
      [],
    ));
  }

  // ── Group L (recipes 191–200): Conflict-heavy edge cases ──────────────────
  // Recipes with multiple restrictions — some solvable, some not
  const edgeCases: Recipe[] = [
    // Dairy core with swap + gluten core no swap → excluded for gluten clients
    makeBaseRecipe('Double Restriction No Swap', 'american', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['chicken']),
      makeIngredient({ name: 'butter', qty: '2', unit: 'tbsp', role: 'core' }, [
        makeSwap('dairy', 'coconut oil', '2', 'tbsp', 1),
      ]),
      makeIngredient({ name: 'all-purpose flour', qty: '1/4', unit: 'cup', role: 'core' }), // no gluten swap
    ], ['chicken'], ['gluten']),

    // Dairy core with swap + gluten core with swap → eligible for all
    makeBaseRecipe('Double Restriction Both Swaps', 'american', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['chicken']),
      makeIngredient({ name: 'butter', qty: '2', unit: 'tbsp', role: 'core' }, [
        makeSwap('dairy', 'coconut oil', '2', 'tbsp', 2),
      ]),
      makeIngredient({ name: 'all-purpose flour', qty: '1/4', unit: 'cup', role: 'core' }, [
        makeSwap('gluten', 'almond flour', '1/4', 'cup', 1),
      ]),
    ], ['chicken']),

    // Nuts in garnish only (always eligible, just omit note for nut-free clients)
    makeBaseRecipe('Nuts Only Garnish', 'mediterranean', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['salmon']),
      makeIngredient({ name: 'olive oil', qty: '2', unit: 'tbsp', role: 'core' }),
      makeIngredient({ name: 'pine nuts', qty: '1', unit: 'tbsp', role: 'garnish' }),
      makeIngredient({ name: 'parsley', qty: '2', unit: 'tbsp', role: 'garnish' }),
    ], ['salmon']),

    // Cilantro as garnish (restricted by some clients)
    makeBaseRecipe('Cilantro Garnish Recipe', 'mexican', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['chicken']),
      makeIngredient({ name: 'corn tortillas', qty: '4', unit: null, role: 'core' }),
      makeIngredient({ name: 'cilantro', qty: '2', unit: 'tbsp', role: 'garnish' }),
    ], ['chicken']),

    // Recipe with corn restriction AND corn in tag → excluded unless swap
    makeBaseRecipe('Corn Tagged Recipe', 'mexican', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['chicken']),
      makeIngredient({ name: 'corn', qty: '1', unit: 'cup', role: 'core' }, [
        makeSwap('corn', 'rice', '1', 'cup', 1),
      ]),
    ], ['chicken'], ['corn']),

    // Multi-swap priority test: two swaps for dairy, different priorities
    makeBaseRecipe('Multi Swap Priority', 'italian', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['chicken']),
      makeIngredient({ name: 'heavy cream', qty: '1/2', unit: 'cup', role: 'core' }, [
        makeSwap('dairy', 'oat milk', '1/2', 'cup', 1),
        makeSwap('dairy', 'coconut cream', '1/2', 'cup', 3), // higher priority → should be chosen
      ]),
    ], ['chicken']),

    // Scallion recipe (synonym for green onion) - mixed unit version
    makeBaseRecipe('Scallion Mixed Units', 'asian', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['shrimp']),
      makeIngredient({ name: 'scallion', qty: '2', unit: null, role: 'optional' }),
      makeIngredient({ name: 'soy sauce', qty: '2', unit: 'tbsp', role: 'core' }),
    ], ['shrimp']),

    // High serving size recipe (servingSize=8 vs typical 4)
    makeBaseRecipe('Large Batch Chili', 'american', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['beef']),
      makeIngredient({ name: 'kidney beans', qty: '2', unit: 'cups', role: 'core' }),
      makeIngredient({ name: 'tomatoes', qty: '4', unit: null, role: 'core' }),
    ], ['beef'], [], 8),

    // No measurable ingredient (qty+unit both null) → goes to removed set in grocery
    makeBaseRecipe('Unmeasured Spices Recipe', 'indian', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['chicken']),
      makeIngredient({ name: 'cumin', qty: null, unit: null, role: 'core' }),
      makeIngredient({ name: 'turmeric', qty: null, unit: null, role: 'core' }),
      makeIngredient({ name: 'onion', qty: '1', unit: null, role: 'core' }),
    ], ['chicken']),

    // Completely clean recipe, all proteins, all cuisines fallback
    makeBaseRecipe('Universal Fallback', 'other', 'meal', [
      makeIngredient(PROTEIN_INGREDIENTS['tofu']),
      makeIngredient({ name: 'broccoli', qty: '2', unit: 'cups', role: 'core' }),
      makeIngredient({ name: 'garlic', qty: '4', unit: 'cloves', role: 'core' }),
      makeIngredient({ name: 'olive oil', qty: '2', unit: 'tbsp', role: 'core' }),
    ], ['tofu', 'chicken', 'beef', 'pork', 'turkey', 'salmon', 'shrimp']),
  ];

  recipes.push(...edgeCases);

  return recipes;
}

// ── 50 Client profile generation ─────────────────────────────────────────────

export function generateClients(): Client[] {
  const clients: Client[] = [];

  function makeClient(
    name: string,
    restrictions: string[],
    proteins: string[],
    cuisinePrefs: Record<string, number>,
    itemsPerMenu = 5,
    menuComposition: Array<{ category: string; count: number }> = [],
  ): Client {
    return {
      id: id(),
      name,
      itemsPerMenu,
      notes: null,
      chefNotes: null,
      servingsPerDish: 4,
      dishCount: itemsPerMenu,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      proteins,
      restrictions,
      cuisinePreferences: Object.entries(cuisinePrefs).map(([cuisineType, weight]) => ({
        cuisineType: cuisineType as CuisineType,
        weight,
      })),
      menuComposition,
    };
  }

  // Client 1: No restrictions (control)
  clients.push(makeClient(
    'Control Client',
    [],
    ['chicken', 'beef', 'pork', 'turkey'],
    { american: 4, italian: 3, mexican: 3 },
    5,
  ));

  // Client 2: Dairy-free (some recipes have swaps, some don't)
  clients.push(makeClient(
    'Dairy Free Client',
    ['dairy'],
    ['chicken', 'salmon'],
    { mediterranean: 5, asian: 3 },
    5,
  ));

  // Client 3: Gluten-free
  clients.push(makeClient(
    'Gluten Free Client',
    ['gluten'],
    ['chicken', 'beef'],
    { american: 4, mexican: 3 },
    5,
  ));

  // Client 4: Nut-free
  clients.push(makeClient(
    'Nut Free Client',
    ['nuts'],
    ['chicken', 'turkey', 'salmon'],
    { asian: 4, mediterranean: 4 },
    5,
  ));

  // Client 5: Egg-free
  clients.push(makeClient(
    'Egg Free Client',
    ['eggs'],
    ['chicken', 'beef', 'turkey'],
    { american: 3, italian: 4 },
    5,
  ));

  // Client 6: Corn-free
  clients.push(makeClient(
    'Corn Free Client',
    ['corn'],
    ['chicken', 'pork'],
    { mexican: 2, american: 4 },
    5,
  ));

  // Client 7: Dairy + Gluten (both restrictions, most recipes excluded)
  clients.push(makeClient(
    'Dairy and Gluten Free Client',
    ['dairy', 'gluten'],
    ['chicken', 'salmon', 'tofu'],
    { asian: 5, mediterranean: 4 },
    5,
  ));

  // Client 8: Dairy + Nuts (conflicting double restriction)
  clients.push(makeClient(
    'Dairy and Nut Free Client',
    ['dairy', 'nuts'],
    ['chicken', 'beef', 'turkey'],
    { american: 3, mexican: 3, mediterranean: 4 },
    5,
  ));

  // Client 9: Cilantro-free (garnish-only restriction — should only omit notes)
  clients.push(makeClient(
    'Cilantro Free Client',
    ['cilantro'],
    ['chicken', 'beef', 'pork'],
    { mexican: 4, asian: 3 },
    5,
  ));

  // Client 10: Single protein (chicken only)
  clients.push(makeClient(
    'Chicken Only Client',
    [],
    ['chicken'],
    { asian: 5, indian: 4 },
    5,
  ));

  // Client 11: Seafood only
  clients.push(makeClient(
    'Seafood Only Client',
    [],
    ['salmon', 'shrimp'],
    { mediterranean: 5, asian: 4 },
    5,
  ));

  // Client 12: Plant-based (tofu only)
  clients.push(makeClient(
    'Plant Based Client',
    ['beef', 'pork', 'chicken', 'turkey', 'salmon', 'shrimp'],
    ['tofu'],
    { asian: 5, mediterranean: 4, indian: 4 },
    5,
  ));

  // Client 13: All proteins, no restrictions, heavy cuisine preference
  clients.push(makeClient(
    'Italian Lover Client',
    [],
    ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'shrimp'],
    { italian: 5 },
    6,
  ));

  // Client 14: Mushroom-free (not a standard restriction, tests unusual restriction matching)
  clients.push(makeClient(
    'Mushroom Free Client',
    ['mushrooms'],
    ['chicken', 'beef'],
    { american: 4, asian: 3 },
    5,
  ));

  // Client 15: With menuComposition (composition mode)
  clients.push(makeClient(
    'Composition Client',
    ['dairy'],
    ['chicken', 'beef', 'turkey'],
    { american: 4, mexican: 3 },
    5,
    [
      { category: 'chicken', count: 2 },
      { category: 'beef', count: 2 },
      { category: 'sweet-snack', count: 1 },
    ],
  ));

  // Clients 16–30: Varied restrictions + proteins for comprehensive coverage
  const restrictionCombos = [
    ['dairy'],
    ['gluten'],
    ['nuts'],
    ['eggs'],
    ['corn'],
    ['dairy', 'eggs'],
    ['gluten', 'nuts'],
    ['dairy', 'corn'],
    ['soy'],
    ['shellfish'],
    ['dairy', 'gluten', 'nuts'],
    ['eggs', 'dairy'],
    ['corn', 'gluten'],
    ['nuts', 'soy'],
    [],
  ];
  const proteinSets = [
    ['chicken'],
    ['beef'],
    ['pork'],
    ['turkey'],
    ['salmon'],
    ['shrimp'],
    ['tofu'],
    ['chicken', 'turkey'],
    ['beef', 'pork'],
    ['salmon', 'shrimp'],
    ['chicken', 'beef', 'pork'],
    ['turkey', 'salmon'],
    ['shrimp', 'tofu'],
    ['chicken', 'tofu'],
    ['beef', 'turkey', 'pork'],
  ];
  for (let i = 0; i < 15; i++) {
    clients.push(makeClient(
      `Test Client ${i + 16}`,
      restrictionCombos[i],
      proteinSets[i],
      { [CUISINE_TYPES[i % CUISINE_TYPES.length]]: 4, [CUISINE_TYPES[(i + 2) % CUISINE_TYPES.length]]: 3 },
      randInt(4, 7),
    ));
  }

  // Clients 31–40: With menuComposition (composition mode)
  const proteinCategories = ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'shrimp', 'tofu'];
  for (let i = 0; i < 10; i++) {
    const proteinCat = proteinCategories[i % proteinCategories.length];
    const secondProteinCat = proteinCategories[(i + 2) % proteinCategories.length];
    clients.push(makeClient(
      `Composition Client ${i + 31}`,
      i < 5 ? ['dairy'] : [],
      [proteinCat, secondProteinCat],
      { [CUISINE_TYPES[i % CUISINE_TYPES.length]]: 4 },
      5,
      [
        { category: proteinCat, count: 2 },
        { category: secondProteinCat, count: 2 },
        { category: 'sweet-snack', count: 1 },
      ],
    ));
  }

  // Clients 41–50: Edge case clients
  // Client 41: No cuisine preferences (all default weight 3)
  clients.push(makeClient(
    'No Preference Client',
    [],
    ['chicken', 'beef'],
    {},
    5,
  ));

  // Client 42: Very restrictive (many restrictions) — few recipes pass
  clients.push(makeClient(
    'Very Restrictive Client',
    ['dairy', 'gluten', 'nuts', 'eggs', 'corn', 'soy'],
    ['chicken', 'salmon'],
    { mediterranean: 5, asian: 3 },
    5,
  ));

  // Client 43: Large menu (8 items)
  clients.push(makeClient(
    'Large Menu Client',
    [],
    ['chicken', 'beef', 'pork', 'turkey'],
    { american: 3, italian: 3, mexican: 3, asian: 3 },
    8,
  ));

  // Client 44: Shellfish-free
  clients.push(makeClient(
    'Shellfish Free Client',
    ['shellfish'],
    ['salmon'],
    { mediterranean: 5, asian: 3 },
    5,
  ));

  // Client 45: Corn + cilantro free (two garnish-affecting restrictions)
  clients.push(makeClient(
    'Corn and Cilantro Free Client',
    ['corn', 'cilantro'],
    ['chicken', 'pork'],
    { mexican: 5, american: 2 },
    5,
  ));

  // Client 46: Single item menu
  clients.push(makeClient(
    'Single Item Client',
    [],
    ['chicken'],
    { asian: 5 },
    1,
  ));

  // Client 47: Beef-free restriction (protein restriction via ingredient restriction)
  clients.push(makeClient(
    'Beef Free Client',
    ['beef'],
    ['chicken', 'pork', 'turkey'],
    { american: 4 },
    5,
  ));

  // Client 48: Pork-free
  clients.push(makeClient(
    'Pork Free Client',
    ['pork'],
    ['chicken', 'beef', 'turkey', 'salmon'],
    { italian: 4, mediterranean: 3 },
    5,
  ));

  // Client 49: All restrictions (only truly clean recipes pass)
  clients.push(makeClient(
    'Maximum Restriction Client',
    ['dairy', 'gluten', 'nuts', 'eggs', 'corn', 'soy', 'shellfish', 'mushrooms', 'cilantro'],
    ['chicken', 'tofu'],
    { mediterranean: 4, asian: 4 },
    5,
  ));

  // Client 50: Dairy-free with composition mode + mixed protein set
  clients.push(makeClient(
    'Final Edge Case Client',
    ['dairy', 'nuts'],
    ['chicken', 'salmon', 'tofu'],
    { asian: 5, mediterranean: 4, indian: 3 },
    6,
    [
      { category: 'chicken', count: 2 },
      { category: 'salmon', count: 2 },
      { category: 'savory-snack', count: 2 },
    ],
  ));

  return clients;
}

// ── Exported fixture collections ──────────────────────────────────────────────

export interface Fixtures {
  recipes: Recipe[];
  clients: Client[];
}

let _cached: Fixtures | null = null;

/**
 * Returns deterministic fixtures. Cached after first call.
 * The fixture generator resets its ID counter and PRNG on first call via module load.
 */
export function getFixtures(): Fixtures {
  if (_cached) return _cached;
  _cached = {
    recipes: generateRecipes(),
    clients: generateClients(),
  };
  return _cached;
}

// ── Grocery scenario builder ──────────────────────────────────────────────────

export interface GroceryScenario {
  name: string;
  menuItems: Array<{
    recipe: Recipe;
    selectedProtein: string | null;
    clientSelected: boolean;
  }>;
  clientRestrictions: string[];
}

/**
 * Build 15 named grocery scenarios from fixture data for snapshot testing.
 */
export function buildGroceryScenarios(recipes: Recipe[]): GroceryScenario[] {
  const meals = recipes.filter((r) => r.itemType === 'meal');
  const snacks = recipes.filter(
    (r) => r.itemType === 'sweet-snack' || r.itemType === 'savory-snack'
  );

  function scenario(
    name: string,
    recipeIndices: number[],
    restrictions: string[] = [],
    proteinByIndex: Record<number, string> = {},
  ): GroceryScenario {
    return {
      name,
      clientRestrictions: restrictions,
      menuItems: recipeIndices.map((ri, i) => ({
        recipe: recipes[ri] ?? meals[ri % meals.length],
        selectedProtein: proteinByIndex[i] ?? null,
        clientSelected: true,
      })),
    };
  }

  return [
    scenario('01_no_restrictions_5_meals', [0, 1, 2, 3, 4]),
    scenario('02_dairy_free_5_meals', [20, 21, 22, 23, 24], ['dairy']),
    scenario('03_gluten_free_5_meals', [40, 41, 42, 43, 44], ['gluten']),
    scenario('04_nut_free_optional_omit', [60, 61, 62, 63, 64], ['nuts']),
    scenario('05_egg_free_with_swaps', [80, 81, 82, 83, 84], ['eggs']),
    scenario('06_mixed_units_consolidation', [140, 141, 142, 143, 144]),
    scenario('07_synonym_normalization', [120, 121, 122, 123, 124]),
    scenario('08_no_qty_items_removed', [190, 191], []),  // unmeasured spice recipe
    scenario('09_multi_protein_selection', [100, 101, 102], [], { 0: 'chicken', 1: 'turkey', 2: 'beef' }),
    scenario('10_double_restriction_partial', [0, 190, 191, 192, 193], ['dairy', 'gluten']),
    scenario('11_snacks_only', [169, 170, 171, 172, 173]),
    scenario('12_mixed_meals_snacks', [0, 1, 2, 169, 170]),
    scenario('13_large_batch_recipe', [197]),  // servingSize=8 recipe
    scenario('14_multi_swap_priority', [195], ['dairy']),
    scenario('15_empty_client_restrictions', [199, 198, 197, 196, 195], []),
  ];
}
