import { z } from 'zod';

export const proteinString = z.string().min(1, 'Protein name is required');
export const cuisineEnum = z.enum(['mexican', 'italian', 'asian', 'mediterranean', 'american', 'indian', 'other']);
export const itemTypeEnum = z.enum(['meal', 'sweet-snack', 'savory-snack']);

const swapSchema = z.object({
  substituteIngredient: z.string().min(1, 'Substitute ingredient is required').max(200),
  restriction: z.string().min(1, 'Restriction is required').max(100),
});

const ingredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  quantity: z.string().optional().default(''),
  unit: z.string().optional().default(''),
  role: z.enum(['core', 'optional']).optional().default('core'),
  swaps: z.array(swapSchema).optional().default([]),
});

export const recipeCreateSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(200),
  description: z.string().optional().default(''),
  instructions: z.string().optional().default(''),
  cuisineType: cuisineEnum,
  itemType: itemTypeEnum,
  servingSize: z.number().int().min(1).max(100),
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required'),
  proteinSwaps: z.array(proteinString),
  tags: z.array(z.string().min(1).max(100)),
});

export type RecipeCreateInput = z.infer<typeof recipeCreateSchema>;

const cuisinePreferenceSchema = z.object({
  cuisineType: cuisineEnum,
  weight: z.number().int().min(1).max(5),
});

const menuCompositionSchema = z.object({
  category: z.string().min(1),
  count: z.number().int().min(0).max(10),
});

export const clientCreateSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200),
  itemsPerMenu: z.number().int().min(0).max(50).optional(),
  notes: z.string().optional().default(''),
  proteins: z.array(proteinString).min(1, 'Select at least one protein'),
  restrictions: z.array(z.string().min(1).max(100)),
  cuisinePreferences: z.array(cuisinePreferenceSchema),
  menuComposition: z.array(menuCompositionSchema).optional().default([]),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const generateMenuSchema = z.object({
  clientId: z.string().min(1),
});

export const swapMenuItemSchema = z.object({
  menuId: z.string().min(1),
  menuItemId: z.string().min(1),
  newRecipeId: z.string().min(1),
  selectedProtein: proteinString.optional(),
});

export const finalizeMenuSchema = z.object({
  menuId: z.string().min(1),
  weekLabel: z.string().optional(),
});

// --- Grocery feature validations ---

export const toggleClientSelectedSchema = z.object({
  menuItemId: z.string().min(1),
  selected: z.boolean(),
});

export const groceryItemCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  quantity: z.string().max(100).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  source: z.enum(['recipe', 'manual']),
  recipeItemId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const groceryItemUpdateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  quantity: z.string().max(100).nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  checked: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const groceryMergeSchema = z.object({
  keepId: z.string().min(1),
  deleteId: z.string().min(1),
  name: z.string().min(1).max(500),
  quantity: z.string().max(100).nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const parsePasteSchema = z.object({
  text: z.string().max(50000),
});

export const groceryRestoreSchema = z.object({
  itemId: z.string().min(1),
});
