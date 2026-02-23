/**
 * Client-safe grocery utilities — pure functions with no server dependencies.
 *
 * This module contains a subset of grocery-utils.ts that is safe to import in
 * Client Components. grocery-utils.ts cannot be imported client-side because
 * it transitively pulls in prisma (via askClaudeToMerge) which Next.js's bundler
 * resolves statically even though the import() is dynamic.
 */

import { INGREDIENT_ALIASES } from './ingredient-aliases';
import { classifyIngredient } from './ingredient-categories';
import type { GroceryItem, DuplicatePair } from './types';

export type { DuplicatePair };

// ── Parsed ingredient line ────────────────────────────────────────────────────

export interface ParsedIngredientLine {
  name: string;
  quantity: string | null;
  unit: string | null;
}

// ── Unit set for parsing ──────────────────────────────────────────────────────

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

// ── Text parsing ──────────────────────────────────────────────────────────────

function parseIngredientLine(line: string): ParsedIngredientLine {
  const trimmed = line.trim();
  if (!trimmed) return { name: '', quantity: null, unit: null };

  const unicodeMatch = trimmed.match(/^([½⅓⅔¼¾⅛⅜⅝⅞]|\d+\s*[½⅓⅔¼¾⅛⅜⅝⅞])\s+([a-zA-Z]+)\s+(.+)$/);
  if (unicodeMatch) {
    const [, qty, maybeUnit, rest] = unicodeMatch;
    if (UNITS.has(maybeUnit.toLowerCase())) {
      return { quantity: qty.trim(), unit: maybeUnit.toLowerCase(), name: rest.trim() };
    }
    return { quantity: qty.trim(), unit: null, name: `${maybeUnit} ${rest}`.trim() };
  }

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

  const match = trimmed.match(
    /^(\d+(?:[/.]\d+)?(?:\s+\d+\/\d+)?)\s+([a-zA-Z]+)\s+(.+)$/
  );
  if (match) {
    const [, qty, maybeUnit, rest] = match;
    if (UNITS.has(maybeUnit.toLowerCase())) {
      return { quantity: qty, unit: maybeUnit.toLowerCase(), name: rest.trim() };
    }
    return { quantity: qty, unit: null, name: `${maybeUnit} ${rest}`.trim() };
  }

  const numOnly = trimmed.match(/^(\d+(?:[/.]\d+)?)\s+(.+)$/);
  if (numOnly) {
    const [, qty, rest] = numOnly;
    return { quantity: qty, unit: null, name: rest.trim() };
  }

  return { name: trimmed, quantity: null, unit: null };
}

export function parsePastedText(text: string): ParsedIngredientLine[] {
  return text
    .split('\n')
    .map((l) => parseIngredientLine(l.trim()))
    .filter((l) => l.name.length > 0);
}

// ── Quantity math ─────────────────────────────────────────────────────────────

function parseQuantity(qty: string): number | null {
  if (!qty) return null;
  const trimmed = qty.trim();

  const UNICODE: Record<string, number> = {
    '⅛': 1/8, '¼': 1/4, '⅓': 1/3, '⅜': 3/8,
    '½': 1/2, '⅝': 5/8, '⅔': 2/3, '¾': 3/4, '⅞': 7/8,
  };
  const hasUnicode = /[⅛¼⅓⅜½⅝⅔¾⅞]/.test(trimmed);
  if (hasUnicode) {
    let value = 0;
    let rest = trimmed;
    const wholeMatch = rest.match(/^(\d+)/);
    if (wholeMatch) {
      value += parseInt(wholeMatch[1], 10);
      rest = rest.slice(wholeMatch[0].length);
    }
    if (rest && UNICODE[rest] !== undefined) {
      value += UNICODE[rest];
      return value;
    }
    return null;
  }

  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const num = parseInt(mixed[2], 10);
    const den = parseInt(mixed[3], 10);
    if (den === 0) return null;
    return whole + num / den;
  }

  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const num = parseInt(fraction[1], 10);
    const den = parseInt(fraction[2], 10);
    if (den === 0) return null;
    return num / den;
  }

  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

function formatQuantity(value: number): string {
  if (value <= 0) return '0';
  const whole = Math.floor(value);
  const frac = value - whole;
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
    [1,     '1'],
  ];

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

  void TOLERANCE;
  const displayWhole = roundUp ? whole + 1 : whole;
  const displayFrac = roundUp ? '' : bestFrac;

  if (displayWhole === 0) return displayFrac || '0';
  if (!displayFrac) return String(displayWhole);
  return `${displayWhole}${displayFrac}`;
}

type UnitGroup = 'volume' | 'weight' | 'count';

interface UnitInfo {
  group: UnitGroup;
  toBase: number;
  canonical: string;
}

const UNIT_TABLE: Record<string, UnitInfo> = {
  'tsp':         { group: 'volume', toBase: 1,      canonical: 'tsp' },
  'teaspoon':    { group: 'volume', toBase: 1,      canonical: 'tsp' },
  'teaspoons':   { group: 'volume', toBase: 1,      canonical: 'tsp' },
  'tbsp':        { group: 'volume', toBase: 3,      canonical: 'tbsp' },
  'tablespoon':  { group: 'volume', toBase: 3,      canonical: 'tbsp' },
  'tablespoons': { group: 'volume', toBase: 3,      canonical: 'tbsp' },
  'fl oz':       { group: 'volume', toBase: 6,      canonical: 'fl oz' },
  'cup':         { group: 'volume', toBase: 48,     canonical: 'cup' },
  'cups':        { group: 'volume', toBase: 48,     canonical: 'cup' },
  'pint':        { group: 'volume', toBase: 96,     canonical: 'pint' },
  'pints':       { group: 'volume', toBase: 96,     canonical: 'pint' },
  'quart':       { group: 'volume', toBase: 192,    canonical: 'quart' },
  'quarts':      { group: 'volume', toBase: 192,    canonical: 'quart' },
  'gallon':      { group: 'volume', toBase: 768,    canonical: 'gallon' },
  'gallons':     { group: 'volume', toBase: 768,    canonical: 'gallon' },
  'ml':          { group: 'volume', toBase: 0.2029, canonical: 'ml' },
  'l':           { group: 'volume', toBase: 202.9,  canonical: 'l' },
  'liter':       { group: 'volume', toBase: 202.9,  canonical: 'l' },
  'liters':      { group: 'volume', toBase: 202.9,  canonical: 'l' },
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
  'kg':          { group: 'weight', toBase: 35.27,  canonical: 'kg' },
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

function parseQuantityFromFormatted(s: string): number | null {
  const UNICODE: Record<string, number> = {
    '⅛': 1/8, '¼': 1/4, '⅓': 1/3, '⅜': 3/8,
    '½': 1/2, '⅝': 5/8, '⅔': 2/3, '¾': 3/4, '⅞': 7/8,
  };
  let value = 0;
  let str = s.trim();
  const wholeMatch = str.match(/^(\d+)/);
  if (wholeMatch) {
    value += parseInt(wholeMatch[1], 10);
    str = str.slice(wholeMatch[0].length);
  }
  if (str && UNICODE[str] !== undefined) {
    value += UNICODE[str];
  } else if (str) {
    return null;
  }
  return value;
}

function parseMultiPartVolumeTsp(s: string): number | null {
  let totalTsp = 0;
  let matched = false;
  const parts = s.split(/\s*\+\s*/);
  for (const part of parts) {
    const trimmed = part.trim();
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

function formatVolume(totalTsp: number): { quantity: string; unit: string } {
  if (totalTsp < 3 - 0.01) {
    return { quantity: formatQuantity(totalTsp), unit: 'tsp' };
  } else if (totalTsp < 12 - 0.01) {
    const tbspQty = totalTsp / 3;
    const wholeTbsp = Math.floor(tbspQty + 0.01);
    const remTsp = Math.round((totalTsp - wholeTbsp * 3) * 1000) / 1000;
    if (remTsp < 0.1) {
      return { quantity: formatQuantity(wholeTbsp), unit: 'tbsp' };
    }
    const fracTbsp = tbspQty - wholeTbsp;
    if (Math.abs(fracTbsp - 0.5) < 0.04) {
      return { quantity: formatQuantity(tbspQty), unit: 'tbsp' };
    }
    const remFormatted = formatQuantity(remTsp);
    if (wholeTbsp === 0) {
      return { quantity: remFormatted, unit: 'tsp' };
    }
    return { quantity: `${formatQuantity(wholeTbsp)} tbsp + ${remFormatted} tsp`, unit: '' };
  } else if (totalTsp < 192 - 0.01) {
    if (totalTsp < 48 - 0.01) {
      const cupFrac = totalTsp / 48;
      const formatted = formatQuantity(cupFrac);
      const reparsed = parseQuantityFromFormatted(formatted);
      if (reparsed !== null && reparsed > 0 && Math.abs(reparsed - cupFrac) < 0.015) {
        return { quantity: formatted, unit: 'cup' };
      }
      const tbspQty = totalTsp / 3;
      const wholeTbsp = Math.floor(tbspQty + 0.01);
      const remTsp = Math.round((totalTsp - wholeTbsp * 3) * 1000) / 1000;
      if (remTsp < 0.1) return { quantity: formatQuantity(wholeTbsp), unit: 'tbsp' };
      return { quantity: `${formatQuantity(wholeTbsp)} tbsp + ${formatQuantity(remTsp)} tsp`, unit: '' };
    }
    return formatPrimarySecondary(totalTsp, 'cup', 48, 'tbsp', 3);
  } else if (totalTsp < 768 - 0.01) {
    return formatPrimarySecondary(totalTsp, 'quart', 192, 'cup', 48);
  } else {
    return formatPrimarySecondary(totalTsp, 'gallon', 768, 'quart', 192);
  }
}

function formatPrimarySecondary(
  totalTsp: number,
  primaryUnit: string, primaryTsp: number,
  secondaryUnit: string, secondaryTsp: number
): { quantity: string; unit: string } {
  const qtyInUnit = totalTsp / primaryTsp;
  const wholeCount = Math.floor(qtyInUnit + 0.005);
  const remainderTsp = Math.round((totalTsp - wholeCount * primaryTsp) * 1000) / 1000;

  if (remainderTsp < 0.1) {
    return { quantity: formatQuantity(wholeCount), unit: primaryUnit };
  }

  if (wholeCount === 0) {
    const formatted = formatQuantity(qtyInUnit);
    const reparsed = parseQuantityFromFormatted(formatted);
    if (reparsed !== null && reparsed > 0 && Math.abs(reparsed - qtyInUnit) < 0.04) {
      return { quantity: formatted, unit: primaryUnit };
    }
  }

  if (wholeCount > 0) {
    const fracPart = qtyInUnit - wholeCount;
    if (fracPart >= 1 / 4 - 0.01) {
      const formatted = formatQuantity(qtyInUnit);
      const reparsed = parseQuantityFromFormatted(formatted);
      if (reparsed !== null && reparsed > 0 && Math.abs(reparsed - qtyInUnit) < 0.015) {
        return { quantity: formatted, unit: primaryUnit };
      }
    }
  }

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

  if (!normalA && !normalB) {
    if (numA !== null && numB !== null) {
      return { quantity: formatQuantity(numA + numB), unit: null };
    }
    const tspA = qtyA ? parseMultiPartVolumeTsp(qtyA) : null;
    const tspB = qtyB ? parseMultiPartVolumeTsp(qtyB) : null;
    if (tspA !== null && tspB !== null) {
      const result = formatVolume(tspA + tspB);
      return { quantity: result.quantity, unit: result.unit || null };
    }
  }

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
      if (infoA.canonical === infoB.canonical) {
        const sum = total;
        const pluralUnit = sum === 1 ? infoA.canonical : infoA.canonical + 's';
        return { quantity: formatQuantity(sum), unit: pluralUnit };
      }
    }
  }

  if (normalA === normalB && numA !== null && numB !== null) {
    return { quantity: formatQuantity(numA + numB), unit: unitA };
  }

  const partA = [qtyA, unitA].filter(Boolean).join(' ');
  const partB = [qtyB, unitB].filter(Boolean).join(' ');

  if (!partA && !partB) return { quantity: null, unit: null };
  if (!partA) return { quantity: partB, unit: null };
  if (!partB) return { quantity: partA, unit: null };
  return { quantity: `${partA} + ${partB}`, unit: null };
}

// ── Exact duplicate consolidation ─────────────────────────────────────────────

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

// ── Name normalization ────────────────────────────────────────────────────────

const PREP_VERB_PATTERN =
  /\b(?:(?:thinly|finely|coarsely|roughly|freshly)\s+)?(?:sliced|chopped|minced|diced|grated|shredded|crumbled|crushed|julienned|peeled|trimmed|halved|quartered|torn|saut[eé]ed|roasted|toasted|blanched|steamed|boiled|fried|baked|grilled|smoked)\b/gi;

// Note: 'fresh' and 'dried' are intentionally excluded — they distinguish
// meaningfully different ingredients (e.g. fresh vs dried herbs/produce).
const PREP_ADJECTIVE_PATTERN =
  /\b(?:frozen|canned|raw|softened|melted|room[\s-]temperature|cold|warm|hot|cooled|thawed)\b/gi;

export function stripPreparationDescriptors(name: string): string {
  const withoutParens = name.replace(/\s*\([^)]*\)/g, '').trim();
  const beforeComma = withoutParens.split(',')[0].trim();
  const stripped = beforeComma
    .replace(PREP_VERB_PATTERN, '')
    .replace(PREP_ADJECTIVE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length >= 2 ? stripped : beforeComma;
}

export function normalizeIngredientName(name: string): string {
  const originalKey = name.toLowerCase().trim();
  const directMatch = INGREDIENT_ALIASES.get(originalKey);
  if (directMatch !== undefined) return directMatch;
  const stripped = stripPreparationDescriptors(name);
  const strippedKey = stripped.toLowerCase().trim();
  return INGREDIENT_ALIASES.get(strippedKey) ?? strippedKey;
}

export function normalizeIngredientNames(items: GroceryItem[]): GroceryItem[] {
  return items.map((item) => ({
    ...item,
    name: normalizeIngredientName(item.name),
  }));
}

// ── Re-export classifyIngredient for convenience ──────────────────────────────

export { classifyIngredient };
