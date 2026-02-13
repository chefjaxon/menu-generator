import { z } from 'zod';

export const proteinEnum = z.enum(['chicken', 'steak', 'pork', 'seafood', 'tofu', 'vegetarian']);
export const cuisineEnum = z.enum(['mexican', 'italian', 'asian', 'mediterranean', 'american', 'indian', 'other']);
export const itemTypeEnum = z.enum(['meal', 'sweet-snack', 'savory-snack']);

const ingredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  quantity: z.string().optional().default(''),
  unit: z.string().optional().default(''),
});

export const recipeCreateSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(200),
  description: z.string().optional().default(''),
  instructions: z.string().optional().default(''),
  cuisineType: cuisineEnum,
  itemType: itemTypeEnum,
  servingSize: z.number().int().min(1).max(100),
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required'),
  proteinSwaps: z.array(proteinEnum),
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
  proteins: z.array(proteinEnum).min(1, 'Select at least one protein'),
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
  selectedProtein: proteinEnum.optional(),
});

export const finalizeMenuSchema = z.object({
  menuId: z.string().min(1),
  weekLabel: z.string().optional(),
});
