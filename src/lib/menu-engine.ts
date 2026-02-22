import { prisma } from './prisma';
import { getClientById } from './queries/clients';
import { getAllRecipes } from './queries/recipes';
import { getAllProteins } from './queries/proteins';
import { getRecentRecipeIdsForClient, createDraftMenu } from './queries/menus';
import { canonicalizeRestriction, ingredientMatchesRestriction } from './restriction-utils';
import type { Recipe, GenerateResult, SwapSuggestion, Client } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  availableProteins: string[];
  omitNotes: string[];
}

type EligibilityResult =
  | { eligible: true; omitNotes: string[] }
  | { eligible: false };

interface EligibleRecipe {
  recipe: Recipe;
  omitNotes: string[];
}

// ── Debug trace types (exported for test use) ─────────────────────────────────

export interface IngredientTrace {
  ingredientName: string;
  role: string;
  matched: boolean;
  restriction?: string;
  action: 'keep' | 'omit' | 'swap' | 'hard-block';
  swapTo?: string;
}

export interface RecipeTrace {
  recipeId: string;
  recipeName: string;
  outcome: 'selected' | 'eligible' | 'excluded';
  tagGateResult: 'passed' | 'blocked';
  tagBlockReason?: string;
  ingredientResults: IngredientTrace[];
  proteinFilterResult: 'passed' | 'blocked' | 'not-applicable';
  score: number;
  fresh: boolean;
}

export interface MenuGenerationTrace {
  clientId: string;
  totalRecipesConsidered: number;
  eligibleCount: number;
  freshCount: number;
  staleCount: number;
  perRecipe: RecipeTrace[];
  warnings: string[];
}

export interface BuildMenuOptions {
  /** Inject a custom score function instead of Math.random. Receives no args, returns [0, 2). */
  randomFn?: () => number;
  /** When true, populate trace in the returned result. */
  debug?: boolean;
}

export interface BuildMenuResult {
  items: Array<{ recipeId: string; selectedProtein: string | null; omitNotes: string[] }>;
  warnings: string[];
  trace?: MenuGenerationTrace;
}

// ── Restriction checking (pure) ───────────────────────────────────────────────

// Layer 1: tag-based gate — blocks a recipe if it has a restriction tag that the client
// is restricted from AND no ingredient swap exists for that restriction.
// Recipes with no tags are assumed safe (pass through).
// Protein tags (e.g. "pork", "chicken") are skipped — they represent OR options, not
// dietary requirements, and are already handled by the protein-matching step.
function passesTagExclusionCheck(
  recipe: Recipe,
  clientRestrictions: string[],
  knownProteins: string[]
): { passed: boolean; blockReason?: string } {
  if (clientRestrictions.length === 0) return { passed: true };
  if (recipe.tags.length === 0) return { passed: true };

  const proteinSet = new Set(knownProteins.map((p) => p.toLowerCase().trim()));

  for (const restriction of clientRestrictions) {
    const canon = canonicalizeRestriction(restriction);
    const tagMatches = recipe.tags.some(
      (tag) =>
        !proteinSet.has(tag.toLowerCase().trim()) && // skip protein tags
        canonicalizeRestriction(tag) === canon
    );
    if (!tagMatches) continue; // recipe doesn't contain this restriction

    // Recipe has this restriction tag — only allowed if an ingredient swap covers it
    const hasSwap = recipe.ingredients.some((ing) =>
      ing.swaps.some((s) => canonicalizeRestriction(s.restriction) === canon)
    );
    if (!hasSwap) {
      return { passed: false, blockReason: `tag "${restriction}" with no covering swap` };
    }
  }
  return { passed: true };
}

function checkIngredientEligibility(
  recipe: Recipe,
  clientExclusions: string[],
  debug: boolean
): EligibilityResult & { ingredientTraces: IngredientTrace[] } {
  const ingredientTraces: IngredientTrace[] = [];

  if (clientExclusions.length === 0) {
    if (debug) {
      for (const ing of recipe.ingredients) {
        ingredientTraces.push({ ingredientName: ing.name, role: ing.role, matched: false, action: 'keep' });
      }
    }
    return { eligible: true, omitNotes: [], ingredientTraces };
  }

  const omitNotes: string[] = [];

  for (const ingredient of recipe.ingredients) {
    let matched = false;
    let matchedRestriction: string | undefined;

    for (const exclusion of clientExclusions) {
      if (!ingredientMatchesRestriction(ingredient.name, exclusion)) continue;

      matched = true;
      matchedRestriction = exclusion;

      if (ingredient.role === 'optional' || ingredient.role === 'garnish') {
        omitNotes.push(`Omit ${ingredient.name} (${exclusion})`);
        if (debug) ingredientTraces.push({ ingredientName: ingredient.name, role: ingredient.role, matched: true, restriction: exclusion, action: 'omit' });
        break; // ingredient handled — move to next ingredient
      }

      // core ingredient — find best swap by priority descending
      const swap = ingredient.swaps
        .filter((s) => canonicalizeRestriction(s.restriction) === exclusion)
        .sort((a, b) => b.priority - a.priority)[0];

      if (swap) {
        omitNotes.push(`Swap ${ingredient.name} → ${swap.substituteIngredient} (${exclusion})`);
        if (debug) ingredientTraces.push({ ingredientName: ingredient.name, role: ingredient.role, matched: true, restriction: exclusion, action: 'swap', swapTo: swap.substituteIngredient });
      } else {
        if (debug) ingredientTraces.push({ ingredientName: ingredient.name, role: ingredient.role, matched: true, restriction: exclusion, action: 'hard-block' });
        return { eligible: false, ingredientTraces };
      }
      break; // handled — move to next ingredient
    }

    if (!matched && debug) {
      ingredientTraces.push({ ingredientName: ingredient.name, role: ingredient.role, matched: false, action: 'keep' });
    }
    void matchedRestriction; // used in debug push above
  }

  return { eligible: true, omitNotes, ingredientTraces };
}

// ── Eligibility filtering (pure) ──────────────────────────────────────────────

function filterEligibleRecipes(
  allRecipes: Recipe[],
  client: Client,
  knownProteins: string[],
  options: BuildMenuOptions,
): { eligible: EligibleRecipe[]; warnings: string[]; recipeTraces: RecipeTrace[] } {
  const warnings: string[] = [];
  const eligible: EligibleRecipe[] = [];
  const recipeTraces: RecipeTrace[] = [];
  const debug = options.debug ?? false;

  const clientExclusions = client.restrictions.map((r) => canonicalizeRestriction(r));

  for (const recipe of allRecipes) {
    // Layer 1: tag-based gate
    const tagResult = passesTagExclusionCheck(recipe, client.restrictions, knownProteins);
    if (!tagResult.passed) {
      if (debug) {
        recipeTraces.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          outcome: 'excluded',
          tagGateResult: 'blocked',
          tagBlockReason: tagResult.blockReason,
          ingredientResults: [],
          proteinFilterResult: 'not-applicable',
          score: 0,
          fresh: false,
        });
      }
      continue;
    }

    // Layer 2: ingredient-level check
    const ingredientResult = checkIngredientEligibility(recipe, clientExclusions, debug);
    if (!ingredientResult.eligible) {
      if (debug) {
        recipeTraces.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          outcome: 'excluded',
          tagGateResult: 'passed',
          ingredientResults: ingredientResult.ingredientTraces,
          proteinFilterResult: 'not-applicable',
          score: 0,
          fresh: false,
        });
      }
      continue;
    }

    // Layer 3: protein swap filter
    if (recipe.proteinSwaps.length > 0) {
      const hasMatchingProtein = recipe.proteinSwaps.some((p) =>
        client.proteins.includes(p)
      );
      if (!hasMatchingProtein) {
        if (debug) {
          recipeTraces.push({
            recipeId: recipe.id,
            recipeName: recipe.name,
            outcome: 'excluded',
            tagGateResult: 'passed',
            ingredientResults: ingredientResult.ingredientTraces,
            proteinFilterResult: 'blocked',
            score: 0,
            fresh: false,
          });
        }
        continue;
      }
    }

    eligible.push({ recipe, omitNotes: ingredientResult.omitNotes });

    if (debug) {
      recipeTraces.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        outcome: 'eligible',
        tagGateResult: 'passed',
        ingredientResults: ingredientResult.ingredientTraces,
        proteinFilterResult: recipe.proteinSwaps.length > 0 ? 'passed' : 'not-applicable',
        score: 0,    // filled in after scoring
        fresh: false, // filled in after freshness split
      });
    }
  }

  if (eligible.length < client.itemsPerMenu) {
    warnings.push(
      `Only ${eligible.length} eligible recipes found for ${client.itemsPerMenu} menu slots. ` +
      `Consider adding more recipes or adjusting client restrictions.`
    );
  }

  return { eligible, warnings, recipeTraces };
}

// ── Scoring (pure) ────────────────────────────────────────────────────────────

function scoreRecipes(
  eligibleRecipes: EligibleRecipe[],
  client: Client,
  randomFn: () => number,
): ScoredRecipe[] {
  const cuisineWeights = new Map<string, number>();
  for (const pref of client.cuisinePreferences) {
    cuisineWeights.set(pref.cuisineType, pref.weight);
  }

  return eligibleRecipes.map(({ recipe, omitNotes }) => {
    const cuisineScore = cuisineWeights.get(recipe.cuisineType) ?? 3;
    const randomFactor = randomFn() * 2;
    const score = cuisineScore + randomFactor;

    const availableProteins = recipe.proteinSwaps.length > 0
      ? recipe.proteinSwaps.filter((p) => client.proteins.includes(p))
      : [];

    return { recipe, score, availableProteins, omitNotes };
  });
}

// ── Candidate selection (pure) ────────────────────────────────────────────────

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

// ── Composition-based generation (pure) ──────────────────────────────────────

function buildWithComposition(
  client: Client,
  freshScored: ScoredRecipe[],
  staleScored: ScoredRecipe[],
  warnings: string[]
): BuildMenuResult {
  const usedRecipeIds = new Set<string>();
  const allItems: Array<{ recipeId: string; selectedProtein: string | null; omitNotes: string[] }> = [];
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
      allItems.push({
        recipeId: item.recipe.id,
        selectedProtein: protein,
        omitNotes: item.omitNotes,
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
      allItems.push({
        recipeId: item.recipe.id,
        selectedProtein: null,
        omitNotes: item.omitNotes,
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

  return { items: allItems, warnings };
}

// ── Legacy generation (pure) ──────────────────────────────────────────────────

function buildLegacy(
  client: Client,
  freshScored: ScoredRecipe[],
  staleScored: ScoredRecipe[],
  warnings: string[]
): BuildMenuResult {
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
  const result: Array<{ recipeId: string; selectedProtein: string | null; omitNotes: string[] }> = [];

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
      omitNotes: item.omitNotes,
    });
  }

  return { items: result, warnings };
}

// ── Pure build function (no IO) ───────────────────────────────────────────────

/**
 * Pure menu-building function. Takes all data as arguments, performs no IO.
 * Used by both the production IO wrapper (generateMenu) and by tests.
 *
 * @param client       - The client profile
 * @param allRecipes   - Full recipe catalog
 * @param allProteins  - Known protein names (for tag exclusion check)
 * @param recentIds    - Set of recipe IDs used in the last N menus (for freshness)
 * @param options      - Optional: randomFn for deterministic scoring, debug for trace
 */
export function buildMenuFromData(
  client: Client,
  allRecipes: Recipe[],
  allProteins: string[],
  recentIds: Set<string>,
  options: BuildMenuOptions = {},
): BuildMenuResult {
  const randomFn = options.randomFn ?? (() => Math.random());
  const debug = options.debug ?? false;
  const warnings: string[] = [];

  const { eligible, warnings: eligibilityWarnings, recipeTraces } =
    filterEligibleRecipes(allRecipes, client, allProteins, options);
  warnings.push(...eligibilityWarnings);

  const freshEligible = eligible.filter((r) => !recentIds.has(r.recipe.id));
  const staleEligible = eligible.filter((r) => recentIds.has(r.recipe.id));

  if (freshEligible.length === 0 && staleEligible.length > 0) {
    warnings.push(
      'All eligible recipes have been used in the last 6 menus. Some dishes will repeat.'
    );
  }

  const freshScored = scoreRecipes(freshEligible, client, randomFn);
  const staleScored = scoreRecipes(staleEligible, client, randomFn);

  let buildResult: BuildMenuResult;

  if (client.menuComposition.length > 0) {
    buildResult = buildWithComposition(client, freshScored, staleScored, warnings);
  } else {
    buildResult = buildLegacy(client, freshScored, staleScored, warnings);
  }

  // Merge warnings from build result (they were accumulated in-place)
  // Already using same warnings array reference.

  if (debug) {
    // Mark selected recipes in traces and attach score/fresh
    const selectedIds = new Set(buildResult.items.map((i) => i.recipeId));
    const freshIds = new Set(freshEligible.map((r) => r.recipe.id));

    // Build a score map from scored recipes
    const scoreMap = new Map<string, number>();
    for (const s of [...freshScored, ...staleScored]) {
      scoreMap.set(s.recipe.id, s.score);
    }

    for (const trace of recipeTraces) {
      if (selectedIds.has(trace.recipeId)) {
        trace.outcome = 'selected';
      }
      trace.score = scoreMap.get(trace.recipeId) ?? 0;
      trace.fresh = freshIds.has(trace.recipeId);
    }

    const traceObj: MenuGenerationTrace = {
      clientId: client.id,
      totalRecipesConsidered: allRecipes.length,
      eligibleCount: eligible.length,
      freshCount: freshEligible.length,
      staleCount: staleEligible.length,
      perRecipe: recipeTraces,
      warnings,
    };

    return { ...buildResult, warnings, trace: traceObj };
  }

  return { ...buildResult, warnings };
}

// ── IO wrapper (public API — unchanged) ──────────────────────────────────────

export async function generateMenu(clientId: string): Promise<GenerateResult> {
  const client = await getClientById(clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const [allRecipes, allProteins, recentRecipeIds] = await Promise.all([
    getAllRecipes(),
    getAllProteins(),
    getRecentRecipeIdsForClient(clientId, 6),
  ]);

  const buildResult = buildMenuFromData(client, allRecipes, allProteins, recentRecipeIds);

  const menu = await createDraftMenu(client.id, buildResult.items);

  // Build omitNotes keyed by menuItemId for the API response
  const omitNotes: Record<string, string[]> = {};
  for (const menuItem of menu.items) {
    if (menuItem.omitNotes && menuItem.omitNotes.length > 0) {
      omitNotes[menuItem.id] = menuItem.omitNotes;
    }
  }

  return { menu, warnings: buildResult.warnings, omitNotes };
}

// ── Swap suggestions (IO, uses pure filtering internally) ─────────────────────

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

  const [allRecipes, allProteins, recentRecipeIds] = await Promise.all([
    getAllRecipes(),
    getAllProteins(),
    getRecentRecipeIdsForClient(menuRow.clientId, 6),
  ]);

  const { eligible } = filterEligibleRecipes(allRecipes, client, allProteins, {});

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

  const freshAvailable = available.filter((r) => !recentRecipeIds.has(r.recipe.id));
  const staleAvailable = available.filter((r) => recentRecipeIds.has(r.recipe.id));

  const freshSuggestions = scoreRecipes(freshAvailable, client, () => Math.random());
  const staleSuggestions = scoreRecipes(staleAvailable, client, () => Math.random());

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
