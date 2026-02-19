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
  createdAt: Date;
  updatedAt: Date;
  ingredients: Array<{ id: string; name: string; quantity: string | null; unit: string | null; role: string; sortOrder: number; recipeId: string }>;
  proteinSwaps: Array<{ protein: string }>;
  tags: Array<{ tag: string }>;
}): Recipe {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    cuisineType: row.cuisineType as CuisineType,
    itemType: row.itemType as ItemType,
    servingSize: row.servingSize,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ingredients: row.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      role: (i.role as IngredientRole) ?? 'core',
      sortOrder: i.sortOrder,
    })),
    proteinSwaps: row.proteinSwaps.map((p) => p.protein),
    tags: row.tags.map((t) => t.tag),
  };
}

const recipeInclude = {
  ingredients: { orderBy: { sortOrder: 'asc' as const } },
  proteinSwaps: true,
  tags: true,
};

export async function getAllRecipes(filters?: {
  cuisine?: string;
  itemType?: string;
  tag?: string;
  protein?: string;
  search?: string;
}): Promise<Recipe[]> {
  const rows = await prisma.recipe.findMany({
    where: {
      ...(filters?.cuisine ? { cuisineType: filters.cuisine } : {}),
      ...(filters?.itemType ? { itemType: filters.itemType } : {}),
      ...(filters?.tag ? { tags: { some: { tag: filters.tag } } } : {}),
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
  ingredients: Array<{ name: string; quantity?: string; unit?: string; role?: IngredientRole }>;
  proteinSwaps: string[];
  tags: string[];
}

export async function createRecipe(data: RecipeInput): Promise<Recipe> {
  const id = nanoid();
  await prisma.recipe.create({
    data: {
      id,
      name: data.name,
      description: data.description || null,
      instructions: data.instructions || null,
      cuisineType: data.cuisineType,
      itemType: data.itemType,
      servingSize: data.servingSize,
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
      tags: {
        create: data.tags.map((tag) => ({ id: nanoid(), tag })),
      },
    },
  });
  return (await getRecipeById(id))!;
}

export async function updateRecipe(id: string, data: RecipeInput): Promise<Recipe | null> {
  const existing = await prisma.recipe.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;

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
      },
    }),
    prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    prisma.recipeProteinSwap.deleteMany({ where: { recipeId: id } }),
    prisma.recipeTag.deleteMany({ where: { recipeId: id } }),
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
    prisma.recipeTag.createMany({
      data: data.tags.map((tag) => ({ id: nanoid(), recipeId: id, tag })),
    }),
  ]);

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
