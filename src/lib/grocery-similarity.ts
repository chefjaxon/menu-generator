/**
 * Pure, client-safe similarity utilities for grocery item deduplication.
 *
 * This module has NO server-only dependencies (no prisma, no pg, no Node builtins)
 * and is safe to import from Client Components.
 *
 * Server-side grocery building lives in grocery-utils.ts (server-only).
 */
import type { GroceryItem, DuplicatePair } from './types';

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
