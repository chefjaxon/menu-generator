'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Copy, Check, X } from 'lucide-react';
import {
  parsePastedText,
  normalizeIngredientNames,
  consolidateExactDuplicates,
  classifyIngredient,
} from '@/lib/grocery-utils-client';
import { findDuplicatePairs } from '@/lib/grocery-similarity';
import type { GroceryItem, DuplicatePair } from '@/lib/types';

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'pantry', 'other'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  protein: 'Proteins & Meat',
  dairy: 'Dairy',
  pantry: 'Pantry & Dry Goods',
  other: 'Other',
};

function makeStubItem(
  name: string,
  quantity: string | null,
  unit: string | null,
  index: number
): GroceryItem {
  return {
    id: crypto.randomUUID(),
    menuId: 'consolidator',
    name,
    quantity,
    unit,
    checked: false,
    source: 'manual',
    recipeItemId: null,
    notes: null,
    clientNote: null,
    sortOrder: index,
    category: 'other',
    createdAt: new Date().toISOString(),
  };
}

function pairKey(pair: DuplicatePair) {
  return `${pair.itemA.id}|${pair.itemB.id}`;
}

type OmitReason = 'bracketed' | 'no-quantity' | 'water' | 'seasoning';

interface OmittedItem {
  item: GroceryItem;
  reason: OmitReason;
  originalName: string;
}

function hasBrackets(name: string): boolean {
  return /\[/.test(name);
}

function isWater(name: string): boolean {
  const n = name.toLowerCase().trim();
  return n === 'water' || n.startsWith('filtered water');
}

// Salt and pepper are pantry staples — always omit regardless of quantity.
// Flaky sea salt is excluded (kept in list) via its own distinct canonical name.
const ALWAYS_OMIT_SEASONINGS = new Set(['salt', 'pepper', 'salt and pepper']);

function isSeasoningOmit(name: string): boolean {
  return ALWAYS_OMIT_SEASONINGS.has(name.toLowerCase().trim());
}

export function GroceryConsolidatorClient() {
  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<GroceryItem[] | null>(null);
  const [omittedItems, setOmittedItems] = useState<OmittedItem[]>([]);
  const [duplicatePairs, setDuplicatePairs] = useState<DuplicatePair[]>([]);
  const [originalCount, setOriginalCount] = useState(0);
  const [dismissedPairKeys, setDismissedPairKeys] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});

  // Load DB-backed category overrides on mount so all consolidations benefit
  useEffect(() => {
    fetch('/api/grocery-consolidator/category-override')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object' && !data.error) {
          setCategoryOverrides(data as Record<string, string>);
        }
      })
      .catch(() => {});
  }, []);

  function handleConsolidate() {
    if (!inputText.trim()) return;

    const parsed = parsePastedText(inputText);
    setOriginalCount(parsed.length);

    let groceryItems: GroceryItem[] = parsed.map((line, i) =>
      makeStubItem(line.name, line.quantity, line.unit, i)
    );

    groceryItems = normalizeIngredientNames(groceryItems);
    groceryItems = consolidateExactDuplicates(groceryItems);

    // Classify: DB overrides win over static table
    groceryItems = groceryItems.map((item) => {
      const key = item.name.toLowerCase().trim();
      const category = categoryOverrides[key] ?? classifyIngredient(item.name);
      return { ...item, category };
    });

    // Separate out omitted items
    const kept: GroceryItem[] = [];
    const omitted: OmittedItem[] = [];

    for (const item of groceryItems) {
      if (hasBrackets(item.name)) {
        omitted.push({ item, reason: 'bracketed', originalName: item.name });
      } else if (isWater(item.name)) {
        omitted.push({ item, reason: 'water', originalName: item.name });
      } else if (isSeasoningOmit(item.name)) {
        omitted.push({ item, reason: 'seasoning', originalName: item.name });
      } else if (!item.quantity && !item.unit) {
        omitted.push({ item, reason: 'no-quantity', originalName: item.name });
      } else {
        kept.push(item);
      }
    }

    const pairs = findDuplicatePairs(kept);

    setItems(kept);
    setOmittedItems(omitted);
    setDuplicatePairs(pairs);
    setDismissedPairKeys(new Set());
  }

  function handleAddOmitted(omitted: OmittedItem) {
    setOmittedItems((prev) => prev.filter((o) => o.item.id !== omitted.item.id));
    setItems((prev) => (prev ? [...prev, omitted.item] : [omitted.item]));
  }

  function handleDismiss(pair: DuplicatePair) {
    setDismissedPairKeys((prev) => new Set([...prev, pairKey(pair)]));
  }

  function handleCategoryChange(itemId: string, newCategory: string) {
    const item = items?.find((it) => it.id === itemId);
    if (!item) return;

    // Update local state immediately (optimistic)
    setItems((prev) =>
      prev ? prev.map((it) => (it.id === itemId ? { ...it, category: newCategory } : it)) : prev
    );

    // Update in-memory overrides so re-consolidation applies it right away
    const key = item.name.toLowerCase().trim();
    setCategoryOverrides((prev) => ({ ...prev, [key]: newCategory }));

    // Persist to DB — teaches the system for all future runs on any browser (fire and forget)
    fetch('/api/grocery-consolidator/category-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientName: item.name, category: newCategory }),
    }).catch(() => {});
  }

  function handleCopy() {
    if (!items) return;
    const blocks: string[] = [];
    for (const cat of CATEGORY_ORDER) {
      const catItems = items.filter((it) => it.category === cat);
      if (catItems.length === 0) continue;
      const heading = CATEGORY_LABELS[cat].toUpperCase();
      const rows = catItems.map((item) =>
        [item.quantity, item.unit, item.name].filter(Boolean).join(' ')
      );
      blocks.push([heading, ...rows].join('\n'));
    }
    navigator.clipboard.writeText(blocks.join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const visiblePairs = duplicatePairs.filter((p) => !dismissedPairKeys.has(pairKey(p)));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Grocery Consolidator</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Paste any grocery list below. Items will be parsed, normalized, and consolidated — combining
        duplicate ingredients and merging quantities automatically.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 items-start">
        {/* Input panel */}
        <div className="space-y-3">
          <label className="text-sm font-medium" htmlFor="grocery-input">
            Paste your grocery list
          </label>
          <textarea
            id="grocery-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={`One item per line. Examples:\n\n2 cups flour\n1 tbsp olive oil\n3 eggs\n1 cup flour\n100g parmesan, grated\n1 tbsp olive oil`}
          />
          <button
            onClick={handleConsolidate}
            disabled={!inputText.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardList className="h-4 w-4" />
            Consolidate
          </button>
        </div>

        {/* Results panel */}
        {items !== null && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{originalCount}</span> lines →{' '}
                <span className="font-semibold text-foreground">{items.length}</span> items
                {omittedItems.length > 0 && (
                  <span className="text-muted-foreground">
                    {' '}({omittedItems.length} omitted)
                  </span>
                )}
              </p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy list
                  </>
                )}
              </button>
            </div>

            {/* Potential duplicates */}
            {visiblePairs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-amber-700">
                    Potential Duplicates ({visiblePairs.length})
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Review items that may be the same ingredient
                  </span>
                </div>
                <div className="space-y-2">
                  {visiblePairs.map((pair) => (
                    <div
                      key={pairKey(pair)}
                      className="border border-amber-200 bg-amber-50 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 flex items-center gap-3 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pair.itemA.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[pair.itemA.quantity, pair.itemA.unit].filter(Boolean).join(' ') ||
                                'no qty'}
                            </p>
                          </div>
                          <div className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium shrink-0">
                            {Math.round(pair.similarity * 100)}% similar
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pair.itemB.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[pair.itemB.quantity, pair.itemB.unit].filter(Boolean).join(' ') ||
                                'no qty'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDismiss(pair)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded border border-border hover:bg-muted shrink-0"
                        >
                          <X className="h-3 w-3" />
                          Keep Separate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Omitted items */}
            {omittedItems.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/70 px-4 py-2 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Omitted Items ({omittedItems.length})
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Click + to add to the consolidated list
                  </span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
                      <th className="py-2 px-3 text-left">Name</th>
                      <th className="py-2 px-3 text-left w-40">Reason</th>
                      <th className="py-2 px-3 text-center w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {omittedItems.map((o) => (
                      <tr key={o.item.id} className="border-b border-border last:border-0">
                        <td className="py-2 px-3 text-sm text-muted-foreground">
                          {o.originalName}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {o.reason === 'bracketed'
                            ? 'Has [ ] brackets'
                            : o.reason === 'water'
                            ? 'Water'
                            : 'No measurement'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleAddOmitted(o)}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                            title="Add to consolidated list"
                          >
                            +
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Results grouped by category */}
            <div className="space-y-3">
              {CATEGORY_ORDER.map((cat) => {
                const catItems = items.filter((it) => it.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/70 px-4 py-2 border-b border-border">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[cat]} ({catItems.length})
                      </h3>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
                          <th className="py-2 px-3 text-left">Name</th>
                          <th className="py-2 px-3 text-center w-20">Qty</th>
                          <th className="py-2 px-3 text-center w-16">Unit</th>
                          <th className="py-2 px-3 text-left w-36">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map((item) => (
                          <tr key={item.id} className="border-b border-border last:border-0">
                            <td className="py-2 px-3 text-sm">{item.name}</td>
                            <td className="py-2 px-3 text-sm text-center">
                              {item.quantity ?? '—'}
                            </td>
                            <td className="py-2 px-3 text-sm text-center">
                              {item.unit ?? '—'}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={item.category}
                                onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                                className="w-full text-xs rounded border border-border bg-background px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                              >
                                {CATEGORY_ORDER.map((c) => (
                                  <option key={c} value={c}>
                                    {CATEGORY_LABELS[c]}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
