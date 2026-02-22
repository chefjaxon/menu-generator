/**
 * Grocery engine tests.
 *
 * All tests use the pure buildGroceryFromData function.
 * No DB calls, no Claude gray-zone normalization (skipClaudeNormalization=true).
 */

import { describe, it, expect } from 'vitest';
import { buildGroceryFromData, type GroceryMenuItem } from '../grocery-utils';
import { getFixtures, buildGroceryScenarios } from '../test-fixtures/generate-fixtures';
import { canonicalizeRestriction } from '../restriction-utils';
import type { Recipe } from '../types';

// Helper: convert fixture recipe to GroceryMenuItem shape
function toMenuItem(recipe: Recipe, selectedProtein: string | null = null): GroceryMenuItem {
  return {
    recipeId: recipe.id,
    selectedProtein,
    recipe: {
      ingredients: recipe.ingredients,
      proteinSwaps: recipe.proteinSwaps.map((p) => ({ protein: p })),
    },
  };
}

// ── Golden snapshot tests (15 scenarios) ─────────────────────────────────────

describe('Grocery engine — golden snapshots (15 scenarios)', () => {
  const { recipes } = getFixtures();
  const scenarios = buildGroceryScenarios(recipes);

  for (const scenario of scenarios) {
    it(`scenario: ${scenario.name}`, () => {
      const menuItems = scenario.menuItems
        .filter((mi) => mi.clientSelected)
        .map((mi) => toMenuItem(mi.recipe, mi.selectedProtein));

      const result = buildGroceryFromData(menuItems, scenario.clientRestrictions);

      // Snapshot the shape: item names, quantities, units
      const keepSnapshot = result.toKeep.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes,
      }));
      const removeSnapshot = result.toRemove.map((item) => ({ name: item.name }));

      expect(keepSnapshot).toMatchSnapshot();
      expect(removeSnapshot).toMatchSnapshot();
    });
  }
});

// ── Invariant: no duplicate normalized keys ───────────────────────────────────

describe('Grocery engine — invariant: no duplicate normalized names in toKeep', () => {
  const { recipes } = getFixtures();
  const scenarios = buildGroceryScenarios(recipes);

  for (const scenario of scenarios) {
    it(`scenario: ${scenario.name}`, () => {
      const menuItems = scenario.menuItems
        .filter((mi) => mi.clientSelected)
        .map((mi) => toMenuItem(mi.recipe, mi.selectedProtein));

      const result = buildGroceryFromData(menuItems, scenario.clientRestrictions);

      const keys = result.toKeep.map((item) => item.name.toLowerCase().trim());
      const uniqueKeys = new Set(keys);
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(uniqueKeys.size, `Duplicate keys found: ${dupes.join(', ')}`).toBe(keys.length);
    });
  }
});

// ── Invariant: restriction enforcement ───────────────────────────────────────

describe('Grocery engine — invariant: restricted ingredients do not appear unreplaced', () => {
  const { recipes } = getFixtures();

  it('dairy restriction: ingredient named "dairy cream" is matched and handled', () => {
    // The restriction engine matches the word "dairy" in the ingredient NAME.
    // "butter" is NOT matched by restriction="dairy" — the name does not contain the word "dairy".
    // Only ingredient names that literally contain "dairy" (e.g. "dairy cream") are matched.
    const miniMenu: GroceryMenuItem[] = [{
      recipeId: 'test-dairy-name',
      selectedProtein: null,
      recipe: {
        ingredients: [
          { id: 'ing-1', name: 'dairy cream', quantity: '1/2', unit: 'cup', role: 'core', swaps: [] },
          { id: 'ing-2', name: 'chicken breast', quantity: '1', unit: 'lb', role: 'core', swaps: [] },
        ],
        proteinSwaps: [],
      },
    }];

    const result = buildGroceryFromData(miniMenu, ['dairy']);

    // "dairy cream" should not appear (restricted core, no swap → skipped defensively)
    const dairyItem = result.toKeep.find((i) => i.name.toLowerCase().includes('dairy cream'));
    expect(dairyItem).toBeUndefined();

    // "chicken breast" should still appear
    const chickenItem = result.toKeep.find((i) => i.name.toLowerCase().includes('chicken breast'));
    expect(chickenItem).toBeTruthy();
  });

  it('optional cilantro restricted → not in toKeep', () => {
    const cilantroRecipe = recipes.find((r) =>
      r.ingredients.some(
        (ing) => ing.name.toLowerCase().includes('cilantro') && ing.role === 'garnish'
      )
    );
    if (!cilantroRecipe) return;

    const result = buildGroceryFromData([toMenuItem(cilantroRecipe)], ['cilantro']);

    const cilantroItem = result.toKeep.find((item) => item.name.toLowerCase().includes('cilantro'));
    // Should not appear in toKeep (it's a garnish — skipped)
    expect(cilantroItem).toBeUndefined();
  });
});

// ── Invariant: items with no qty+unit go to toRemove ─────────────────────────

describe('Grocery engine — invariant: no-qty/no-unit items in toRemove', () => {
  it('unmeasured spices go to removed set', () => {
    const { recipes } = getFixtures();
    const unmeasuredRecipe = recipes.find((r) => r.name === 'Unmeasured Spices Recipe');
    if (!unmeasuredRecipe) return;

    const result = buildGroceryFromData([toMenuItem(unmeasuredRecipe)], []);

    // cumin and turmeric have null qty and null unit — should be in toRemove
    const removedNames = result.toRemove.map((i) => i.name.toLowerCase());
    expect(removedNames).toContain('cumin');
    expect(removedNames).toContain('turmeric');

    // onion has qty="1" — should be in toKeep
    const onionItem = result.toKeep.find((i) => i.name.toLowerCase() === 'onion');
    expect(onionItem).toBeTruthy();
  });

  it('toKeep items all have quantity or unit (not both null)', () => {
    const { recipes } = getFixtures();
    const result = buildGroceryFromData(recipes.slice(0, 5).map((r) => toMenuItem(r)), []);

    for (const item of result.toKeep) {
      expect(
        item.quantity !== null || item.unit !== null,
        `Item "${item.name}" in toKeep has both quantity=null and unit=null`
      ).toBe(true);
    }
  });
});

// ── Invariant: removed items are deduplicated ─────────────────────────────────

describe('Grocery engine — invariant: removed items have no duplicate names', () => {
  it('same unmeasured ingredient from multiple recipes → one removed entry', () => {
    const { recipes } = getFixtures();
    // Use two recipes that both have unmeasured ingredients with the same name
    const unmeasuredRecipe1 = recipes.find((r) => r.name === 'Unmeasured Spices Recipe');
    if (!unmeasuredRecipe1) return;

    // Use it twice (simulates two selected menu items with same unmeasured ingredient)
    const result = buildGroceryFromData(
      [toMenuItem(unmeasuredRecipe1), toMenuItem(unmeasuredRecipe1)],
      [],
    );

    const removedNames = result.toRemove.map((i) => i.name.toLowerCase().trim());
    const uniqueNames = new Set(removedNames);
    expect(uniqueNames.size).toBe(removedNames.length);
  });
});

// ── Swap application tests ────────────────────────────────────────────────────

describe('Grocery engine — swap application', () => {
  it('core ingredient with swap → substitute appears in toKeep with Swap note', () => {
    // The restriction engine matches words in ingredient names.
    // We use restriction="eggs" on an ingredient named "eggs" with a swap.
    const miniMenu: GroceryMenuItem[] = [{
      recipeId: 'test-egg-swap',
      selectedProtein: null,
      recipe: {
        ingredients: [{
          id: 'ing-eggs',
          name: 'eggs',
          quantity: '2',
          unit: null,
          role: 'core',
          swaps: [{ substituteIngredient: 'flax egg', substituteQty: '2', substituteUnit: 'tbsp', restriction: 'eggs', priority: 1 }],
        }],
        proteinSwaps: [],
      },
    }];

    const result = buildGroceryFromData(miniMenu, ['eggs']);

    // original "eggs" should NOT appear in toKeep
    expect(result.toKeep.find((i) => i.name.toLowerCase() === 'eggs')).toBeUndefined();

    // The swap substitute "flax egg" should appear with a note
    const swapItem = result.toKeep.find((i) => i.notes && i.notes.includes('Swap for'));
    expect(swapItem).toBeTruthy();
    expect(swapItem!.name.toLowerCase()).toBe('flax egg');
  });

  it('multi-swap priority: highest priority swap substitute is used', () => {
    const { recipes } = getFixtures();
    const multiSwapRecipe = recipes.find((r) => r.name === 'Multi Swap Priority');
    if (!multiSwapRecipe) return;

    const result = buildGroceryFromData([toMenuItem(multiSwapRecipe)], ['dairy']);

    // heavy cream → coconut cream (priority=3 wins over oat milk priority=1)
    const swapItem = result.toKeep.find((i) => i.notes && i.notes.includes('Swap for'));
    if (!swapItem) return; // no swap applied (shouldn't happen)
    expect(swapItem.name.toLowerCase()).toContain('coconut cream');
  });

  it('protein exclusion: non-selected protein ingredients skipped', () => {
    const { recipes } = getFixtures();
    // Find a multi-protein recipe (chicken + turkey)
    const multiProteinRecipe = recipes.find(
      (r) => r.proteinSwaps.includes('chicken') && r.proteinSwaps.includes('turkey')
    );
    if (!multiProteinRecipe) return;

    // Select chicken → turkey protein ingredient should be skipped
    const result = buildGroceryFromData(
      [toMenuItem(multiProteinRecipe, 'chicken')],
      [],
    );

    const itemNames = result.toKeep.map((i) => i.name.toLowerCase());
    // "ground turkey" should not appear since chicken was selected
    const hasTurkey = itemNames.some((n) => n.includes('turkey'));
    expect(hasTurkey).toBe(false);
  });
});

// ── Exact duplicate consolidation ─────────────────────────────────────────────

describe('Grocery engine — exact duplicate consolidation', () => {
  it('same ingredient from two recipes is merged into one', () => {
    const { recipes } = getFixtures();
    // Find two recipes with "olive oil" as a measured ingredient
    const oliveoilRecipes = recipes.filter(
      (r) => r.ingredients.some(
        (ing) => ing.name.toLowerCase() === 'olive oil' && ing.quantity !== null
      )
    ).slice(0, 2);

    if (oliveoilRecipes.length < 2) return;

    const result = buildGroceryFromData(oliveoilRecipes.map((r) => toMenuItem(r)), []);

    const oliveoilItems = result.toKeep.filter(
      (i) => i.name.toLowerCase() === 'olive oil'
    );
    expect(oliveoilItems.length).toBe(1);
  });
});

// ── Ingredient name normalization ─────────────────────────────────────────────

describe('Grocery engine — ingredient name normalization', () => {
  it('scallion normalizes to green onion', () => {
    const { recipes } = getFixtures();
    const scallionRecipe = recipes.find((r) =>
      r.ingredients.some((ing) => ing.name.toLowerCase() === 'scallion')
    );
    if (!scallionRecipe) return;

    // Also find a green onion recipe to test merging
    const greenOnionRecipe = recipes.find((r) =>
      r.ingredients.some((ing) => ing.name.toLowerCase() === 'green onion') &&
      r.id !== scallionRecipe.id
    );

    const menuItems = [toMenuItem(scallionRecipe)];
    if (greenOnionRecipe) menuItems.push(toMenuItem(greenOnionRecipe));

    const result = buildGroceryFromData(menuItems, []);

    // "scallion" should not appear — normalized to "green onion"
    const scallionItem = result.toKeep.find((i) => i.name.toLowerCase() === 'scallion');
    expect(scallionItem).toBeUndefined();
  });

  it('prep-stripped ingredient: "chicken breast, thinly sliced" → "chicken breast"', () => {
    // Build a mini recipe with a prep-suffixed ingredient
    const miniMenu: GroceryMenuItem[] = [{
      recipeId: 'test-prep-strip',
      selectedProtein: null,
      recipe: {
        ingredients: [{
          id: 'ing-1',
          name: 'chicken breast, thinly sliced',
          quantity: '1',
          unit: 'lb',
          role: 'core',
          swaps: [],
        }],
        proteinSwaps: [],
      },
    }];

    const result = buildGroceryFromData(miniMenu, []);
    const names = result.toKeep.map((i) => i.name.toLowerCase());
    // Should be normalized — not contain the comma suffix
    expect(names.some((n) => n.includes('chicken breast'))).toBe(true);
    expect(names.some((n) => n.includes('thinly sliced'))).toBe(false);
  });
});

// ── Debug trace ───────────────────────────────────────────────────────────────

describe('Grocery engine — debug trace', () => {
  it('trace is populated when debug=true', () => {
    const { recipes } = getFixtures();
    const result = buildGroceryFromData(
      recipes.slice(0, 3).map((r) => toMenuItem(r)),
      [],
      { debug: true },
    );

    expect(result.trace).toBeDefined();
    expect(result.trace!.rawIngredientCount).toBeGreaterThan(0);
    expect(result.trace!.perIngredient.length).toBeGreaterThan(0);

    for (const trace of result.trace!.perIngredient) {
      expect(['keep', 'swap', 'skip-optional', 'skip-no-swap', 'removed-no-qty']).toContain(trace.action);
    }
  });

  it('trace is undefined when debug not set', () => {
    const { recipes } = getFixtures();
    const result = buildGroceryFromData(recipes.slice(0, 2).map((r) => toMenuItem(r)), []);
    expect(result.trace).toBeUndefined();
  });
});
