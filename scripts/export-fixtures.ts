/**
 * One-time script: export real recipe and client data from the production DB
 * into JSON fixture files for offline testing.
 *
 * Output files are gitignored (may contain real user data).
 * Tests must NOT import these at test-time; they exist only to let a developer
 * run engines against real data locally.
 *
 * Usage:
 *   DATABASE_URL=<connection-string> npx tsx scripts/export-fixtures.ts
 *
 * Or with local .env:
 *   npx dotenv -e .env -- npx tsx scripts/export-fixtures.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const outDir = path.join(process.cwd(), 'src', 'lib', 'test-fixtures', 'real');
  fs.mkdirSync(outDir, { recursive: true });

  // ── Export 20 oldest recipes ────────────────────────────────────────────────
  const recipes = await prisma.recipe.findMany({
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: {
      ingredients: {
        include: { swaps: true },
        orderBy: { sortOrder: 'asc' },
      },
      proteinSwaps: true,
      tags: true,
    },
  });

  // Shape into the test-friendly Recipe interface
  const recipeFixtures = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    instructions: r.instructions,
    cuisineType: r.cuisineType,
    itemType: r.itemType,
    servingSize: r.servingSize,
    recipeKeeperUrl: r.recipeKeeperUrl,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    proteinSwaps: r.proteinSwaps.map((ps) => ps.protein),
    tags: r.tags.map((t) => t.tag),
    ingredients: r.ingredients.map((ing) => ({
      id: ing.id,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      role: ing.role,
      sortOrder: ing.sortOrder,
      swaps: ing.swaps.map((s) => ({
        id: s.id,
        substituteIngredient: s.substituteIngredient,
        substituteQty: s.substituteQty,
        substituteUnit: s.substituteUnit,
        restriction: s.restriction,
        priority: s.priority,
      })),
    })),
  }));

  fs.writeFileSync(
    path.join(outDir, 'recipes.json'),
    JSON.stringify(recipeFixtures, null, 2),
    'utf8'
  );
  console.log(`✓ Exported ${recipeFixtures.length} recipes → src/lib/test-fixtures/real/recipes.json`);

  // ── Export 10 oldest clients ─────────────────────────────────────────────────
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'asc' },
    take: 10,
    include: {
      proteins: true,
      restrictions: true,
      cuisinePreferences: true,
      menuComposition: true,
    },
  });

  const clientFixtures = clients.map((c) => ({
    id: c.id,
    name: c.name,
    itemsPerMenu: c.itemsPerMenu,
    notes: c.notes,
    chefNotes: c.chefNotes,
    servingsPerDish: c.servingsPerDish,
    dishCount: c.dishCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    proteins: c.proteins.map((p) => p.protein),
    restrictions: c.restrictions.map((r) => r.restriction),
    cuisinePreferences: c.cuisinePreferences.map((cp) => ({
      cuisineType: cp.cuisineType,
      weight: cp.weight,
    })),
    menuComposition: c.menuComposition.map((mc) => ({
      category: mc.category,
      count: mc.count,
    })),
  }));

  fs.writeFileSync(
    path.join(outDir, 'clients.json'),
    JSON.stringify(clientFixtures, null, 2),
    'utf8'
  );
  console.log(`✓ Exported ${clientFixtures.length} clients → src/lib/test-fixtures/real/clients.json`);
  console.log('\nFiles are gitignored. Run engines against them locally only.');
}

main()
  .catch((err) => {
    console.error('Export failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
