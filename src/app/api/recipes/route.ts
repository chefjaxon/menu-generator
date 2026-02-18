import { NextRequest, NextResponse } from 'next/server';
import { getAllRecipes, createRecipe } from '@/lib/queries/recipes';
import { recipeCreateSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filters = {
    cuisine: searchParams.get('cuisine') || undefined,
    itemType: searchParams.get('itemType') || undefined,
    tag: searchParams.get('tag') || undefined,
    protein: searchParams.get('protein') || undefined,
    search: searchParams.get('search') || undefined,
  };

  const recipes = await getAllRecipes(filters);
  return NextResponse.json(recipes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = recipeCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const recipe = await createRecipe(parsed.data);
  return NextResponse.json(recipe, { status: 201 });
}
