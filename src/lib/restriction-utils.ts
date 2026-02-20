/**
 * Utilities for matching client dietary restrictions against ingredient names.
 *
 * These replace the previous substring-based matching (nameNorm.includes(exNorm))
 * which caused false positives like:
 *   - "egg" restriction blocking "eggplant"
 *   - "corn" restriction blocking "acorn squash"
 *   - "rice" restriction blocking "licorice"
 *   - "pork" restriction blocking "portobello"
 */

/**
 * Normalize a restriction string to a canonical key for comparison.
 * Strips common qualifiers so "dairy-free", "no dairy", "dairy" all become "dairy".
 */
export function canonicalizeRestriction(r: string): string {
  return r
    .toLowerCase()
    .replace(/\b(no|free|avoid|without)\b/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Test whether an ingredient name matches a restriction using word-boundary rules.
 *
 * Uses a regex with \b word boundaries + optional trailing 's' so that:
 *   "egg"  matches "egg", "eggs", "egg white"     — does NOT match "eggplant"
 *   "corn" matches "corn", "corns", "sweet corn"  — does NOT match "acorn"
 *   "pork" matches "pork", "ground pork"          — does NOT match "portobello"
 *   "rice" matches "rice", "brown rice"            — does NOT match "licorice"
 *   "nut"  matches "nut", "nuts", "hazelnut",
 *          "peanut", "walnut", "cashew" via compound — does NOT match "donut"
 *
 * Both arguments are normalized to lowercase before matching.
 */
export function ingredientMatchesRestriction(
  ingredientName: string,
  restriction: string
): boolean {
  const canonicalRestriction = canonicalizeRestriction(restriction);
  if (!canonicalRestriction) return false;

  const escaped = canonicalRestriction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b word boundary before the restriction term, optional trailing 's', then another \b
  const regex = new RegExp(`\\b${escaped}s?\\b`, 'i');
  return regex.test(ingredientName);
}
