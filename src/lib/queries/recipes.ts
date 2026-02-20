import { nanoid } from 'nanoid';
import { prisma } from '../prisma';
import type { Recipe, CuisineType, ItemType, IngredientRole } from '../types';

function mapRecipe(row: {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  cuisineType: string;
  itemType: string;
  servingSize: number;
  recipeKeeperUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  ingredients: Array<{
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    role: string;
    sortOrder: number;
    recipeId: string;
    swaps: Array<{ id: string; substituteIngredient: string; restriction: string; recipeIngredientId: string }>;
  }>;
  proteinSwaps: Array<{ protein: string }>;
}): Recipe {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    cuisineType: row.cuisineType as CuisineType,
    itemType: row.itemType as ItemType,
    servingSize: row.servingSize,
    recipeKeeperUrl: row.recipeKeeperUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ingredients: row.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      role: (i.role as IngredientRole) ?? 'core',
      swaps: i.swaps.map((s) => ({
        id: s.id,
        substituteIngredient: s.substituteIngredient,
        restriction: s.restriction,
      })),
      sortOrder: i.sortOrder,
    })),
    proteinSwaps: row.proteinSwaps.map((p) => p.protein),
  };
}

const recipeInclude = {
  ingredients: {
    orderBy: { sortOrder: 'asc' as const },
    include: { swaps: true },
  },
  proteinSwaps: true,
};

export async function getAllRecipes(filters?: {
  cuisine?: string;
  itemType?: string;
  protein?: string;
  search?: string;
}): Promise<Recipe[]> {
  const rows = await prisma.recipe.findMany({
    where: {
      ...(filters?.cuisine ? { cuisineType: filters.cuisine } : {}),
      ...(filters?.itemType ? { itemType: filters.itemType } : {}),
      ...(filters?.protein ? { proteinSwaps: { some: { protein: filters.protein } } } : {}),
      ...(filters?.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
    },
    include: recipeInclude,
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(mapRecipe);
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const row = await prisma.recipe.findUnique({
    where: { id },
    include: recipeInclude,
  });
  if (!row) return null;
  return mapRecipe(row);
}

export interface RecipeInput {
  name: string;
  description?: string;
  instructions?: string;
  cuisineType: string;
  itemType: string;
  servingSize: number;
  recipeKeeperUrl?: string;
  ingredients: Array<{
    name: string;
    quantity?: string;
    unit?: string;
    role?: IngredientRole;
    swaps?: Array<{ substituteIngredient: string; restriction: string }>;
  }>;
  proteinSwaps: string[];
}

export async function createRecipe(data: RecipeInput): Promise<Recipe> {
  const id = nanoid();

  // Create recipe with ingredients (without swaps first, then add swaps after to get ingredient IDs)
  await prisma.recipe.create({
    data: {
      id,
      name: data.name,
      description: data.description || null,
      instructions: data.instructions || null,
      cuisineType: data.cuisineType,
      itemType: data.itemType,
      servingSize: data.servingSize,
      recipeKeeperUrl: data.recipeKeeperUrl || null,
      ingredients: {
        create: data.ingredients.map((ing, i) => ({
          id: nanoid(),
          name: ing.name,
          quantity: ing.quantity || null,
          unit: ing.unit || null,
          role: ing.role ?? 'core',
          sortOrder: i,
        })),
      },
      proteinSwaps: {
        create: data.proteinSwaps.map((protein) => ({ id: nanoid(), protein })),
      },
    },
  });

  // Add swaps — fetch the newly created ingredient IDs ordered by sortOrder
  const swapsToCreate: Array<{ id: string; recipeIngredientId: string; substituteIngredient: string; restriction: string }> = [];
  const createdIngredients = await prisma.recipeIngredient.findMany({
    where: { recipeId: id },
    orderBy: { sortOrder: 'asc' },
  });
  for (let i = 0; i < data.ingredients.length; i++) {
    const ing = data.ingredients[i];
    const dbIng = createdIngredients[i];
    if (!dbIng || !ing.swaps?.length) continue;
    for (const swap of ing.swaps) {
      swapsToCreate.push({
        id: nanoid(),
        recipeIngredientId: dbIng.id,
        substituteIngredient: swap.substituteIngredient,
        restriction: swap.restriction,
      });
    }
  }
  if (swapsToCreate.length > 0) {
    await prisma.ingredientSwap.createMany({ data: swapsToCreate });
  }

  return (await getRecipeById(id))!;
}

export async function updateRecipe(id: string, data: RecipeInput): Promise<Recipe | null> {
  const existing = await prisma.recipe.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;

  // Delete and recreate ingredients (swaps cascade-delete with ingredients)
  await prisma.$transaction([
    prisma.recipe.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        instructions: data.instructions || null,
        cuisineType: data.cuisineType,
        itemType: data.itemType,
        servingSize: data.servingSize,
        recipeKeeperUrl: data.recipeKeeperUrl || null,
      },
    }),
    prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    prisma.recipeProteinSwap.deleteMany({ where: { recipeId: id } }),
    prisma.recipeIngredient.createMany({
      data: data.ingredients.map((ing, i) => ({
        id: nanoid(),
        recipeId: id,
        name: ing.name,
        quantity: ing.quantity || null,
        unit: ing.unit || null,
        role: ing.role ?? 'core',
        sortOrder: i,
      })),
    }),
    prisma.recipeProteinSwap.createMany({
      data: data.proteinSwaps.map((protein) => ({ id: nanoid(), recipeId: id, protein })),
    }),
  ]);

  // Add swaps after transaction (need freshly created ingredient IDs)
  const swapsToCreate: Array<{ id: string; recipeIngredientId: string; substituteIngredient: string; restriction: string }> = [];
  const createdIngredients = await prisma.recipeIngredient.findMany({
    where: { recipeId: id },
    orderBy: { sortOrder: 'asc' },
  });
  for (let i = 0; i < data.ingredients.length; i++) {
    const ing = data.ingredients[i];
    const dbIng = createdIngredients[i];
    if (!dbIng || !ing.swaps?.length) continue;
    for (const swap of ing.swaps) {
      swapsToCreate.push({
        id: nanoid(),
        recipeIngredientId: dbIng.id,
        substituteIngredient: swap.substituteIngredient,
        restriction: swap.restriction,
      });
    }
  }
  if (swapsToCreate.length > 0) {
    await prisma.ingredientSwap.createMany({ data: swapsToCreate });
  }

  return getRecipeById(id);
}

export async function deleteRecipe(id: string): Promise<boolean> {
  try {
    await prisma.recipe.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
