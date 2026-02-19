import { prisma } from './prisma';
import { getClientById } from './queries/clients';
import { getAllRecipes } from './queries/recipes';
import { getRecentRecipeIdsForClient, createDraftMenu } from './queries/menus';
import type { Recipe, GenerateResult, SwapSuggestion, Client } from './types';

interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  availableProteins: string[];
  omitNotes: string[];
}

function passesTagExclusionCheck(recipe: Recipe, clientExclusions: string[]): boolean {
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

type EligibilityResult =
  | { eligible: true; omitNotes: string[] }
  | { eligible: false };

function checkIngredientEligibility(recipe: Recipe, clientExclusions: string[]): EligibilityResult {
  if (clientExclusions.length === 0) return { eligible: true, omitNotes: [] };

  const omitNotes: string[] = [];

  for (const ingredient of recipe.ingredients) {
    const nameNorm = ingredient.name.toLowerCase().trim();
    for (const exclusion of clientExclusions) {
      const exNorm = exclusion.toLowerCase().trim();
      if (nameNorm.includes(exNorm) || exNorm.includes(nameNorm)) {
        if (ingredient.role === 'optional') {
          omitNotes.push(`Omit ${ingredient.name} (${exclusion})`);
          continue;
        }
        // core ingredient — check for an approved swap for this restriction
        const swap = ingredient.swaps.find(
          (s) => s.restriction.toLowerCase().trim() === exNorm
        );
        if (swap) {
          omitNotes.push(`Swap ${ingredient.name} → ${swap.substituteIngredient} (${exclusion})`);
        } else {
          return { eligible: false };  // core, no swap → hard block
        }
      }
    }
  }

  return { eligible: true, omitNotes };
}

interface EligibleRecipe {
  recipe: Recipe;
  omitNotes: string[];
}

async function getEligibleRecipes(client: Client): Promise<{ eligible: EligibleRecipe[]; warnings: string[] }> {
  const allRecipes = await getAllRecipes();
  const warnings: string[] = [];
  const eligible: EligibleRecipe[] = [];

  for (const recipe of allRecipes) {
    // Layer 1: fast tag-based pre-filter (excludes recipes tagged as the restricted category)
    if (!passesTagExclusionCheck(recipe, client.restrictions)) continue;

    // Layer 2: ingredient-level role check (rescues recipes where only optional/garnish ingredients conflict)
    const ingredientResult = checkIngredientEligibility(recipe, client.restrictions);
    if (!ingredientResult.eligible) continue;

    if (recipe.proteinSwaps.length > 0) {
      const hasMatchingProtein = recipe.proteinSwaps.some((p) =>
        client.proteins.includes(p)
      );
      if (!hasMatchingProtein) continue;
    }

    eligible.push({ recipe, omitNotes: ingredientResult.omitNotes });
  }

  if (eligible.length < client.itemsPerMenu) {
    warnings.push(
      `Only ${eligible.length} eligible recipes found for ${client.itemsPerMenu} menu slots. ` +
      `Consider adding more recipes or adjusting client restrictions.`
    );
  }

  return { eligible, warnings };
}

function scoreRecipes(
  eligibleRecipes: EligibleRecipe[],
  client: Client
): ScoredRecipe[] {
  const cuisineWeights = new Map<string, number>();
  for (const pref of client.cuisinePreferences) {
    cuisineWeights.set(pref.cuisineType, pref.weight);
  }

  return eligibleRecipes.map(({ recipe, omitNotes }) => {
    const cuisineScore = cuisineWeights.get(recipe.cuisineType) ?? 3;
    const randomFactor = Math.random() * 2;
    const score = cuisineScore + randomFactor;

    const availableProteins = recipe.proteinSwaps.length > 0
      ? recipe.proteinSwaps.filter((p) => client.proteins.includes(p))
      : [];

    return { recipe, score, availableProteins, omitNotes };
  });
}

export async function generateMenu(clientId: string): Promise<GenerateResult> {
  const client = await getClientById(clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const warnings: string[] = [];

  const { eligible, warnings: eligibilityWarnings } = await getEligibleRecipes(client);
  warnings.push(...eligibilityWarnings);

  const recentRecipeIds = await getRecentRecipeIdsForClient(clientId, 6);

  const freshEligible = eligible.filter((r) => !recentRecipeIds.has(r.recipe.id));
  const staleEligible = eligible.filter((r) => recentRecipeIds.has(r.recipe.id));

  if (freshEligible.length === 0 && staleEligible.length > 0) {
    warnings.push(
      'All eligible recipes have been used in the last 6 menus. Some dishes will repeat.'
    );
  }

  const freshScored = scoreRecipes(freshEligible, client);
  const staleScored = scoreRecipes(staleEligible, client);

  if (client.menuComposition.length > 0) {
    return generateWithComposition(client, freshScored, staleScored, warnings);
  }

  return generateLegacy(client, freshScored, staleScored, warnings);
}

function pickCandidates(
  freshScored: ScoredRecipe[],
  staleScored: ScoredRecipe[],
  filter: (s: ScoredRecipe) => boolean,
  count: number,
  usedRecipeIds: Set<string>
): { selected: ScoredRecipe[]; usedStale: boolean } {
  const freshCandidates = freshScored
    .filter((s) => filter(s) && !usedRecipeIds.has(s.recipe.id))
    .sort((a, b) => b.score - a.score);

  const selected = freshCandidates.slice(0, count);
  let usedStale = false;

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

async function generateWithComposition(
  client: Client,
  freshScored: ScoredRecipe[],
  staleScored: ScoredRecipe[],
  warnings: string[]
): Promise<GenerateResult> {
  const usedRecipeIds = new Set<string>();
  const allItems: Array<{ recipeId: string; selectedProtein: string | null }> = [];
  const omitNotesByRecipeId = new Map<string, string[]>();
  let anyStaleUsed = false;

  const proteinCategories = client.menuComposition.filter(
    (c) => c.category !== 'sweet-snack' && c.category !== 'savory-snack'
  );
  const snackCategories = client.menuComposition.filter(
    (c) => c.category === 'sweet-snack' || c.category === 'savory-snack'
  );

  for (const comp of proteinCategories) {
    if (comp.count === 0) continue;

    const protein = comp.category;

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
      if (item.omitNotes.length > 0) omitNotesByRecipeId.set(item.recipe.id, item.omitNotes);
      allItems.push({
        recipeId: item.recipe.id,
        selectedProtein: protein,
      });
    }
  }

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
      if (item.omitNotes.length > 0) omitNotesByRecipeId.set(item.recipe.id, item.omitNotes);
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

  const itemsWithNotes = allItems.map((item) => ({
    ...item,
    omitNotes: omitNotesByRecipeId.get(item.recipeId) ?? [],
  }));

  const menu = await createDraftMenu(client.id, itemsWithNotes);

  // Build omitNotes keyed by menuItemId for the API response
  const omitNotes: Record<string, string[]> = {};
  for (const menuItem of menu.items) {
    if (menuItem.omitNotes && menuItem.omitNotes.length > 0) {
      omitNotes[menuItem.id] = menuItem.omitNotes;
    }
  }

  return { menu, warnings, omitNotes };
}

async function generateLegacy(
  client: Client,
  freshScored: ScoredRecipe[],
  staleScored: ScoredRecipe[],
  warnings: string[]
): Promise<GenerateResult> {
  const allScored = [...freshScored, ...staleScored];

  const allMeals = allScored.filter((s) => s.recipe.itemType === 'meal');
  const allSnacks = allScored.filter(
    (s) => s.recipe.itemType === 'sweet-snack' || s.recipe.itemType === 'savory-snack'
  );

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

  let proteinIndex = 0;
  const clientProteins = client.proteins;
  const result: Array<{ recipeId: string; selectedProtein: string | null }> = [];
  const omitNotesByRecipeId = new Map<string, string[]>();

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

    if (item.omitNotes.length > 0) omitNotesByRecipeId.set(item.recipe.id, item.omitNotes);
    result.push({
      recipeId: item.recipe.id,
      selectedProtein,
    });
  }

  const resultWithNotes = result.map((item) => ({
    ...item,
    omitNotes: omitNotesByRecipeId.get(item.recipeId) ?? [],
  }));

  const menu = await createDraftMenu(client.id, resultWithNotes);

  // Build omitNotes keyed by menuItemId for the API response
  const omitNotes: Record<string, string[]> = {};
  for (const menuItem of menu.items) {
    if (menuItem.omitNotes && menuItem.omitNotes.length > 0) {
      omitNotes[menuItem.id] = menuItem.omitNotes;
    }
  }

  return { menu, warnings, omitNotes };
}

export async function getSwapSuggestions(
  menuId: string,
  menuItemId: string
): Promise<{ suggestions: SwapSuggestion[]; warnings: string[] }> {
  const warnings: string[] = [];

  const menuRow = await prisma.menu.findUnique({
    where: { id: menuId },
    select: { clientId: true },
  });
  if (!menuRow) throw new Error('Menu not found');

  const client = await getClientById(menuRow.clientId);
  if (!client) throw new Error('Client not found');

  const menuItemRow = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    select: { recipeId: true, selectedProtein: true, recipe: { select: { itemType: true } } },
  });

  const currentItems = await prisma.menuItem.findMany({
    where: { menuId },
    select: { recipeId: true },
  });
  const currentRecipeIds = new Set(currentItems.map((i) => i.recipeId));

  const { eligible } = await getEligibleRecipes(client);

  let available = eligible.filter((r) => !currentRecipeIds.has(r.recipe.id));

  if (menuItemRow) {
    const itemType = menuItemRow.recipe.itemType;
    if (itemType === 'meal') {
      available = available.filter((r) => r.recipe.itemType === 'meal');
    } else {
      available = available.filter((r) => r.recipe.itemType === itemType);
      if (available.length === 0) {
        available = eligible
          .filter((r) => !currentRecipeIds.has(r.recipe.id))
          .filter((r) => r.recipe.itemType === 'sweet-snack' || r.recipe.itemType === 'savory-snack');
      }
    }
  }

  if (available.length === 0) {
    warnings.push('No alternative recipes available that match this client\'s restrictions.');
    return { suggestions: [], warnings };
  }

  const recentRecipeIds = await getRecentRecipeIdsForClient(menuRow.clientId, 6);
  const freshAvailable = available.filter((r) => !recentRecipeIds.has(r.recipe.id));
  const staleAvailable = available.filter((r) => recentRecipeIds.has(r.recipe.id));

  const freshSuggestions = scoreRecipes(freshAvailable, client);
  const staleSuggestions = scoreRecipes(staleAvailable, client);

  freshSuggestions.sort((a, b) => b.score - a.score);
  staleSuggestions.sort((a, b) => b.score - a.score);

  const allSuggestions = [...freshSuggestions, ...staleSuggestions];

  const suggestions: SwapSuggestion[] = allSuggestions.slice(0, 8).map((s) => ({
    recipe: s.recipe,
    score: s.score,
    availableProteins: s.availableProteins,
    omitNotes: s.omitNotes,
  }));

  return { suggestions, warnings };
}
