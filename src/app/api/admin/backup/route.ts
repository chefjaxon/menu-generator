import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/backup
 *
 * Returns a full JSON export of every table in the database.
 * Protected by a static bearer token — set BACKUP_SECRET in your
 * Railway environment variables (and local .env) to the same value
 * stored in ClaudeCoWork/DB Backups/backup-config.txt.
 *
 * Called nightly by the Cowork scheduled task "eatsbyatx-db-backup".
 */
export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.BACKUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'BACKUP_SECRET not configured on server' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Export all tables in parallel ─────────────────────────────────────────
  try {
    const [
      clients,
      clientRestrictions,
      clientCuisinePreferences,
      clientProteins,
      clientMenuCompositions,
      recipes,
      recipeIngredients,
      ingredientSwaps,
      recipeProteinSwaps,
      recipeTags,
      menus,
      menuItems,
      groceryItems,
      groceryCategories,
      categoryOverrides,
      builtinCategoryOverrides,
      ingredientNormCache,
      chefSchedules,
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

    const backup = {
      backup_date: new Date().toISOString(),
      tables: {
        clients,
        clientRestrictions,
        clientCuisinePreferences,
        clientProteins,
        clientMenuCompositions,
        recipes,
        recipeIngredients,
        ingredientSwaps,
        recipeProteinSwaps,
        recipeTags,
        menus,
        menuItems,
        groceryItems,
        groceryCategories,
        categoryOverrides,
        builtinCategoryOverrides,
        ingredientNormCache,
        chefSchedules,
      },
    };

    // Row counts for the summary header
    const counts: Record<string, number> = {};
    for (const [key, val] of Object.entries(backup.tables)) {
      counts[key] = (val as unknown[]).length;
    }

    return NextResponse.json(backup, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Backup-Row-Counts': JSON.stringify(counts),
        'X-Backup-Date': backup.backup_date,
      },
    });
  } catch (err) {
    console.error('[backup] Export failed:', err);
    return NextResponse.json(
      { error: 'Export failed', detail: String(err) },
      { status: 500 }
    );
  }
}
