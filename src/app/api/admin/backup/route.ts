import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.BACKUP_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'BACKUP_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [
    client,
    clientRestriction,
    clientCuisinePreference,
    clientProtein,
    clientMenuComposition,
    recipe,
    recipeIngredient,
    ingredientSwap,
    recipeProteinSwap,
    recipeTag,
    menu,
    menuItem,
    groceryItem,
    groceryCategory,
    categoryOverride,
    builtinCategoryOverride,
    ingredientNormCache,
    chefSchedule,
  ] = await Promise.all([
    prisma.client.findMany(),
    prisma.clientRestriction.findMany(),
    prisma.clientCuisinePreference.findMany(),
    prisma.clientProtein.findMany(),
    prisma.clientMenuComposition.findMany(),
    prisma.recipe.findMany(),
    prisma.recipeIngredient.findMany(),
    prisma.ingredientSwap.findMany(),
    prisma.recipeProteinSwap.findMany(),
    prisma.recipeTag.findMany(),
    prisma.menu.findMany(),
    prisma.menuItem.findMany(),
    prisma.groceryItem.findMany(),
    prisma.groceryCategory.findMany(),
    prisma.categoryOverride.findMany(),
    prisma.builtinCategoryOverride.findMany(),
    prisma.ingredientNormCache.findMany(),
    prisma.chefSchedule.findMany(),
  ]);

  return NextResponse.json({
    backup_date: new Date().toISOString(),
    tables: {
      client,
      clientRestriction,
      clientCuisinePreference,
      clientProtein,
      clientMenuComposition,
      recipe,
      recipeIngredient,
      ingredientSwap,
      recipeProteinSwap,
      recipeTag,
      menu,
      menuItem,
      groceryItem,
      groceryCategory,
      categoryOverride,
      builtinCategoryOverride,
      ingredientNormCache,
      chefSchedule,
    },
  });
}
