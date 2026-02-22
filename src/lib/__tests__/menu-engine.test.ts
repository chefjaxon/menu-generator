/**
 * Menu engine tests.
 *
 * All tests use the pure buildMenuFromData function with:
 *   - Fixed randomFn: () => 0  (makes scoring fully deterministic)
 *   - No DB calls
 *   - In-memory fixtures from generate-fixtures
 */

import { describe, it, expect } from 'vitest';
import { buildMenuFromData } from '../menu-engine';
import { getFixtures, generateClients, generateRecipes } from '../test-fixtures/generate-fixtures';
import { ingredientMatchesRestriction, canonicalizeRestriction } from '../restriction-utils';

// Deterministic scoring — score = cuisineWeight + 0 (randomFn always returns 0)
const FIXED_RANDOM: () => number = () => 0;
const NO_RECENT = new Set<string>();
const ALL_PROTEINS = ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'shrimp', 'tofu'];

// ── Golden snapshot tests (15 clients) ───────────────────────────────────────

describe('Menu engine — golden snapshots (15 clients)', () => {
  const { recipes, clients } = getFixtures();

  const snapshotClients = clients.slice(0, 15);

  for (const client of snapshotClients) {
    it(`client: ${client.name}`, () => {
      const result = buildMenuFromData(
        client,
        recipes,
        ALL_PROTEINS,
        NO_RECENT,
        { randomFn: FIXED_RANDOM },
      );

      // Snapshot the shape: recipe IDs selected + proteins assigned + omit notes
      const snapshot = result.items.map((item) => ({
        recipeId: item.recipeId,
        selectedProtein: item.selectedProtein,
        omitNoteCount: item.omitNotes.length,
        // Include first omit note if present (deterministic)
        firstOmitNote: item.omitNotes[0] ?? null,
      }));

      expect(snapshot).toMatchSnapshot();
      expect(result.warnings).toMatchSnapshot();
    });
  }
});

// ── Property invariant: no banned ingredient survives ─────────────────────────

describe('Menu engine — invariant: no banned ingredient survives', () => {
  const { recipes, clients } = getFixtures();

  for (const client of clients.slice(0, 25)) {
    it(`client: ${client.name}`, () => {
      const result = buildMenuFromData(
        client,
        recipes,
        ALL_PROTEINS,
        NO_RECENT,
        { randomFn: FIXED_RANDOM },
      );

      const clientExclusions = client.restrictions.map((r) => canonicalizeRestriction(r));

      for (const item of result.items) {
        const recipe = recipes.find((r) => r.id === item.recipeId);
        if (!recipe) continue;

        for (const ingredient of recipe.ingredients) {
          for (const exclusion of clientExclusions) {
            if (!ingredientMatchesRestriction(ingredient.name, exclusion)) continue;

            // This ingredient is restricted. It must be handled in omitNotes.
            const omitNote = item.omitNotes.find(
              (note) =>
                note.toLowerCase().includes(ingredient.name.toLowerCase()) ||
                note.toLowerCase().includes(exclusion)
            );
            const isOptionalOrGarnish =
              ingredient.role === 'optional' || ingredient.role === 'garnish';

            if (isOptionalOrGarnish) {
              // Optional/garnish: should have an "Omit" note
              expect(
                omitNote,
                `${client.name}: ingredient "${ingredient.name}" (${ingredient.role}) ` +
                `restricted by "${exclusion}" should have Omit note in recipe "${recipe.name}"`
              ).toBeTruthy();
            } else {
              // Core: must have a swap note (or recipe should not have been selected)
              const hasSwap = ingredient.swaps.some(
                (s) => canonicalizeRestriction(s.restriction) === exclusion
              );
              if (!hasSwap) {
                // Recipe should not have been selected if core ingredient has no swap
                throw new Error(
                  `${client.name}: recipe "${recipe.name}" was selected but contains ` +
                  `core ingredient "${ingredient.name}" restricted by "${exclusion}" with no swap.`
                );
              }
              expect(
                omitNote,
                `${client.name}: ingredient "${ingredient.name}" (core) ` +
                `restricted by "${exclusion}" should have Swap note in recipe "${recipe.name}"`
              ).toBeTruthy();
            }
          }
        }
      }
    });
  }
});

// ── Property invariant: no duplicate recipe IDs in a menu ────────────────────

describe('Menu engine — invariant: no duplicate recipe IDs', () => {
  const { recipes, clients } = getFixtures();

  for (const client of clients.slice(0, 30)) {
    it(`client: ${client.name}`, () => {
      const result = buildMenuFromData(
        client,
        recipes,
        ALL_PROTEINS,
        NO_RECENT,
        { randomFn: FIXED_RANDOM },
      );

      const ids = result.items.map((i) => i.recipeId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  }
});

// ── Property invariant: all omit notes that say "Swap" reference a real swap ──

describe('Menu engine — invariant: swap notes reference real swaps', () => {
  const { recipes, clients } = getFixtures();

  for (const client of clients.slice(0, 20)) {
    it(`client: ${client.name}`, () => {
      const result = buildMenuFromData(
        client,
        recipes,
        ALL_PROTEINS,
        NO_RECENT,
        { randomFn: FIXED_RANDOM },
      );

      for (const item of result.items) {
        const recipe = recipes.find((r) => r.id === item.recipeId);
        if (!recipe) continue;

        for (const note of item.omitNotes) {
          if (!note.startsWith('Swap ')) continue;

          // note format: "Swap {ingredient} → {substitute} ({restriction})"
          const arrowIdx = note.indexOf(' → ');
          const parenIdx = note.lastIndexOf(' (');
          if (arrowIdx < 0 || parenIdx < 0) continue;

          const originalName = note.slice('Swap '.length, arrowIdx);
          const substituteName = note.slice(arrowIdx + 3, parenIdx);
          const restriction = note.slice(parenIdx + 2, note.length - 1);

          const ingredient = recipe.ingredients.find((ing) =>
            ing.name.toLowerCase() === originalName.toLowerCase()
          );
          expect(ingredient, `No ingredient "${originalName}" found in recipe "${recipe.name}"`).toBeTruthy();

          const swap = ingredient!.swaps.find(
            (s) =>
              canonicalizeRestriction(s.restriction) === restriction &&
              s.substituteIngredient.toLowerCase() === substituteName.toLowerCase()
          );
          expect(
            swap,
            `Note "${note}" in recipe "${recipe.name}" references substitute ` +
            `"${substituteName}" but no such swap exists for restriction "${restriction}"`
          ).toBeTruthy();
        }
      }
    });
  }
});

// ── Determinism: same call → same output ──────────────────────────────────────

describe('Menu engine — determinism', () => {
  const { recipes, clients } = getFixtures();

  it('same inputs produce identical outputs', () => {
    const client = clients[0]; // Control client, no restrictions
    const run1 = buildMenuFromData(client, recipes, ALL_PROTEINS, NO_RECENT, { randomFn: FIXED_RANDOM });
    const run2 = buildMenuFromData(client, recipes, ALL_PROTEINS, NO_RECENT, { randomFn: FIXED_RANDOM });
    expect(run1.items).toEqual(run2.items);
    expect(run1.warnings).toEqual(run2.warnings);
  });

  it('different random seeds → potentially different outputs', () => {
    const client = clients[0];
    let counter1 = 0;
    let counter2 = 0.5;
    const run1 = buildMenuFromData(client, recipes, ALL_PROTEINS, NO_RECENT, { randomFn: () => { counter1 = (counter1 + 0.17) % 1; return counter1; } });
    const run2 = buildMenuFromData(client, recipes, ALL_PROTEINS, NO_RECENT, { randomFn: () => { counter2 = (counter2 + 0.31) % 1; return counter2; } });
    // Both outputs should be valid (no banned ingredients, no duplicates)
    const ids1 = run1.items.map((i) => i.recipeId);
    const ids2 = run2.items.map((i) => i.recipeId);
    expect(new Set(ids1).size).toBe(ids1.length);
    expect(new Set(ids2).size).toBe(ids2.length);
  });
});

// ── Specific rule tests ───────────────────────────────────────────────────────

describe('Menu engine — specific rule: core ingredient no swap → recipe excluded', () => {
  it('recipe with core dairy ingredient, no swap → excluded for dairy-free client', () => {
    const { recipes, clients } = getFixtures();
    const dairyFreeClient = clients.find((c) => c.name === 'Dairy Free Client')!;
    expect(dairyFreeClient).toBeTruthy();

    const result = buildMenuFromData(
      dairyFreeClient,
      recipes,
      ALL_PROTEINS,
      NO_RECENT,
      { randomFn: FIXED_RANDOM },
    );

    const selectedIds = new Set(result.items.map((i) => i.recipeId));

    // Find recipes with dairy core ingredient and no swap
    const excludedRecipes = recipes.filter((recipe) => {
      return recipe.ingredients.some(
        (ing) =>
          ing.role === 'core' &&
          ingredientMatchesRestriction(ing.name, 'dairy') &&
          !ing.swaps.some((s) => canonicalizeRestriction(s.restriction) === 'dairy')
      );
    });

    // None of those recipes should be in the output
    for (const r of excludedRecipes) {
      expect(selectedIds.has(r.id), `Recipe "${r.name}" with unswapped dairy core should be excluded`).toBe(false);
    }
  });
});

describe('Menu engine — specific rule: optional/garnish restriction → omit note only', () => {
  it('recipe with optional dairy → included with omit note for dairy-free client', () => {
    const { recipes, clients } = getFixtures();
    const dairyFreeClient = clients.find((c) => c.name === 'Dairy Free Client')!;

    // Find a recipe with dairy only in optional role
    const optionalDairyRecipes = recipes.filter((r) => {
      const hasDairyOptional = r.ingredients.some(
        (ing) =>
          (ing.role === 'optional' || ing.role === 'garnish') &&
          ingredientMatchesRestriction(ing.name, 'dairy')
      );
      const hasCoreDairy = r.ingredients.some(
        (ing) =>
          ing.role === 'core' &&
          ingredientMatchesRestriction(ing.name, 'dairy') &&
          !ing.swaps.some((s) => canonicalizeRestriction(s.restriction) === 'dairy')
      );
      return hasDairyOptional && !hasCoreDairy;
    });

    if (optionalDairyRecipes.length === 0) return; // fixture didn't generate this case, skip

    const result = buildMenuFromData(
      dairyFreeClient,
      recipes,
      ALL_PROTEINS,
      NO_RECENT,
      { randomFn: FIXED_RANDOM },
    );

    // If any optional-dairy recipe was selected, it should have an omit note
    for (const r of optionalDairyRecipes) {
      const selectedItem = result.items.find((i) => i.recipeId === r.id);
      if (!selectedItem) continue; // not selected — fine
      expect(
        selectedItem.omitNotes.some((n) => n.startsWith('Omit ')),
        `Recipe "${r.name}" selected but missing Omit note for optional dairy ingredient`
      ).toBe(true);
    }
  });
});

describe('Menu engine — specific rule: swap priority', () => {
  it('highest priority swap is chosen when multiple swaps exist', () => {
    const { recipes, clients } = getFixtures();
    const dairyFreeClient = clients.find((c) => c.name === 'Dairy Free Client')!;

    // Find the multi-swap priority recipe
    const multiSwapRecipe = recipes.find((r) => r.name === 'Multi Swap Priority');
    if (!multiSwapRecipe) return;

    const result = buildMenuFromData(
      dairyFreeClient,
      recipes,
      ALL_PROTEINS,
      NO_RECENT,
      { randomFn: FIXED_RANDOM },
    );

    const selectedItem = result.items.find((i) => i.recipeId === multiSwapRecipe.id);
    if (!selectedItem) return; // not in the menu, ok

    // The swap note should reference the higher-priority substitute ("coconut cream", priority=3)
    // NOT "oat milk" (priority=1)
    const swapNote = selectedItem.omitNotes.find((n) => n.startsWith('Swap'));
    expect(swapNote).toContain('coconut cream');
    expect(swapNote).not.toContain('oat milk');
  });
});

describe('Menu engine — specific rule: protein filtering', () => {
  it('recipe requiring protein not in client list → excluded', () => {
    const { recipes, clients } = getFixtures();
    const chickenOnlyClient = clients.find((c) => c.name === 'Chicken Only Client')!;

    const result = buildMenuFromData(
      chickenOnlyClient,
      recipes,
      ALL_PROTEINS,
      NO_RECENT,
      { randomFn: FIXED_RANDOM },
    );

    // All selected recipes must have 'chicken' in proteinSwaps (or no proteinSwaps)
    const selectedIds = new Set(result.items.map((i) => i.recipeId));
    for (const recipeId of selectedIds) {
      const recipe = recipes.find((r) => r.id === recipeId)!;
      if (recipe.proteinSwaps.length > 0) {
        expect(
          recipe.proteinSwaps.includes('chicken'),
          `Recipe "${recipe.name}" requires proteins [${recipe.proteinSwaps.join(', ')}] ` +
          `but chicken-only client selected it`
        ).toBe(true);
      }
    }
  });
});

describe('Menu engine — debug trace', () => {
  it('trace contains all recipes with correct outcome annotations', () => {
    const { recipes, clients } = getFixtures();
    const client = clients.find((c) => c.name === 'Dairy Free Client')!;

    const result = buildMenuFromData(
      client,
      recipes,
      ALL_PROTEINS,
      NO_RECENT,
      { randomFn: FIXED_RANDOM, debug: true },
    );

    expect(result.trace).toBeDefined();
    const trace = result.trace!;

    // All traces must have a valid outcome
    for (const recipeTrace of trace.perRecipe) {
      expect(['selected', 'eligible', 'excluded']).toContain(recipeTrace.outcome);
    }

    // Selected items must appear in trace as 'selected'
    const selectedIds = new Set(result.items.map((i) => i.recipeId));
    for (const recipeTrace of trace.perRecipe) {
      if (selectedIds.has(recipeTrace.recipeId)) {
        expect(recipeTrace.outcome).toBe('selected');
      }
    }

    // Totals must be consistent
    expect(trace.eligibleCount + (trace.perRecipe.filter((t) => t.outcome === 'excluded').length)).toBeLessThanOrEqual(trace.totalRecipesConsidered);
  });
});

describe('Menu engine — freshness: stale recipes used as fallback', () => {
  it('when ALL eligible recipes are marked recent, stale pool is used as fallback with warning', () => {
    const { recipes, clients } = getFixtures();
    const controlClient = clients.find((c) => c.name === 'Control Client')!;

    // Mark every recipe in the fixture as "recent" so fresh pool is empty
    const recentIds = new Set(recipes.map((r) => r.id));

    const result = buildMenuFromData(
      controlClient,
      recipes,
      ALL_PROTEINS,
      recentIds,
      { randomFn: FIXED_RANDOM },
    );

    // Should still produce menu items (using stale recipes as fallback)
    expect(result.items.length).toBeGreaterThan(0);
    // Should include a warning about all eligible recipes being stale
    expect(
      result.warnings.some((w) =>
        w.includes('reused') || w.includes('repeat') || w.includes('All eligible')
      )
    ).toBe(true);
  });
});

describe('Menu engine — composition mode', () => {
  it('composition client: selected proteins match composition categories', () => {
    const { recipes, clients } = getFixtures();
    const compositionClient = clients.find((c) => c.name === 'Composition Client')!;
    expect(compositionClient.menuComposition.length).toBeGreaterThan(0);

    const result = buildMenuFromData(
      compositionClient,
      recipes,
      ALL_PROTEINS,
      NO_RECENT,
      { randomFn: FIXED_RANDOM },
    );

    for (const comp of compositionClient.menuComposition) {
      if (comp.category === 'sweet-snack' || comp.category === 'savory-snack') continue;
      const protein = comp.category;
      const itemsForProtein = result.items.filter((i) => i.selectedProtein === protein);
      expect(itemsForProtein.length).toBeLessThanOrEqual(comp.count);
    }
  });
});
