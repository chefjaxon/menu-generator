import { getDb } from './db';
import { getClientById } from './queries/clients';
import { getAllRecipes } from './queries/recipes';
import { getRecentRecipeIdsForClient, createDraftMenu } from './queries/menus';
import type { Recipe, Protein, GenerateResult, SwapSuggestion, Client } from './types';

interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  availableProteins: Protein[];
}

/**
 * Check if a recipe is eligible for a client based on exclusion-based restrictions.
 * If the recipe's "contains" tags include anything the client excludes → ineligible.
 */
function passesExclusionCheck(recipe: Recipe, clientExclusions: string[]): boolean {
  if (clientExclusions.length === 0) return true;

  const recipeTags = recipe.tags.map((t) => t.toLowerCase().trim());
  for (const exclusion of clientExclusions) {
    const normalizedExclusion = exclusion.toLowerCase().trim();
    if (recipeTags.includes(normalizedExclusion)) {
      return false;
    }
  }
  return true;
}

function getEligibleRecipes(client: Client): { eligible: Recipe[]; warnings: string[] } {
  const allRecipes = getAllRecipes();
  const warnings: string[] = [];
  const eligible: Recipe[] = [];

  for (const recipe of allRecipes) {
    // Check exclusion-based restrictions
    // If client excludes "dairy" and recipe is tagged with "dairy" → skip
    if (!passesExclusionCheck(recipe, client.restrictions)) continue;

    // Check protein compatibility
    // Recipe is eligible if:
    // 1. It has no protein swaps (protein-free dish like salad) — always eligible
    // 2. At least one of its proteins matches the client's protein preferences
    if (recipe.proteinSwaps.length > 0) {
      const hasMatchingProtein = recipe.proteinSwaps.some((p) =>
        client.proteins.includes(p)
      );
      if (!hasMatchingProtein) continue;
    }

    eligible.push(recipe);
  }

  if (eligible.length < client.itemsPerMenu) {
    warnings.push(
      `Only ${eligible.length} eligible recipes found for ${client.itemsPerMenu} menu slots. ` +
      `Consider adding more recipes or adjusting client restrictions.`
    );
  }

  return { eligible, warnings };
}

/**
 * Score recipes based on cuisine preference + randomness for variety.
 * No freshness penalty here — freshness is handled by the hard fresh/stale split.
 */
function scoreRecipes(
  recipes: Recipe[],
  client: Client
): ScoredRecipe[] {
  // Build cuisine weight lookup from client preferences
  const cuisineWeights = new Map<string, number>();
  for (const pref of client.cuisinePreferences) {
    cuisineWeights.set(pref.cuisineType, pref.weight);
  }

  return recipes.map((recipe) => {
    // Cuisine weight (1-5, default 3 for unspecified)
    const cuisineScore = cuisineWeights.get(recipe.cuisineType) ?? 3;

    // Randomness for variety
    const randomFactor = Math.random() * 2;

    const score = cuisineScore + randomFactor;

    // Determine available proteins for this client
    const availableProteins = recipe.proteinSwaps.length > 0
      ? recipe.proteinSwaps.filter((p) => client.proteins.includes(p))
      : [];

    return { recipe, score, availableProteins };
  });
}

export function generateMenu(clientId: string): GenerateResult {
  const client = getClientById(clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const warnings: string[] = [];

  // Get eligible recipes
  const { eligible, warnings: eligibilityWarnings } = getEligibleRecipes(client);
  warnings.push(...eligibilityWarnings);

  // Get recent history — recipes from the last 6 finalized menus
  const recentRecipeIds = getRecentRecipeIdsForClient(clientId, 6);

  // HARD NO-REPEAT: Split eligible recipes into fresh (not in recent 6) and stale (in recent 6)
  const freshEligible = eligible.filter((r) => !recentRecipeIds.has(r.id));
  const staleEligible = eligible.filter((r) => recentRecipeIds.has(r.id));

  if (freshEligible.length === 0 && staleEligible.length > 0) {
    warnings.push(
      'All eligible recipes have been used in the last 6 menus. Some dishes will repeat.'
    );
  }

  // Score both pools
  const freshScored = scoreRecipes(freshEligible, client);
  const staleScored = scoreRecipes(staleEligible, client);

  // If client has menu composition, use per-category generation
  if (client.menuComposition.length > 0) {
    return generateWithComposition(client, freshScored, staleScored, warnings);
  }

  // Legacy fallback: use itemsPerMenu with auto-split
  return generateLegacy(client, freshScored, staleScored, warnings);
}

/**
 * Pick candidates from the fresh pool first, then overflow into stale pool.
 * Returns the combined sorted array of candidates for a given filter.
 */
function pickCandidates(
  freshScored: ScoredRecipe[],
  staleScored: ScoredRecipe[],
  filter: (s: ScoredRecipe) => boolean,
  count: number,
  usedRecipeIds: Set<string>
): { selected: ScoredRecipe[]; usedStale: boolean } {
  // Apply filter + exclude already-used recipes
  const freshCandidates = freshScored
    .filter((s) => filter(s) && !usedRecipeIds.has(s.recipe.id))
    .sort((a, b) => b.score - a.score);

  const selected = freshCandidates.slice(0, count);
  let usedStale = false;

  // If fresh pool wasn't enough, fill remaining from stale pool
  if (selected.length < count) {
    const remaining = count - selected.length;
    const staleCandidates = staleScored
      .filter((s) => filter(s) && !usedRecipeIds.has(s.recipe.id))
      .sort((a, b) => b.score - a.score);

    const staleSelected = staleCandidates.slice(0, remaining);
    if (staleSelected.length > 0) {
      usedStale = true;
      selected.push(...staleSelected);
    }
  }

  return { selected, usedStale };
}

/**
 * Composition-based generation: pick exact counts per protein + snack type.
 * Uses fresh recipes first, falling back to stale only when fresh pool is exhausted.
 */
function generateWithComposition(
  client: Client,
  freshScored: ScoredRecipe[],
  staleScored: ScoredRecipe[],
  warnings: string[]
): GenerateResult {
  const usedRecipeIds = new Set<string>();
  const allItems: Array<{ recipeId: string; selectedProtein: string | null }> = [];
  let anyStaleUsed = false;

  // Separate composition into protein categories and snack categories
  const proteinCategories = client.menuComposition.filter(
    (c) => c.category !== 'sweet-snack' && c.category !== 'savory-snack'
  );
  const snackCategories = client.menuComposition.filter(
    (c) => c.category === 'sweet-snack' || c.category === 'savory-snack'
  );

  // Process each protein category
  for (const comp of proteinCategories) {
    if (comp.count === 0) continue;

    const protein = comp.category as Protein;

    const { selected, usedStale } = pickCandidates(
      freshScored,
      staleScored,
      (s) =>
        s.recipe.itemType === 'meal' &&
        s.recipe.proteinSwaps.includes(protein),
      comp.count,
      usedRecipeIds
    );

    if (usedStale) anyStaleUsed = true;

    if (selected.length < comp.count) {
      warnings.push(
        `Could only fill ${selected.length} of ${comp.count} ${comp.category} meal slots.`
      );
    }

    for (const item of selected) {
      usedRecipeIds.add(item.recipe.id);
      allItems.push({
        recipeId: item.recipe.id,
        selectedProtein: protein,
      });
    }
  }

  // Process each snack category
  for (const comp of snackCategories) {
    if (comp.count === 0) continue;

    const { selected, usedStale } = pickCandidates(
      freshScored,
      staleScored,
      (s) => s.recipe.itemType === comp.category,
      comp.count,
      usedRecipeIds
    );

    if (usedStale) anyStaleUsed = true;

    if (selected.length < comp.count) {
      warnings.push(
        `Could only fill ${selected.length} of ${comp.count} ${comp.category.replace('-', ' ')} slots.`
      );
    }

    for (const item of selected) {
      usedRecipeIds.add(item.recipe.id);
      allItems.push({
        recipeId: item.recipe.id,
        selectedProtein: null,
      });
    }
  }

  if (anyStaleUsed) {
    warnings.push(
      'Some dishes from the last 6 menus were reused because not enough fresh recipes were available.'
    );
  }

  const totalRequested = client.menuComposition.reduce((sum, c) => sum + c.count, 0);
  if (allItems.length < totalRequested) {
    warnings.push(
      `Could only fill ${allItems.length} of ${totalRequested} total slots.`
    );
  }

  // Create draft menu
  const menu = createDraftMenu(client.id, allItems);

  return { menu, warnings };
}

/**
 * Legacy generation: single itemsPerMenu with automatic meal/snack split.
 * Uses fresh recipes first, falling back to stale only when fresh pool is exhausted.
 */
function generateLegacy(
  client: Client,
  freshScored: ScoredRecipe[],
  staleScored: ScoredRecipe[],
  warnings: string[]
): GenerateResult {
  // Combine fresh and stale for counting (fresh first for priority)
  const allScored = [...freshScored, ...staleScored];

  // Split into meals and snacks (for counting available slots)
  const allMeals = allScored.filter((s) => s.recipe.itemType === 'meal');
  const allSnacks = allScored.filter(
    (s) => s.recipe.itemType === 'sweet-snack' || s.recipe.itemType === 'savory-snack'
  );

  // Determine meal/snack split
  const totalItems = client.itemsPerMenu;
  let snackCount = Math.max(1, Math.floor(totalItems * 0.2));
  if (allSnacks.length === 0) snackCount = 0;
  if (snackCount > allSnacks.length) snackCount = allSnacks.length;
  const mealCount = Math.min(totalItems - snackCount, allMeals.length);

  if (mealCount + snackCount < totalItems) {
    warnings.push(
      `Could only fill ${mealCount + snackCount} of ${totalItems} slots.`
    );
  }

  const usedRecipeIds = new Set<string>();
  let anyStaleUsed = false;

  // Pick meals: fresh first, then stale
  const { selected: selectedMeals, usedStale: mealStale } = pickCandidates(
    freshScored,
    staleScored,
    (s) => s.recipe.itemType === 'meal',
    mealCount,
    usedRecipeIds
  );
  if (mealStale) anyStaleUsed = true;
  for (const item of selectedMeals) {
    usedRecipeIds.add(item.recipe.id);
  }

  // Pick snacks: fresh first, then stale
  const { selected: selectedSnacks, usedStale: snackStale } = pickCandidates(
    freshScored,
    staleScored,
    (s) => s.recipe.itemType === 'sweet-snack' || s.recipe.itemType === 'savory-snack',
    snackCount,
    usedRecipeIds
  );
  if (snackStale) anyStaleUsed = true;

  const selected = [...selectedMeals, ...selectedSnacks];

  if (anyStaleUsed) {
    warnings.push(
      'Some dishes from the last 6 menus were reused because not enough fresh recipes were available.'
    );
  }

  // Rotate through client's proteins for variety
  let proteinIndex = 0;
  const clientProteins = client.proteins;
  const result: Array<{ recipeId: string; selectedProtein: string | null }> = [];

  for (const item of selected) {
    let selectedProtein: string | null = null;

    if (item.availableProteins.length > 0) {
      const rotationProtein = clientProteins[proteinIndex % clientProteins.length];
      if (item.availableProteins.includes(rotationProtein)) {
        selectedProtein = rotationProtein;
      } else {
        selectedProtein = item.availableProteins[0];
      }
      proteinIndex++;
    }

    result.push({
      recipeId: item.recipe.id,
      selectedProtein,
    });
  }

  // Create draft menu
  const menu = createDraftMenu(client.id, result);

  return { menu, warnings };
}

export function getSwapSuggestions(
  menuId: string,
  menuItemId: string
): { suggestions: SwapSuggestion[]; warnings: string[] } {
  const db = getDb();
  const warnings: string[] = [];

  // Get the menu and its client
  const menuRow = db.prepare('SELECT * FROM menus WHERE id = ?').get(menuId) as { client_id: string } | undefined;
  if (!menuRow) throw new Error('Menu not found');

  const client = getClientById(menuRow.client_id);
  if (!client) throw new Error('Client not found');

  // Get the current menu item to understand what type we're swapping
  const menuItemRow = db.prepare(
    'SELECT mi.*, r.item_type FROM menu_items mi JOIN recipes r ON r.id = mi.recipe_id WHERE mi.id = ?'
  ).get(menuItemId) as { recipe_id: string; selected_protein: string | null; item_type: string } | undefined;

  // Get current menu items to exclude
  const currentItems = db.prepare(
    'SELECT recipe_id FROM menu_items WHERE menu_id = ?'
  ).all(menuId) as Array<{ recipe_id: string }>;
  const currentRecipeIds = new Set(currentItems.map((i) => i.recipe_id));

  // Get eligible recipes
  const { eligible } = getEligibleRecipes(client);

  // Filter out recipes already on this menu
  let available = eligible.filter((r) => !currentRecipeIds.has(r.id));

  // If we know the item type, filter to same type for better swap suggestions
  if (menuItemRow) {
    const itemType = menuItemRow.item_type;
    if (itemType === 'meal') {
      available = available.filter((r) => r.itemType === 'meal');
    } else {
      // For snacks, suggest same snack type
      available = available.filter((r) => r.itemType === itemType);
      // If no matches, fall back to any snack type
      if (available.length === 0) {
        available = eligible
          .filter((r) => !currentRecipeIds.has(r.id))
          .filter((r) => r.itemType === 'sweet-snack' || r.itemType === 'savory-snack');
      }
    }
  }

  if (available.length === 0) {
    warnings.push('No alternative recipes available that match this client\'s restrictions.');
    return { suggestions: [], warnings };
  }

  // Score them — fresh recipes get priority in swap suggestions too
  const recentRecipeIds = getRecentRecipeIdsForClient(menuRow.client_id, 6);
  const freshAvailable = available.filter((r) => !recentRecipeIds.has(r.id));
  const staleAvailable = available.filter((r) => recentRecipeIds.has(r.id));

  // Score fresh first, stale second
  const freshSuggestions = scoreRecipes(freshAvailable, client);
  const staleSuggestions = scoreRecipes(staleAvailable, client);

  // Sort each pool by score, then combine fresh first
  freshSuggestions.sort((a, b) => b.score - a.score);
  staleSuggestions.sort((a, b) => b.score - a.score);

  const allSuggestions = [...freshSuggestions, ...staleSuggestions];

  // Return top 8 suggestions (fresh recipes will naturally come first)
  const suggestions: SwapSuggestion[] = allSuggestions.slice(0, 8).map((s) => ({
    recipe: s.recipe,
    score: s.score,
    availableProteins: s.availableProteins,
  }));

  return { suggestions, warnings };
}
