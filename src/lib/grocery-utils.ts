import type { GroceryItem, DuplicatePair } from './types';

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

  // Regex: optional leading number (int, decimal, or fraction), optional unit token, rest is name
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
 * Attempt to sum two quantity strings.
 * Same unit + numeric quantities: sum them.
 * Differing units OR non-numeric: concatenate with " + ".
 * Never silently discards data.
 */
export function combineQuantities(
  qtyA: string | null,
  unitA: string | null,
  qtyB: string | null,
  unitB: string | null
): { quantity: string | null; unit: string | null } {
  const numA = qtyA ? parseFloat(qtyA) : null;
  const numB = qtyB ? parseFloat(qtyB) : null;

  const sameUnit =
    (unitA ?? '').toLowerCase().trim() === (unitB ?? '').toLowerCase().trim();

  if (
    numA !== null && !isNaN(numA) &&
    numB !== null && !isNaN(numB) &&
    sameUnit
  ) {
    const sum = numA + numB;
    const formatted = Number.isInteger(sum)
      ? String(sum)
      : sum.toFixed(2).replace(/\.?0+$/, '');
    return { quantity: formatted, unit: unitA };
  }

  // Cannot cleanly sum: concatenate both representations
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
