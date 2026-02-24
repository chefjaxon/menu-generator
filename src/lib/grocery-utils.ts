import type { GroceryItem, DuplicatePair } from './types';
import { INGREDIENT_ALIASES } from './ingredient-aliases';
import { canonicalizeRestriction, ingredientMatchesRestriction } from './restriction-utils';
import { classifyIngredient } from './ingredient-categories';

// ── Grocery debug trace types (exported for test use) ─────────────────────────

export type GroceryIngredientAction = 'keep' | 'swap' | 'skip-optional' | 'skip-no-swap' | 'removed-no-qty';

export interface GroceryIngredientTrace {
  recipeId: string;
  originalName: string;
  normalizedName: string;
  aliasApplied: boolean;
  prepStripped: boolean;
  quantity: string | null;
  unit: string | null;
  restrictionApplied?: string;
  action: GroceryIngredientAction;
  swapTo?: string;
  mergedWith?: string;
}

export interface GroceryBuildTrace {
  rawIngredientCount: number;
  perIngredient: GroceryIngredientTrace[];
}

// ── Pure grocery input types ──────────────────────────────────────────────────

export interface GroceryMenuItem {
  recipeId: string;
  selectedProtein: string | null;
  recipe: {
    ingredients: Array<{
      id: string;
      name: string;
      quantity: string | null;
      unit: string | null;
      role: string;
      swaps: Array<{
        substituteIngredient: string;
        substituteQty: string | null;
        substituteUnit: string | null;
        restriction: string;
        priority: number;
      }>;
    }>;
    proteinSwaps: Array<{ protein: string }>;
  };
}

export interface BuildGroceryOptions {
  /** Skip the Claude gray-zone normalization step entirely. Always true in tests. */
  skipClaudeNormalization?: boolean;
  /** Fixed ISO timestamp for createdAt fields. Inject in tests for full determinism. Defaults to Date.now(). */
  now?: string;
  /** When true, populate trace in the returned result. */
  debug?: boolean;
}

export interface BuildGroceryResult {
  toKeep: GroceryItem[];
  toRemove: GroceryItem[];
  trace?: GroceryBuildTrace;
}

/**
 * Convert a lemon juice or lime juice item measured in tbsp/tsp into a citrus count.
 * e.g. "2 tbsp lemon juice" → quantity: "1", unit: "lemon", notes: "juiced"
 *       "3 tbsp lime juice"  → quantity: "1½", unit: "limes", notes: "juiced"
 *
 * Ratio: 1 lemon/lime ≈ 2 tbsp = 6 tsp of juice.
 * Does NOT affect lemon zest, lime zest, or any other citrus item.
 */
function convertCitrusJuiceToCount(item: GroceryItem): GroceryItem {
  const nameLower = item.name.toLowerCase().trim();
  // Only match exactly "lemon juice" or "lime juice" — not zest, pepper, etc.
  if (nameLower !== 'lemon juice' && nameLower !== 'lime juice') return item;

  const citrus = nameLower === 'lemon juice' ? 'lemon' : 'lime';

  // Resolve total tsp from quantity + unit
  let totalTsp: number | null = null;
  const unitLower = (item.unit ?? '').toLowerCase().trim();

  if (unitLower === 'tbsp' || unitLower === 'tablespoon' || unitLower === 'tablespoons') {
    const qty = item.quantity ? parseQuantity(item.quantity) : null;
    if (qty !== null) totalTsp = qty * 3;
  } else if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons') {
    const qty = item.quantity ? parseQuantity(item.quantity) : null;
    if (qty !== null) totalTsp = qty;
  } else if (!unitLower && item.quantity) {
    // Multi-part volume string e.g. "1 tbsp + 2 tsp" stored in quantity with empty unit
    totalTsp = parseMultiPartVolumeTsp(item.quantity);
  }

  if (totalTsp === null || totalTsp <= 0) return item;

  // 1 citrus = 6 tsp of juice
  const count = totalTsp / 6;
  const countFormatted = formatQuantity(count);
  const pluralUnit = count === 1 ? citrus : citrus + 's';
  const juicedNote = 'juiced';
  const newNotes = item.notes
    ? `${item.notes}; ${juicedNote}`
    : juicedNote;

  return {
    ...item,
    quantity: countFormatted,
    unit: pluralUnit,
    notes: newNotes,
  };
}

/**
 * Pure grocery list builder. Takes all data as arguments, performs no IO and no DB calls.
 * Used by both the production IO wrapper (generateGroceryItemsFromMenu) and by tests.
 *
 * Steps:
 * 1. Iterate menu items → collect raw ingredients, applying protein exclusion + restriction swaps
 * 2. Static alias normalization
 * 3. Separate items with no qty+unit into "removed" set
 * 4. Consolidate exact duplicates
 * 5. Deduplicate removed items by name
 *
 * Note: Claude gray-zone normalization (step 2b) is async and lives in the IO wrapper.
 * Pass skipClaudeNormalization=true in tests (it is always skipped here — caller handles it).
 */
export function buildGroceryFromData(
  menuItems: GroceryMenuItem[],
  clientRestrictions: string[],
  options: BuildGroceryOptions = {},
): BuildGroceryResult {
  const debug = options.debug ?? false;
  const traces: GroceryIngredientTrace[] = [];
  const rawItems: GroceryItem[] = [];
  let sortIdx = 0;
  const fakeMenuId = 'test-menu';
  const now = options.now ?? new Date().toISOString();

  for (const menuItem of menuItems) {
    // Determine non-selected proteins for this menu item
    const nonSelectedProteins: string[] = [];
    if (menuItem.selectedProtein && menuItem.recipe.proteinSwaps.length > 1) {
      for (const ps of menuItem.recipe.proteinSwaps) {
        if (ps.protein.toLowerCase().trim() !== menuItem.selectedProtein.toLowerCase().trim()) {
          nonSelectedProteins.push(ps.protein.toLowerCase().trim());
        }
      }
    }

    for (const ing of menuItem.recipe.ingredients) {
      // Skip non-selected protein ingredients
      if (nonSelectedProteins.length > 0) {
        const isNonSelectedProtein = nonSelectedProteins.some(
          (p) => ingredientMatchesRestriction(ing.name, p)
        );
        if (isNonSelectedProtein) continue;
      }

      if (clientRestrictions.length > 0) {
        let restricted = false;
        let appliedRestriction: string | undefined;
        let appliedSwap: { substituteIngredient: string; substituteQty: string | null; substituteUnit: string | null } | null = null;

        for (const restriction of clientRestrictions) {
          if (!ingredientMatchesRestriction(ing.name, restriction)) continue;
          restricted = true;
          appliedRestriction = restriction;

          if (ing.role === 'core' || ing.role === 'garnish') {
            const candidate = ing.swaps
              .filter((s) => canonicalizeRestriction(s.restriction) === restriction)
              .sort((a, b) => b.priority - a.priority)[0];
            if (candidate && (!appliedSwap || candidate.priority > ((appliedSwap as { priority?: number }).priority ?? 0))) {
              appliedSwap = candidate;
            }
          }
        }

        if (restricted) {
          if (appliedSwap) {
            const item: GroceryItem = {
              id: `raw-${sortIdx}`,
              menuId: fakeMenuId,
              name: appliedSwap.substituteIngredient,
              quantity: appliedSwap.substituteQty ?? ing.quantity,
              unit: appliedSwap.substituteUnit ?? ing.unit,
              checked: false,
              source: 'recipe',
              recipeItemId: ing.id,
              notes: `Swap for ${ing.name}`,
              clientNote: null,
              sortOrder: sortIdx++,
              category: 'other',
              createdAt: now,
            };
            rawItems.push(item);
            if (debug) traces.push({
              recipeId: menuItem.recipeId,
              originalName: ing.name,
              normalizedName: appliedSwap.substituteIngredient,
              aliasApplied: false,
              prepStripped: false,
              quantity: item.quantity,
              unit: item.unit,
              restrictionApplied: appliedRestriction,
              action: 'swap',
              swapTo: appliedSwap.substituteIngredient,
            });
          } else {
            // optional/garnish with no swap → skip; core no swap → skip defensively
            const action: GroceryIngredientAction = ing.role === 'optional' || ing.role === 'garnish'
              ? 'skip-optional'
              : 'skip-no-swap';
            if (debug) traces.push({
              recipeId: menuItem.recipeId,
              originalName: ing.name,
              normalizedName: ing.name,
              aliasApplied: false,
              prepStripped: false,
              quantity: ing.quantity,
              unit: ing.unit,
              restrictionApplied: appliedRestriction,
              action,
            });
          }
          continue;
        }
      }

      const item: GroceryItem = {
        id: `raw-${sortIdx}`,
        menuId: fakeMenuId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        checked: false,
        source: 'recipe',
        recipeItemId: ing.id,
        notes: null,
        clientNote: null,
        sortOrder: sortIdx++,
        category: 'other',
        createdAt: now,
      };
      rawItems.push(item);

      if (debug) {
        const originalKey = ing.name.toLowerCase().trim();
        const directMatch = INGREDIENT_ALIASES.get(originalKey);
        const stripped = stripPreparationDescriptors(ing.name);
        const strippedKey = stripped.toLowerCase().trim();
        const aliasMatch = INGREDIENT_ALIASES.get(strippedKey);
        const normalizedName = directMatch ?? aliasMatch ?? strippedKey;

        traces.push({
          recipeId: menuItem.recipeId,
          originalName: ing.name,
          normalizedName,
          aliasApplied: normalizedName !== strippedKey,
          prepStripped: strippedKey !== originalKey,
          quantity: ing.quantity,
          unit: ing.unit,
          action: 'keep',
        });
      }
    }
  }

  // Step 1: Static alias normalization
  const aliasNormalized = normalizeIngredientNames(rawItems);

  // Step 2: Separate no-qty/no-unit items
  const toKeepRaw: GroceryItem[] = [];
  const toRemoveRaw: GroceryItem[] = [];
  for (const item of aliasNormalized) {
    if (item.quantity === null && item.unit === null) {
      toRemoveRaw.push(item);
    } else {
      toKeepRaw.push(item);
    }
  }

  // Step 3: Consolidate exact duplicates among kept items
  const toKeep = consolidateExactDuplicates(toKeepRaw).map(convertCitrusJuiceToCount);

  // Step 4: Deduplicate removed items by canonical name
  const removedByName = new Map<string, GroceryItem>();
  for (const item of toRemoveRaw) {
    const key = item.name.toLowerCase().trim();
    if (!removedByName.has(key)) removedByName.set(key, item);
  }
  const toRemove = Array.from(removedByName.values());

  // Apply categories
  const toKeepWithCat = toKeep.map((item) => ({ ...item, category: classifyIngredient(item.name) }));
  const toRemoveWithCat = toRemove.map((item) => ({ ...item, category: classifyIngredient(item.name) }));

  const result: BuildGroceryResult = { toKeep: toKeepWithCat, toRemove: toRemoveWithCat };

  if (debug) {
    result.trace = { rawIngredientCount: rawItems.length, perIngredient: traces };
  }

  return result;
}

// --- Ingredient text parsing ---

export interface ParsedIngredientLine {
  name: string;
  quantity: string | null;
  unit: string | null;
}

const UNITS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons',
  'tsp', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces',
  'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams',
  'kg', 'ml', 'l', 'liter', 'liters', 'quart', 'quarts',
  'pint', 'pints', 'gallon', 'gallons', 'bunch', 'bunches',
  'clove', 'cloves', 'head', 'heads', 'stalk', 'stalks',
  'slice', 'slices', 'can', 'cans', 'package', 'packages',
  'bag', 'bags', 'pinch', 'pinches', 'handful', 'handfuls',
  'piece', 'pieces', 'sprig', 'sprigs',
]);

/**
 * Parse a single free-text ingredient line.
 * Examples:
 *   "2 cups chicken broth"   -> { quantity: "2", unit: "cups", name: "chicken broth" }
 *   "1/2 lb ground beef"     -> { quantity: "1/2", unit: "lb", name: "ground beef" }
 *   "salt and pepper"        -> { quantity: null, unit: null, name: "salt and pepper" }
 *   "3 large eggs"           -> { quantity: "3", unit: null, name: "large eggs" }
 */
export function parseIngredientLine(line: string): ParsedIngredientLine {
  const trimmed = line.trim();
  if (!trimmed) return { name: '', quantity: null, unit: null };

  // First try: leading unicode fraction (e.g. "½ cup olive oil", "1¾ lbs beef")
  const unicodeMatch = trimmed.match(/^([½⅓⅔¼¾⅛⅜⅝⅞]|\d+\s*[½⅓⅔¼¾⅛⅜⅝⅞])\s+([a-zA-Z]+)\s+(.+)$/);
  if (unicodeMatch) {
    const [, qty, maybeUnit, rest] = unicodeMatch;
    if (UNITS.has(maybeUnit.toLowerCase())) {
      return { quantity: qty.trim(), unit: maybeUnit.toLowerCase(), name: rest.trim() };
    }
    return { quantity: qty.trim(), unit: null, name: `${maybeUnit} ${rest}`.trim() };
  }

  // Leading unicode fraction with no unit
  const unicodeNoUnit = trimmed.match(/^([½⅓⅔¼¾⅛⅜⅝⅞]|\d+\s*[½⅓⅔¼¾⅛⅜⅝⅞])\s+(.+)$/);
  if (unicodeNoUnit) {
    const [, qty, rest] = unicodeNoUnit;
    return { quantity: qty.trim(), unit: null, name: rest.trim() };
  }

  // Compound weight: "2 pounds 4 ounces snap peas" → qty: "2¼", unit: "lb", name: "snap peas"
  const compoundWeightMatch = trimmed.match(
    /^(\d+(?:[/.]\d+)?)\s+(pounds?|lbs?)\s+(\d+(?:[/.]\d+)?)\s+(ounces?|oz)\s+(.+)$/i
  );
  if (compoundWeightMatch) {
    const [, lbQty, , ozQty, , rest] = compoundWeightMatch;
    const totalOz = parseFloat(lbQty) * 16 + parseFloat(ozQty);
    const formatted = formatWeight(totalOz);
    return { quantity: formatted.quantity, unit: formatted.unit || null, name: rest.trim() };
  }

  // Parenthetical size: "1 (28 oz) can crushed tomatoes" → qty:"1", unit:"can", name:"28 oz can crushed tomatoes"
  // Preserves the size info in the name rather than losing it to parenthetical stripping.
  const parenSizeMatch = trimmed.match(
    /^(\d+(?:[/.]\d+)?)\s+\((\d+(?:[/.]\d+)?\s*(?:oz|ounce|ounces|g|gram|grams|lb|lbs|pound|pounds|ml|l))\)\s+([a-zA-Z]+)\s+(.+)$/i
  );
  if (parenSizeMatch) {
    const [, qty, size, containerUnit, ingredient] = parenSizeMatch;
    const unitLower = containerUnit.toLowerCase();
    if (UNITS.has(unitLower)) {
      return { quantity: qty, unit: unitLower, name: `${size} ${unitLower} ${ingredient}`.trim() };
    }
  }

  // Standard: leading number (int, decimal, or fraction), optional unit token, rest is name
  const match = trimmed.match(
    /^(\d+(?:[/.]\d+)?(?:\s+\d+\/\d+)?)\s+([a-zA-Z]+)\s+(.+)$/
  );

  if (match) {
    const [, qty, maybeUnit, rest] = match;
    if (UNITS.has(maybeUnit.toLowerCase())) {
      return { quantity: qty, unit: maybeUnit.toLowerCase(), name: rest.trim() };
    }
    // Unit word not recognised: treat second token as part of the name
    return { quantity: qty, unit: null, name: `${maybeUnit} ${rest}`.trim() };
  }

  // Try just a number at the start with no unit
  const numOnly = trimmed.match(/^(\d+(?:[/.]\d+)?)\s+(.+)$/);
  if (numOnly) {
    const [, qty, rest] = numOnly;
    return { quantity: qty, unit: null, name: rest.trim() };
  }

  return { name: trimmed, quantity: null, unit: null };
}

/**
 * Parse a multi-line paste into individual ingredient rows.
 * Empty lines are skipped.
 */
export function parsePastedText(text: string): ParsedIngredientLine[] {
  return text
    .split('\n')
    .map((l) => parseIngredientLine(l.trim()))
    .filter((l) => l.name.length > 0);
}

// --- Quantity math ---

/**
 * Parse a quantity string into a decimal number.
 * Handles integers ("3"), decimals ("1.5"), simple fractions ("1/2", "3/4"),
 * mixed numbers ("1 1/2", "2 3/4"), and unicode fraction strings produced by
 * formatQuantity ("½", "1½", "2¾", etc.).
 * Returns null if unparseable.
 */
function parseQuantity(qty: string): number | null {
  if (!qty) return null;
  const trimmed = qty.trim();

  // Unicode fractions (produced by formatQuantity — handles intermediate combine results)
  // e.g. "½", "1½", "2¾" — must be checked before parseFloat since parseFloat("1½") = 1 (truncates)
  const UNICODE: Record<string, number> = {
    '⅛': 1/8, '¼': 1/4, '⅓': 1/3, '⅜': 3/8,
    '½': 1/2, '⅝': 5/8, '⅔': 2/3, '¾': 3/4, '⅞': 7/8,
  };
  const hasUnicode = /[⅛¼⅓⅜½⅝⅔¾⅞]/.test(trimmed);
  if (hasUnicode) {
    let value = 0;
    let rest = trimmed;
    // Strip optional leading whole number
    const wholeMatch = rest.match(/^(\d+)/);
    if (wholeMatch) {
      value += parseInt(wholeMatch[1], 10);
      rest = rest.slice(wholeMatch[0].length);
    }
    if (rest && UNICODE[rest] !== undefined) {
      value += UNICODE[rest];
      return value;
    }
    return null; // unrecognised unicode combo
  }

  // Mixed number: "1 1/2", "2 3/4"
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const num = parseInt(mixed[2], 10);
    const den = parseInt(mixed[3], 10);
    if (den === 0) return null;
    return whole + num / den;
  }

  // Simple fraction: "1/2", "3/4"
  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const num = parseInt(fraction[1], 10);
    const den = parseInt(fraction[2], 10);
    if (den === 0) return null;
    return num / den;
  }

  // Integer or decimal
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * Format a decimal number as a clean fraction/mixed-number string.
 * Uses common cooking fractions (½ ¼ ¾ ⅓ ⅔ ⅛ ¾).
 * e.g. 0.5 → "½", 1.75 → "1¾", 2.333 → "2⅓", 3 → "3"
 */
function formatQuantity(value: number): string {
  if (value <= 0) return '0';

  const whole = Math.floor(value);
  const frac = value - whole;

  // Tolerance for floating point
  const TOLERANCE = 0.02;

  const FRACTIONS: Array<[number, string]> = [
    [0,     ''],
    [1/8,   '⅛'],
    [1/4,   '¼'],
    [1/3,   '⅓'],
    [3/8,   '⅜'],
    [1/2,   '½'],
    [5/8,   '⅝'],
    [2/3,   '⅔'],
    [3/4,   '¾'],
    [7/8,   '⅞'],
    [1,     '1'], // rounds up to next whole
  ];

  // Find nearest fraction
  let bestFrac = '';
  let bestDiff = Infinity;
  let roundUp = false;

  for (const [fracVal, fracStr] of FRACTIONS) {
    const diff = Math.abs(frac - fracVal);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestFrac = fracStr;
      roundUp = fracStr === '1';
    }
  }

  const displayWhole = roundUp ? whole + 1 : whole;
  const displayFrac = roundUp ? '' : bestFrac;

  if (displayWhole === 0) return displayFrac || '0';
  if (!displayFrac) return String(displayWhole);
  return `${displayWhole}${displayFrac}`;
}

// ── Unit conversion tables ────────────────────────────────────────────────────
// All volumes converted to teaspoons (tsp) as base unit.
// All weights converted to ounces (oz) as base unit.

type UnitGroup = 'volume' | 'weight' | 'count';

interface UnitInfo {
  group: UnitGroup;
  toBase: number;   // multiply qty by this to get base units
  canonical: string; // canonical unit name for this unit
}

const UNIT_TABLE: Record<string, UnitInfo> = {
  // ── Volume (base = tsp) ──────────────────────────────────────────────────
  'tsp':         { group: 'volume', toBase: 1,    canonical: 'tsp' },
  'teaspoon':    { group: 'volume', toBase: 1,    canonical: 'tsp' },
  'teaspoons':   { group: 'volume', toBase: 1,    canonical: 'tsp' },
  'tbsp':        { group: 'volume', toBase: 3,    canonical: 'tbsp' },
  'tablespoon':  { group: 'volume', toBase: 3,    canonical: 'tbsp' },
  'tablespoons': { group: 'volume', toBase: 3,    canonical: 'tbsp' },
  'fl oz':       { group: 'volume', toBase: 6,    canonical: 'fl oz' },
  'cup':         { group: 'volume', toBase: 48,   canonical: 'cup' },
  'cups':        { group: 'volume', toBase: 48,   canonical: 'cup' },
  'pint':        { group: 'volume', toBase: 96,   canonical: 'pint' },
  'pints':       { group: 'volume', toBase: 96,   canonical: 'pint' },
  'quart':       { group: 'volume', toBase: 192,  canonical: 'quart' },
  'quarts':      { group: 'volume', toBase: 192,  canonical: 'quart' },
  'gallon':      { group: 'volume', toBase: 768,  canonical: 'gallon' },
  'gallons':     { group: 'volume', toBase: 768,  canonical: 'gallon' },
  'ml':          { group: 'volume', toBase: 0.2029, canonical: 'ml' },
  'l':           { group: 'volume', toBase: 202.9,  canonical: 'l' },
  'liter':       { group: 'volume', toBase: 202.9,  canonical: 'l' },
  'liters':      { group: 'volume', toBase: 202.9,  canonical: 'l' },

  // ── Weight (base = oz) ───────────────────────────────────────────────────
  'oz':          { group: 'weight', toBase: 1,      canonical: 'oz' },
  'ounce':       { group: 'weight', toBase: 1,      canonical: 'oz' },
  'ounces':      { group: 'weight', toBase: 1,      canonical: 'oz' },
  'lb':          { group: 'weight', toBase: 16,     canonical: 'lb' },
  'lbs':         { group: 'weight', toBase: 16,     canonical: 'lb' },
  'pound':       { group: 'weight', toBase: 16,     canonical: 'lb' },
  'pounds':      { group: 'weight', toBase: 16,     canonical: 'lb' },
  'g':           { group: 'weight', toBase: 0.03527, canonical: 'g' },
  'gram':        { group: 'weight', toBase: 0.03527, canonical: 'g' },
  'grams':       { group: 'weight', toBase: 0.03527, canonical: 'g' },
  'kg':          { group: 'weight', toBase: 35.27,   canonical: 'kg' },

  // ── Count (base = each) ──────────────────────────────────────────────────
  'clove':       { group: 'count', toBase: 1, canonical: 'clove' },
  'cloves':      { group: 'count', toBase: 1, canonical: 'clove' },
  'head':        { group: 'count', toBase: 1, canonical: 'head' },
  'heads':       { group: 'count', toBase: 1, canonical: 'head' },
  'stalk':       { group: 'count', toBase: 1, canonical: 'stalk' },
  'stalks':      { group: 'count', toBase: 1, canonical: 'stalk' },
  'slice':       { group: 'count', toBase: 1, canonical: 'slice' },
  'slices':      { group: 'count', toBase: 1, canonical: 'slice' },
  'can':         { group: 'count', toBase: 1, canonical: 'can' },
  'cans':        { group: 'count', toBase: 1, canonical: 'can' },
  'package':     { group: 'count', toBase: 1, canonical: 'package' },
  'packages':    { group: 'count', toBase: 1, canonical: 'package' },
  'bag':         { group: 'count', toBase: 1, canonical: 'bag' },
  'bags':        { group: 'count', toBase: 1, canonical: 'bag' },
  'bunch':       { group: 'count', toBase: 1, canonical: 'bunch' },
  'bunches':     { group: 'count', toBase: 1, canonical: 'bunch' },
  'pinch':       { group: 'count', toBase: 1, canonical: 'pinch' },
  'pinches':     { group: 'count', toBase: 1, canonical: 'pinch' },
  'handful':     { group: 'count', toBase: 1, canonical: 'handful' },
  'handfuls':    { group: 'count', toBase: 1, canonical: 'handful' },
  'piece':       { group: 'count', toBase: 1, canonical: 'piece' },
  'pieces':      { group: 'count', toBase: 1, canonical: 'piece' },
  'sprig':       { group: 'count', toBase: 1, canonical: 'sprig' },
  'sprigs':      { group: 'count', toBase: 1, canonical: 'sprig' },
};

/**
 * Volume: convert a total-tsp value back to the most readable representation.
 *
 * Unit selection rules (cooking-friendly):
 *  - Use tsp  when total < 3 tsp
 *  - Use tbsp when total < 48 tsp (< 1 cup) — expressed as whole+fraction tbsp or tbsp+tsp
 *  - Use cup  when total < 192 tsp (< 1 quart)
 *  - Use quart when total < 768 tsp (< 1 gallon)
 *  - Use gallon otherwise
 *
 * Within each tier: try clean single fraction first, then whole + remainder.
 *
 * Examples:
 *   0.75 tsp → ¾ tsp
 *   3 tsp    → 1 tbsp
 *   7 tsp    → 2 tbsp + 1 tsp
 *   12 tsp   → ¼ cup
 *   36 tsp   → ¾ cup
 *   54 tsp   → 1 cup + 2 tbsp
 *   168 tsp  → 3½ cups
 */
function formatVolume(totalTsp: number): { quantity: string; unit: string } {
  // Pick primary unit tier based on total size
  let primaryUnit: string;
  let primaryTsp: number;
  let secondaryUnit: string;
  let secondaryTsp: number;

  if (totalTsp < 3 - 0.01) {
    // Small: use tsp only
    return { quantity: formatQuantity(totalTsp), unit: 'tsp' };
  } else if (totalTsp < 12 - 0.01) {
    // Tablespoon tier (< ¼ cup): use tbsp + tsp remainder
    // But only express as fractional tbsp if it's a clean half (1½ tbsp)
    // otherwise use tbsp + tsp
    const tbspQty = totalTsp / 3;
    const wholeTbsp = Math.floor(tbspQty + 0.01);
    const remTsp = Math.round((totalTsp - wholeTbsp * 3) * 1000) / 1000;
    if (remTsp < 0.1) {
      return { quantity: formatQuantity(wholeTbsp), unit: 'tbsp' };
    }
    // Try clean fraction of tbsp (only ½ tbsp = 1.5 tsp is cooking-sensible)
    const fracTbsp = tbspQty - wholeTbsp;
    if (Math.abs(fracTbsp - 0.5) < 0.04) {
      return { quantity: formatQuantity(tbspQty), unit: 'tbsp' };
    }
    // Use tbsp + tsp
    const remFormatted = formatQuantity(remTsp);
    if (wholeTbsp === 0) {
      return { quantity: remFormatted, unit: 'tsp' };
    }
    return { quantity: `${formatQuantity(wholeTbsp)} tbsp + ${remFormatted} tsp`, unit: '' };
  } else if (totalTsp < 192 - 0.01) {
    // Cup tier — 4+ tbsp (12+ tsp) always expressed in cups
    primaryUnit = 'cup'; primaryTsp = 48;
    secondaryUnit = 'tbsp'; secondaryTsp = 3;
  } else if (totalTsp < 768 - 0.01) {
    // Quart tier
    primaryUnit = 'quart'; primaryTsp = 192;
    secondaryUnit = 'cup'; secondaryTsp = 48;
  } else {
    // Gallon tier
    primaryUnit = 'gallon'; primaryTsp = 768;
    secondaryUnit = 'quart'; secondaryTsp = 192;
  }

  const qtyInUnit = totalTsp / primaryTsp;
  const wholeCount = Math.floor(qtyInUnit + 0.005);
  const remainderTsp = Math.round((totalTsp - wholeCount * primaryTsp) * 1000) / 1000;

  // If remainder is negligible, express as whole primary units
  if (remainderTsp < 0.1) {
    return { quantity: formatQuantity(wholeCount), unit: primaryUnit };
  }

  // If whole part is 0: try clean single fraction of primary unit
  if (wholeCount === 0) {
    const formatted = formatQuantity(qtyInUnit);
    const reparsed = parseQuantityFromFormatted(formatted);
    if (reparsed !== null && reparsed > 0 && Math.abs(reparsed - qtyInUnit) < 0.04) {
      return { quantity: formatted, unit: primaryUnit };
    }
  }

  // If whole part > 0: prefer fractional primary-unit form when the fraction
  // is a meaningful cooking fraction (≥ ¼ of the primary unit).
  // e.g. 1¼ cups, 1½ cups, 1¾ cups are clean; but "1⅛ cups" is NOT preferred
  // over "1 cup + 2 tbsp" since ⅛ cup is a small remainder.
  if (wholeCount > 0) {
    const fracPart = qtyInUnit - wholeCount;
    // Only use fractional form if fraction >= ¼ of primary unit (i.e. ≥ 12 tsp for cups)
    const minFrac = 1 / 4;
    if (fracPart >= minFrac - 0.01) {
      const formatted = formatQuantity(qtyInUnit);
      const reparsed = parseQuantityFromFormatted(formatted);
      if (reparsed !== null && reparsed > 0 && Math.abs(reparsed - qtyInUnit) < 0.015) {
        return { quantity: formatted, unit: primaryUnit };
      }
    }
  }

  // Whole primary + remainder in secondary
  const remainderQty = remainderTsp / secondaryTsp;
  const remainderFormatted = formatQuantity(remainderQty);

  if (wholeCount === 0) {
    return { quantity: remainderFormatted, unit: secondaryUnit };
  }

  return {
    quantity: `${formatQuantity(wholeCount)} ${primaryUnit} + ${remainderFormatted} ${secondaryUnit}`,
    unit: '',
  };
}

/** Parse back a formatQuantity result (handles unicode fractions) */
function parseQuantityFromFormatted(s: string): number | null {
  const UNICODE: Record<string, number> = {
    '⅛': 1/8, '¼': 1/4, '⅓': 1/3, '⅜': 3/8,
    '½': 1/2, '⅝': 5/8, '⅔': 2/3, '¾': 3/4, '⅞': 7/8,
  };
  let value = 0;
  let str = s.trim();
  // Whole number prefix
  const wholeMatch = str.match(/^(\d+)/);
  if (wholeMatch) {
    value += parseInt(wholeMatch[1], 10);
    str = str.slice(wholeMatch[0].length);
  }
  // Unicode fraction suffix
  if (str && UNICODE[str] !== undefined) {
    value += UNICODE[str];
  } else if (str) {
    return null; // unknown suffix
  }
  return value;
}

/**
 * Weight: convert a total-oz value back to the cleanest representation.
 */
function formatWeight(totalOz: number): { quantity: string; unit: string } {
  if (totalOz >= 16) {
    const lbs = totalOz / 16;
    const wholeLbs = Math.floor(lbs);
    const remOz = Math.round((lbs - wholeLbs) * 16);
    if (remOz === 0) {
      return { quantity: formatQuantity(wholeLbs), unit: 'lb' };
    }
    // Try to express as a fractional lb (e.g. 2¼ lb) when the fraction is clean
    const fracFormatted = formatQuantity(lbs);
    const fracReparsed = parseQuantityFromFormatted(fracFormatted);
    if (fracReparsed !== null && Math.abs(fracReparsed - lbs) < 0.02) {
      return { quantity: fracFormatted, unit: 'lb' };
    }
    return { quantity: `${formatQuantity(wholeLbs)} lb + ${formatQuantity(remOz)} oz`, unit: '' };
  }
  return { quantity: formatQuantity(totalOz), unit: 'oz' };
}

/**
 * Parse a multi-part volume string (result of a prior formatVolume call) back to tsp.
 * Handles strings like "1 cup + 2 tbsp", "3 tbsp + 1 tsp", "2¼ cups", "1½ tbsp".
 * Returns null if the string doesn't look like a volume expression.
 */
function parseMultiPartVolumeTsp(s: string): number | null {
  let totalTsp = 0;
  let matched = false;

  // Split on " + " to handle multi-part strings
  const parts = s.split(/\s*\+\s*/);
  for (const part of parts) {
    const trimmed = part.trim();
    // Match: optional unicode fraction + space + unit (e.g. "1½ cups", "2 tbsp", "¾ tsp")
    const m = trimmed.match(/^([0-9⅛¼⅓⅜½⅝⅔¾⅞]+(?:\s+\d+\/\d+)?)\s+(\w+)$/);
    if (!m) return null;
    const qty = parseQuantityFromFormatted(m[1]) ?? parseQuantity(m[1]);
    if (qty === null) return null;
    const info = UNIT_TABLE[m[2].toLowerCase()];
    if (!info || info.group !== 'volume') return null;
    totalTsp += qty * info.toBase;
    matched = true;
  }
  return matched ? totalTsp : null;
}

/**
 * Attempt to sum two quantity+unit pairs with full unit conversion.
 *
 * Supports:
 *  - Same unit: direct sum (e.g. 2 cups + 1 cup = 3 cups)
 *  - Compatible volume units: converts to tsp base, formats result cleanly
 *    (e.g. 2 tbsp + 1 tsp = 7 tsp → "2 tbsp + 1 tsp")
 *  - Compatible weight units: converts to oz base
 *    (e.g. 1 lb + 8 oz = 24 oz → "1 lb + 8 oz")
 *  - Count units (cloves, cans, etc.): sums when canonical unit matches
 *  - Unit-less quantities: sums numerically when both are unit-less
 *  - Incompatible units or unparseable quantities: concatenates with " + "
 *
 * Never silently discards data.
 */
export function combineQuantities(
  qtyA: string | null,
  unitA: string | null,
  qtyB: string | null,
  unitB: string | null
): { quantity: string | null; unit: string | null } {
  const normalA = (unitA ?? '').toLowerCase().trim();
  const normalB = (unitB ?? '').toLowerCase().trim();

  const numA = qtyA ? parseQuantity(qtyA) : null;
  const numB = qtyB ? parseQuantity(qtyB) : null;

  const infoA = normalA ? UNIT_TABLE[normalA] : null;
  const infoB = normalB ? UNIT_TABLE[normalB] : null;

  // ── Both have no unit: sum numerically if possible ────────────────────────
  if (!normalA && !normalB) {
    if (numA !== null && numB !== null) {
      return { quantity: formatQuantity(numA + numB), unit: null };
    }
    // One or both may be a multi-part volume string like "1 tbsp + 2¾ tsp"
    // Try to parse them as tsp and add
    const tspA = qtyA ? parseMultiPartVolumeTsp(qtyA) : null;
    const tspB = qtyB ? parseMultiPartVolumeTsp(qtyB) : null;
    if (tspA !== null && tspB !== null) {
      const result = formatVolume(tspA + tspB);
      return { quantity: result.quantity, unit: result.unit || null };
    }
    // Fall through to concatenation
  }

  // ── One side is a multi-part volume string (null unit), other has volume unit ─
  // e.g. "1 cup + 2 tbsp" (null) + "1/4 cup" (cup) → sum all as tsp
  if (numB !== null && infoB && infoB.group === 'volume' && !normalA && qtyA) {
    const tspA = parseMultiPartVolumeTsp(qtyA);
    if (tspA !== null) {
      const result = formatVolume(tspA + numB * infoB.toBase);
      return { quantity: result.quantity, unit: result.unit || null };
    }
  }
  if (numA !== null && infoA && infoA.group === 'volume' && !normalB && qtyB) {
    const tspB = parseMultiPartVolumeTsp(qtyB);
    if (tspB !== null) {
      const result = formatVolume(numA * infoA.toBase + tspB);
      return { quantity: result.quantity, unit: result.unit || null };
    }
  }

  // ── One side has a count unit, the other has no unit: treat as same count ─
  // e.g. "8 cloves" + "2" (bare) → "10 cloves"
  if (numA !== null && numB !== null) {
    if (infoA && infoA.group === 'count' && !normalB) {
      const sum = numA * infoA.toBase + numB;
      const pluralUnit = sum === 1 ? infoA.canonical : infoA.canonical + 's';
      return { quantity: formatQuantity(sum), unit: pluralUnit };
    }
    if (infoB && infoB.group === 'count' && !normalA) {
      const sum = numA + numB * infoB.toBase;
      const pluralUnit = sum === 1 ? infoB.canonical : infoB.canonical + 's';
      return { quantity: formatQuantity(sum), unit: pluralUnit };
    }
  }

  // ── Both units are in the same conversion group ───────────────────────────
  if (infoA && infoB && infoA.group === infoB.group && numA !== null && numB !== null) {
    const baseA = numA * infoA.toBase;
    const baseB = numB * infoB.toBase;
    const total = baseA + baseB;

    if (infoA.group === 'volume') {
      const result = formatVolume(total);
      return { quantity: result.quantity, unit: result.unit || null };
    }

    if (infoA.group === 'weight') {
      const result = formatWeight(total);
      return { quantity: result.quantity, unit: result.unit || null };
    }

    if (infoA.group === 'count') {
      // Only sum if same canonical unit (cloves + cloves, not cloves + cans)
      if (infoA.canonical === infoB.canonical) {
        const sum = total;
        const pluralUnit = sum === 1 ? infoA.canonical : infoA.canonical + 's';
        return { quantity: formatQuantity(sum), unit: pluralUnit };
      }
    }
  }

  // ── Same unit, numeric quantities ─────────────────────────────────────────
  if (normalA === normalB && numA !== null && numB !== null) {
    return { quantity: formatQuantity(numA + numB), unit: unitA };
  }

  // ── Cannot cleanly convert: concatenate ───────────────────────────────────
  const partA = [qtyA, unitA].filter(Boolean).join(' ');
  const partB = [qtyB, unitB].filter(Boolean).join(' ');

  if (!partA && !partB) return { quantity: null, unit: null };
  if (!partA) return { quantity: partB, unit: null };
  if (!partB) return { quantity: partA, unit: null };
  return { quantity: `${partA} + ${partB}`, unit: null };
}

// --- Fuzzy similarity ---

function normalizeForSimilarity(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/s$/, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Similarity score between 0.0 (completely different) and 1.0 (identical).
 * Uses normalized Levenshtein distance.
 */
export function nameSimilarity(nameA: string, nameB: string): number {
  const a = normalizeForSimilarity(nameA);
  const b = normalizeForSimilarity(nameB);
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(a, b) / maxLen;
}

const SIMILARITY_THRESHOLD = 0.8;

/**
 * Find all pairs of GroceryItems whose names are similar but not identical
 * after normalization. Returns pairs sorted by similarity descending.
 * CRITICAL: only flags, never auto-merges.
 */
export function findDuplicatePairs(items: GroceryItem[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const normA = normalizeForSimilarity(items[i].name);
      const normB = normalizeForSimilarity(items[j].name);
      if (normA === normB) continue; // exact after normalization — skip, handled by consolidation
      const sim = nameSimilarity(items[i].name, items[j].name);
      if (sim >= SIMILARITY_THRESHOLD) {
        pairs.push({ itemA: items[i], itemB: items[j], similarity: sim });
      }
    }
  }
  return pairs.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Consolidate items with EXACTLY the same name (case-insensitive).
 * This is the ONLY automatic merging in the system.
 * Items with different names are never touched here.
 */
export function consolidateExactDuplicates(items: GroceryItem[]): GroceryItem[] {
  const seen = new Map<string, GroceryItem>();
  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      const combined = combineQuantities(
        existing.quantity, existing.unit,
        item.quantity, item.unit
      );
      seen.set(key, {
        ...existing,
        quantity: combined.quantity,
        unit: combined.unit,
        notes: [existing.notes, item.notes].filter(Boolean).join('; ') || null,
      });
    } else {
      seen.set(key, { ...item });
    }
  }
  return Array.from(seen.values());
}

// --- Ingredient name normalization ---

/**
 * Regex patterns for preparation descriptors that should be stripped from
 * ingredient names before alias lookup.
 *
 * These patterns are intentionally conservative — they only match standalone
 * words at word boundaries to avoid mangling ingredient identity.
 *
 * Identity-critical words like "ground" in "ground beef", "cream" in "cream cheese",
 * or "powder" in "garlic powder" are protected via identity-protection entries in
 * ingredient-aliases.ts that map the full phrase to itself before stripping can change it.
 */

// Adverb-adjective combos and standalone prep verbs (cut/cooking methods)
const PREP_VERB_PATTERN =
  /\b(?:(?:thinly|finely|coarsely|roughly|freshly)\s+)?(?:sliced|chopped|minced|diced|grated|shredded|crumbled|crushed|julienned|peeled|trimmed|halved|quartered|torn|saut[eé]ed|roasted|toasted|blanched|steamed|boiled|fried|baked|grilled|smoked)\b/gi;

// State adjectives that don't change grocery identity
// Note: 'fresh' and 'dried' are intentionally excluded — they distinguish
// meaningfully different ingredients (e.g. fresh vs dried herbs/produce).
const PREP_ADJECTIVE_PATTERN =
  /\b(?:frozen|canned|raw|softened|melted|room[\s-]temperature|cold|warm|hot|cooled|thawed)\b/gi;

/**
 * Strip preparation descriptors from an ingredient name so that variants like
 * "garlic clove, thinly sliced" and "fresh basil" normalize to "garlic clove"
 * and "basil" respectively before the alias table lookup.
 *
 * Three-pass approach:
 *   0. Strip parenthetical content: "salt (to taste)" → "salt"
 *   1. Strip comma-suffix: "garlic clove, thinly sliced" → "garlic clove"
 *   2. Strip standalone prep words: "thinly sliced garlic" → "garlic"
 *
 * Returns the stripped string if it remains meaningful (≥ 2 chars), otherwise
 * returns the comma-stripped form as a safe fallback.
 *
 * Pure function with no side effects.
 */
export function stripPreparationDescriptors(name: string): string {
  // Pass 0 — strip parenthetical content: "salt (to taste)" → "salt",
  // "garlic (about 4)" → "garlic", "olive oil (extra virgin)" → "olive oil"
  const withoutParens = name.replace(/\s*\([^)]*\)/g, '').trim();

  // Pass 1 — drop everything after the first comma (the most common Recipe Keeper pattern)
  const beforeComma = withoutParens.split(',')[0].trim();

  // Pass 2 — strip standalone prep verbs and adjectives
  const stripped = beforeComma
    .replace(PREP_VERB_PATTERN, '')
    .replace(PREP_ADJECTIVE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Guard: if stripping removed too much (result < 2 chars), use the comma-stripped form
  return stripped.length >= 2 ? stripped : beforeComma;
}

/**
 * Normalize a single ingredient name using the static alias table.
 *
 * Lookup order (priority):
 *  1. Try the original name (lowercased) directly — catches identity-protection
 *     entries like "ground beef" → "ground beef" before stripping can alter them.
 *  2. Strip preparation descriptors, then try the alias table again.
 *  3. Return the stripped name as-is (lowercased) if no alias match.
 *
 * Pure function with no side effects.
 */
export function normalizeIngredientName(name: string): string {
  // Priority 0: size-prefixed names like "28 oz can crushed tomatoes" — normalize only the
  // ingredient suffix to preserve the size info while still canonicalizing the ingredient.
  const sizePrefixMatch = name.match(
    /^(\d+(?:[/.]\d+)?\s*(?:oz|ounce|ounces|g|gram|grams|lb|lbs|pound|pounds|ml|l)\s+\S+\s+)(.+)$/i
  );
  if (sizePrefixMatch) {
    const [, prefix, rest] = sizePrefixMatch;
    return `${prefix.trimEnd()} ${normalizeIngredientName(rest)}`.trim();
  }

  // Priority 1: exact alias match on original name (identity-protection entries)
  const originalKey = name.toLowerCase().trim();
  const directMatch = INGREDIENT_ALIASES.get(originalKey);
  if (directMatch !== undefined) return directMatch;

  // Priority 2: strip prep descriptors, then alias lookup
  const stripped = stripPreparationDescriptors(name);
  const strippedKey = stripped.toLowerCase().trim();
  return INGREDIENT_ALIASES.get(strippedKey) ?? strippedKey;
}

/**
 * Apply alias normalization to a batch of GroceryItems.
 * Returns a new array with `.name` replaced by the canonical form where a match exists.
 * All other fields are preserved unchanged.
 */
export function normalizeIngredientNames(items: GroceryItem[]): GroceryItem[] {
  return items.map((item) => ({
    ...item,
    name: normalizeIngredientName(item.name),
  }));
}

// In-process cache for Claude gray-zone decisions. Ephemeral — survives within one
// server process but resets on restart. DB cache (IngredientNormCache) is the
// durable layer that survives deployments.
const grayZoneCache = new Map<string, boolean>();

/** Returns [keyA, keyB] sorted alphabetically so pair order is canonical. */
function grayZoneCacheKey(nameA: string, nameB: string): [string, string] {
  const sorted = [nameA.toLowerCase().trim(), nameB.toLowerCase().trim()].sort() as [string, string];
  return sorted;
}

/**
 * Ask Claude Haiku whether two ingredient names should be treated as the same item.
 *
 * Lookup order:
 *   1. In-process Map cache (fastest — same process, same deploy)
 *   2. DB cache (IngredientNormCache — survives across deployments)
 *   3. Claude API call (5-second timeout, strict response schema validation)
 *   4. Fallback: false (keep separate) — never blocks generation
 *
 * Instrumentation: logs [claude-norm] line with source and outcome for each call.
 * MUST only be called server-side; requires ANTHROPIC_API_KEY env var.
 */
async function askClaudeToMerge(nameA: string, nameB: string): Promise<boolean> {
  const [keyA, keyB] = grayZoneCacheKey(nameA, nameB);
  const memKey = `${keyA}|||${keyB}`;
  const pair = `"${nameA}" + "${nameB}"`;

  // 1. In-process cache
  if (grayZoneCache.has(memKey)) {
    const result = grayZoneCache.get(memKey)!;
    console.log(`[claude-norm] used=memory pair=${pair} result=${result}`);
    return result;
  }

  // 2. DB cache
  try {
    const { prisma } = await import('./prisma');
    const cached = await prisma.ingredientNormCache.findUnique({
      where: { keyA_keyB: { keyA, keyB } },
    });
    if (cached !== null) {
      grayZoneCache.set(memKey, cached.shouldMerge);
      console.log(`[claude-norm] used=db-cache pair=${pair} result=${cached.shouldMerge}`);
      return cached.shouldMerge;
    }
  } catch {
    // DB lookup failure is non-fatal — fall through to Claude call
    console.log(`[claude-norm] db-cache-error pair=${pair} — falling through to Claude`);
  }

  // 3. Claude API call
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(`[claude-norm] used=fallback reason=no-key pair=${pair} result=false`);
    grayZoneCache.set(memKey, false);
    return false;
  }

  let shouldMerge = false;
  let logReason = 'ok';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: `You are helping consolidate a grocery list. Should these two ingredient names be treated as the same item and merged?\n\nItem A: "${nameA}"\nItem B: "${nameB}"\n\nReply with only "yes" or "no".`,
          },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logReason = `http-${response.status}`;
    } else {
      const data: unknown = await response.json();
      // Strict schema validation — must have content[0].text as a string
      const text =
        data !== null &&
        typeof data === 'object' &&
        'content' in data &&
        Array.isArray((data as Record<string, unknown>).content) &&
        (data as Record<string, unknown[]>).content.length > 0 &&
        typeof ((data as Record<string, unknown[]>).content[0] as Record<string, unknown>).text === 'string'
          ? (((data as Record<string, unknown[]>).content[0] as Record<string, unknown>).text as string)
          : null;

      if (text === null) {
        logReason = 'invalid-schema';
      } else {
        shouldMerge = text.trim().toLowerCase().startsWith('yes');
        logReason = 'ok';
      }
    }
  } catch (err) {
    logReason = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network-error';
  }

  console.log(`[claude-norm] used=claude reason=${logReason} pair=${pair} result=${shouldMerge}`);

  // Write back to both caches (even on fallback — avoids re-querying Claude for the same pair)
  grayZoneCache.set(memKey, shouldMerge);
  try {
    const { prisma } = await import('./prisma');
    await prisma.ingredientNormCache.upsert({
      where: { keyA_keyB: { keyA, keyB } },
      create: { keyA, keyB, shouldMerge },
      update: { shouldMerge },
    });
  } catch {
    // DB write failure is non-fatal — in-process cache still works this request
    console.log(`[claude-norm] db-cache-write-error pair=${pair} — result not persisted`);
  }

  return shouldMerge;
}

/**
 * For items that are still distinct after alias normalization but have
 * 0.7 <= similarity < 0.8 (gray zone), ask Claude whether they should merge.
 *
 * Returns a new items array with names rewritten where Claude agreed to merge.
 * On any failure (no API key, network error, timeout) returns the original array unchanged.
 *
 * IMPORTANT: Server-side only. Never call from client components.
 */
export async function applyClaudeGrayZoneNormalization(
  items: GroceryItem[]
): Promise<GroceryItem[]> {
  const names = items.map((i) => i.name);

  // Find gray-zone pairs
  const renameMap = new Map<string, string>(); // lowerCase(nameB) -> nameA canonical

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const sim = nameSimilarity(names[i], names[j]);
      if (sim < 0.7 || sim >= 0.8) continue;

      // askClaudeToMerge handles all caching (in-process + DB) internally
      const shouldMerge = await askClaudeToMerge(names[i], names[j]);

      if (shouldMerge) {
        renameMap.set(names[j].toLowerCase().trim(), names[i]);
      }
    }
  }

  if (renameMap.size === 0) return items;

  return items.map((item) => {
    const canonical = renameMap.get(item.name.toLowerCase().trim());
    return canonical ? { ...item, name: canonical } : item;
  });
}
