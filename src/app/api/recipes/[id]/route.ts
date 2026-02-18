import { NextRequest, NextResponse } from 'next/server';
import { getRecipeById, updateRecipe, deleteRecipe } from '@/lib/queries/recipes';
import { recipeCreateSchema } from '@/lib/validations';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }
  return NextResponse.json(recipe);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = recipeCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const recipe = await updateRecipe(id, parsed.data);
  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }
  return NextResponse.json(recipe);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteRecipe(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
