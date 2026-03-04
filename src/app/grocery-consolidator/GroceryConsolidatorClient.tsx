'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ClipboardList, Copy, Check, X, Plus, Trash2, Tag, Pencil } from 'lucide-react';
import {
  parsePastedText,
  normalizeIngredientNames,
  consolidateExactDuplicates,
  convertCitrusJuiceToCount,
  classifyIngredient,
} from '@/lib/grocery-utils-client';
import { findDuplicatePairs } from '@/lib/grocery-similarity';
import type { GroceryItem, DuplicatePair } from '@/lib/types';

// Factory built-in categories — slugs never change on the server; only labels/current slugs are overridable
const BUILTIN_CATEGORIES = [
  { slug: 'produce', label: 'Produce' },
  { slug: 'protein', label: 'Proteins & Meat' },
  { slug: 'dairy', label: 'Dairy' },
  { slug: 'pantry', label: 'Pantry & Dry Goods' },
  { slug: 'other', label: 'Other' },
] as const;

type FactorySlug = (typeof BUILTIN_CATEGORIES)[number]['slug'];

interface CustomCategory {
  slug: string;
  label: string;
  sortOrder: number;
}

interface BuiltinOverride {
  currentSlug: string;
  label: string;
}

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
  return (
    n === 'water' ||
    n.startsWith('filtered water') ||
    n.startsWith('sparkling water') ||
    n.startsWith('ice water') ||
    n.startsWith('warm water') ||
    n.startsWith('cold water')
  );
}

// Exact names that should always be omitted regardless of quantity — these are universal
// pantry staples every meal-prep client already has stocked.
// Conservative by design: only add items that are TRULY universal (salt, pepper, spray).
// "cumin", "chili powder", etc. are NOT here because they may need to be purchased.
const ALWAYS_OMIT_SEASONINGS = new Set([
  // Salt variants
  'salt', 'kosher salt', 'sea salt', 'table salt', 'coarse salt', 'flaky salt',
  'fine salt', 'fine sea salt', 'coarse kosher salt',
  // Pepper variants (standalone, not produce like "bell pepper")
  // white pepper intentionally excluded — some clients may not have it stocked
  'pepper', 'black pepper', 'ground pepper', 'cracked pepper',
  'freshly ground pepper', 'freshly cracked pepper',
  // Salt & pepper combos
  'salt and pepper', 'salt & pepper', 'salt & black pepper', 'salt and black pepper',
  // Cooking spray
  'cooking spray', 'nonstick spray', 'nonstick cooking spray',
]);

function isSeasoningOmit(name: string): boolean {
  return ALWAYS_OMIT_SEASONINGS.has(name.toLowerCase().trim());
}

interface DeleteConfirm {
  slug: string;
  label: string;
  reassignTo: string;
}

type EditableItemField = 'name' | 'quantity' | 'unit';

interface EditingCell {
  itemId: string;
  field: EditableItemField;
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

  // Custom categories (user-created)
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [managePanelOpen, setManagePanelOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  // Built-in category overrides (renamed built-ins)
  // Key = factory slug ('produce', 'protein', etc.), value = { currentSlug, label }
  const [builtinOverrides, setBuiltinOverrides] = useState<Record<string, BuiltinOverride>>({});
  const [editingBuiltinSlug, setEditingBuiltinSlug] = useState<FactorySlug | null>(null);
  const [editingBuiltinValue, setEditingBuiltinValue] = useState('');
  const builtinInputRef = useRef<HTMLInputElement>(null);

  // Inline item cell editing
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Add new item form
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('other');
  const newItemNameRef = useRef<HTMLInputElement>(null);

  // Effective built-in list: factory defaults overridden by any user renames
  const effectiveBuiltins = BUILTIN_CATEGORIES.map((cat) => {
    const ov = builtinOverrides[cat.slug];
    return ov ? { slug: ov.currentSlug, label: ov.label } : { slug: cat.slug as string, label: cat.label as string };
  });

  // All categories: effective built-ins first, then user-created custom categories
  const allCategories = [
    ...effectiveBuiltins,
    ...customCategories.map((c) => ({ slug: c.slug, label: c.label })),
  ];

  // Load everything on mount
  useEffect(() => {
    fetch('/api/grocery-consolidator/category-override')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object' && !data.error) {
          setCategoryOverrides(data as Record<string, string>);
        }
      })
      .catch(() => {});

    fetch('/api/grocery-consolidator/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomCategories(data as CustomCategory[]);
      })
      .catch(() => {});

    fetch('/api/grocery-consolidator/categories/builtin')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object' && !data.error) {
          setBuiltinOverrides(data as Record<string, BuiltinOverride>);
        }
      })
      .catch(() => {});
  }, []);

  // Focus builtin input when edit mode opens
  useEffect(() => {
    if (editingBuiltinSlug) {
      setTimeout(() => builtinInputRef.current?.focus(), 0);
    }
  }, [editingBuiltinSlug]);

  function handleConsolidate() {
    if (!inputText.trim()) return;

    const parsed = parsePastedText(inputText);
    setOriginalCount(parsed.length);

    let groceryItems: GroceryItem[] = parsed.map((line, i) =>
      makeStubItem(line.name, line.quantity, line.unit, i)
    );

    groceryItems = normalizeIngredientNames(groceryItems);
    groceryItems = consolidateExactDuplicates(groceryItems).map(convertCitrusJuiceToCount);

    groceryItems = groceryItems.map((item) => {
      const key = item.name.toLowerCase().trim();
      const category = categoryOverrides[key] ?? classifyIngredient(item.name);
      return { ...item, category };
    });

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

    setItems(kept);
    setOmittedItems(omitted);
    setDuplicatePairs(findDuplicatePairs(kept));
    setDismissedPairKeys(new Set());
    setEditingCell(null);
    setAddingItem(false);
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

    setItems((prev) =>
      prev ? prev.map((it) => (it.id === itemId ? { ...it, category: newCategory } : it)) : prev
    );

    const key = item.name.toLowerCase().trim();
    setCategoryOverrides((prev) => ({ ...prev, [key]: newCategory }));

    fetch('/api/grocery-consolidator/category-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientName: item.name, category: newCategory }),
    }).catch(() => {});
  }

  function handleCopy() {
    if (!items) return;
    const blocks: string[] = [];
    for (const cat of allCategories) {
      const catItems = items.filter((it) => it.category === cat.slug);
      if (catItems.length === 0) continue;
      const heading = cat.label.toUpperCase();
      const rows = catItems.map((item) =>
        [item.quantity, item.unit, item.name].filter(Boolean).join(' ')
      );
      blocks.push([heading, ...rows].join('\n'));
    }
    navigator.clipboard.writeText(blocks.join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Custom category management ───────────────────────────────────────────

  async function handleAddCategory() {
    const label = newCategoryLabel.trim();
    if (!label) return;
    setAddingCategory(true);
    try {
      const res = await fetch('/api/grocery-consolidator/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        const created = await res.json();
        setCustomCategories((prev) => {
          const without = prev.filter((c) => c.slug !== created.slug);
          return [...without, created];
        });
        setNewCategoryLabel('');
        newCategoryInputRef.current?.focus();
      }
    } finally {
      setAddingCategory(false);
    }
  }

  function handleDeleteClick(cat: CustomCategory) {
    setDeleteConfirm({ slug: cat.slug, label: cat.label, reassignTo: 'other' });
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    const { slug, reassignTo } = deleteConfirm;
    setDeletingSlug(slug);
    try {
      const res = await fetch('/api/grocery-consolidator/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, reassignTo }),
      });
      if (res.ok) {
        setCustomCategories((prev) => prev.filter((c) => c.slug !== slug));
        setCategoryOverrides((prev) => {
          const updated: Record<string, string> = {};
          for (const [k, v] of Object.entries(prev)) {
            updated[k] = v === slug ? reassignTo : v;
          }
          return updated;
        });
        setItems((prev) =>
          prev
            ? prev.map((it) => (it.category === slug ? { ...it, category: reassignTo } : it))
            : prev
        );
        setDeleteConfirm(null);
      }
    } finally {
      setDeletingSlug(null);
    }
  }

  // ─── Built-in category rename ──────────────────────────────────────────────

  function startEditBuiltin(factorySlug: FactorySlug) {
    const ov = builtinOverrides[factorySlug];
    const currentLabel = ov?.label ?? BUILTIN_CATEGORIES.find((c) => c.slug === factorySlug)?.label ?? '';
    setEditingBuiltinSlug(factorySlug);
    setEditingBuiltinValue(currentLabel);
  }

  async function commitBuiltinRename() {
    const originalSlug = editingBuiltinSlug;
    const newLabel = editingBuiltinValue.trim();
    setEditingBuiltinSlug(null);
    setEditingBuiltinValue('');

    if (!originalSlug || !newLabel) return;

    // Derive old effective slug to remap items/overrides in memory
    const oldSlug = builtinOverrides[originalSlug]?.currentSlug ?? originalSlug;

    const res = await fetch('/api/grocery-consolidator/categories/builtin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalSlug, newLabel }),
    });
    if (!res.ok) return;

    const result = await res.json() as { originalSlug: string; currentSlug: string; label: string };
    const newSlug = result.currentSlug;

    setBuiltinOverrides((prev) => ({
      ...prev,
      [result.originalSlug]: { currentSlug: newSlug, label: result.label },
    }));

    // Remap in-memory category overrides
    setCategoryOverrides((prev) => {
      const updated: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        updated[k] = v === oldSlug ? newSlug : v;
      }
      return updated;
    });

    // Remap any currently displayed items
    setItems((prev) =>
      prev
        ? prev.map((it) => (it.category === oldSlug ? { ...it, category: newSlug } : it))
        : prev
    );
  }

  function cancelBuiltinEdit() {
    setEditingBuiltinSlug(null);
    setEditingBuiltinValue('');
  }

  // ─── Inline item field editing ─────────────────────────────────────────────

  function startCellEdit(itemId: string, field: EditableItemField, currentValue: string | null) {
    setEditingCell({ itemId, field });
    setEditingValue(currentValue ?? '');
  }

  const commitCellEdit = useCallback(() => {
    if (!editingCell) return;
    const { itemId, field } = editingCell;
    const newValue = editingValue.trim() || null;

    setItems((prev) => {
      if (!prev) return prev;
      return prev.map((it) => {
        if (it.id !== itemId) return it;
        if (field === 'name') {
          // Remap category override from old name → new name
          if (newValue && newValue !== it.name) {
            const oldKey = it.name.toLowerCase().trim();
            const newKey = newValue.toLowerCase().trim();
            setCategoryOverrides((ov) => {
              if (!(oldKey in ov)) return ov;
              const updated = { ...ov };
              updated[newKey] = updated[oldKey];
              delete updated[oldKey];
              return updated;
            });
          }
          return { ...it, name: newValue ?? it.name };
        }
        if (field === 'quantity') return { ...it, quantity: newValue };
        if (field === 'unit') return { ...it, unit: newValue };
        return it;
      });
    });

    setEditingCell(null);
    setEditingValue('');
  }, [editingCell, editingValue]);

  function cancelCellEdit() {
    setEditingCell(null);
    setEditingValue('');
  }

  function handleDeleteItem(itemId: string) {
    setItems((prev) => prev ? prev.filter((it) => it.id !== itemId) : prev);
  }

  function handleAddItem() {
    const name = newItemName.trim();
    if (!name) return;
    const qty = newItemQty.trim() || null;
    const unit = newItemUnit.trim() || null;
    const newItem = makeStubItem(name, qty, unit, (items?.length ?? 0));
    newItem.category = newItemCategory;
    setItems((prev) => prev ? [...prev, newItem] : [newItem]);
    setNewItemName('');
    setNewItemQty('');
    setNewItemUnit('');
    setNewItemCategory('other');
    setAddingItem(false);
  }

  function handleAddItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }
    if (e.key === 'Escape') { e.preventDefault(); setAddingItem(false); }
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitCellEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelCellEdit(); }
  }

  function handleBuiltinKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitBuiltinRename(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelBuiltinEdit(); }
  }

  const visiblePairs = duplicatePairs.filter((p) => !dismissedPairKeys.has(pairKey(p)));

  // Helper: render an editable cell in the results table
  function renderEditableCell(
    item: GroceryItem,
    field: EditableItemField,
    displayValue: string | null,
    className: string
  ) {
    const isEditing = editingCell?.itemId === item.id && editingCell.field === field;
    return (
      <td
        className={`py-2 px-3 text-sm cursor-pointer group/cell ${className}`}
        onClick={() => !isEditing && startCellEdit(item.id, field, displayValue)}
      >
        {isEditing ? (
          <input
            autoFocus
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={commitCellEdit}
            onKeyDown={handleCellKeyDown}
            className="w-full bg-transparent focus:outline-none border-b border-primary"
          />
        ) : (
          <span className="flex items-center gap-1">
            {displayValue ?? <span className="text-muted-foreground">—</span>}
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
          </span>
        )}
      </td>
    );
  }

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

          {/* Manage Categories panel */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setManagePanelOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Manage Categories
                {customCategories.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({customCategories.length} custom)
                  </span>
                )}
              </span>
              <span className="text-muted-foreground text-xs">{managePanelOpen ? '▲' : '▼'}</span>
            </button>

            {managePanelOpen && (
              <div className="p-3 space-y-3 border-t border-border">
                {/* Built-in categories — click label to rename */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground px-2 pb-0.5">Click a name to rename</p>
                  {BUILTIN_CATEGORIES.map((cat) => {
                    const isEditing = editingBuiltinSlug === cat.slug;
                    const effectiveLabel =
                      builtinOverrides[cat.slug]?.label ?? cat.label;
                    return (
                      <div key={cat.slug} className="flex items-center justify-between py-1 px-2 rounded text-sm group">
                        {isEditing ? (
                          <input
                            ref={builtinInputRef}
                            value={editingBuiltinValue}
                            onChange={(e) => setEditingBuiltinValue(e.target.value)}
                            onBlur={commitBuiltinRename}
                            onKeyDown={handleBuiltinKeyDown}
                            className="flex-1 bg-transparent focus:outline-none border-b border-primary text-sm mr-2"
                          />
                        ) : (
                          <button
                            onClick={() => startEditBuiltin(cat.slug)}
                            className="flex-1 text-left hover:text-primary transition-colors"
                          >
                            {effectiveLabel}
                            {builtinOverrides[cat.slug] && (
                              <span className="ml-1.5 text-xs text-muted-foreground">(edited)</span>
                            )}
                          </button>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">built-in</span>
                      </div>
                    );
                  })}
                </div>

                {/* Custom categories */}
                {customCategories.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-2">
                    {customCategories.map((cat) => (
                      <div key={cat.slug}>
                        {deleteConfirm?.slug === cat.slug ? (
                          <div className="border border-destructive/30 bg-destructive/5 rounded-md p-2 space-y-2">
                            <p className="text-xs text-destructive font-medium">
                              Delete &quot;{cat.label}&quot;? Reassign its items to:
                            </p>
                            <select
                              value={deleteConfirm.reassignTo}
                              onChange={(e) =>
                                setDeleteConfirm((prev) =>
                                  prev ? { ...prev, reassignTo: e.target.value } : prev
                                )
                              }
                              className="w-full text-xs rounded border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              {allCategories
                                .filter((c) => c.slug !== cat.slug)
                                .map((c) => (
                                  <option key={c.slug} value={c.slug}>
                                    {c.label}
                                  </option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                onClick={handleDeleteConfirm}
                                disabled={deletingSlug === cat.slug}
                                className="flex-1 px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
                              >
                                {deletingSlug === cat.slug ? 'Deleting…' : 'Confirm Delete'}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                disabled={deletingSlug === cat.slug}
                                className="flex-1 px-2 py-1 text-xs border border-border rounded hover:bg-muted transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm group">
                            <span>{cat.label}</span>
                            <button
                              onClick={() => handleDeleteClick(cat)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              title={`Delete ${cat.label}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new category */}
                <div className="border-t border-border pt-2">
                  <div className="flex gap-2">
                    <input
                      ref={newCategoryInputRef}
                      type="text"
                      value={newCategoryLabel}
                      onChange={(e) => setNewCategoryLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                      placeholder="New category name…"
                      className="flex-1 text-sm rounded border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={handleAddCategory}
                      disabled={!newCategoryLabel.trim() || addingCategory}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results panel */}
        {items !== null && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{originalCount}</span> lines →{' '}
                <span className="font-semibold text-foreground">{items.length}</span> items
                {omittedItems.filter((o) => o.reason === 'seasoning' || o.reason === 'no-quantity').length > 0 && (
                  <span className="text-amber-700">
                    {' '}({omittedItems.filter((o) => o.reason === 'seasoning' || o.reason === 'no-quantity').length} pantry check)
                  </span>
                )}
                {omittedItems.filter((o) => o.reason === 'water' || o.reason === 'bracketed').length > 0 && (
                  <span className="text-muted-foreground">
                    {' '}({omittedItems.filter((o) => o.reason === 'water' || o.reason === 'bracketed').length} skipped)
                  </span>
                )}
              </p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors shrink-0"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-green-600" />Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" />Copy list</>
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
                    <div key={pairKey(pair)} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 flex items-center gap-3 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pair.itemA.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[pair.itemA.quantity, pair.itemA.unit].filter(Boolean).join(' ') || 'no qty'}
                            </p>
                          </div>
                          <div className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium shrink-0">
                            {Math.round(pair.similarity * 100)}% similar
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pair.itemB.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[pair.itemB.quantity, pair.itemB.unit].filter(Boolean).join(' ') || 'no qty'}
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

            {/* Pantry Check — seasonings and no-qty items the shopper should verify */}
            {omittedItems.some((o) => o.reason === 'seasoning' || o.reason === 'no-quantity') && (() => {
              const pantryItems = omittedItems.filter((o) => o.reason === 'seasoning' || o.reason === 'no-quantity');
              return (
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                        Pantry Check ({pantryItems.length})
                      </h3>
                      <p className="text-xs text-amber-700 mt-0.5">Verify you have these stocked — click + to add to shopping list</p>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-amber-50/60 border-b border-amber-100 text-xs font-medium text-amber-700">
                        <th className="py-2 px-3 text-left">Name</th>
                        <th className="py-2 px-3 text-left w-44">Note</th>
                        <th className="py-2 px-3 text-center w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pantryItems.map((o) => (
                        <tr key={o.item.id} className="border-b border-amber-100 last:border-0 hover:bg-amber-50/40">
                          <td className="py-2 px-3 text-sm text-foreground">{o.originalName}</td>
                          <td className="py-2 px-3 text-xs text-muted-foreground">
                            {o.reason === 'seasoning' ? 'Universal staple' : 'No measurement — as needed'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleAddOmitted(o)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                              title="Add to shopping list"
                            >
                              +
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Skipped Automatically — water and bracketed items removed silently */}
            {omittedItems.some((o) => o.reason === 'water' || o.reason === 'bracketed') && (() => {
              const skippedItems = omittedItems.filter((o) => o.reason === 'water' || o.reason === 'bracketed');
              return (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Skipped Automatically ({skippedItems.length})
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Removed for formatting reasons — click + to restore</p>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
                        <th className="py-2 px-3 text-left">Name</th>
                        <th className="py-2 px-3 text-left w-44">Reason</th>
                        <th className="py-2 px-3 text-center w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {skippedItems.map((o) => (
                        <tr key={o.item.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-3 text-sm text-muted-foreground">{o.originalName}</td>
                          <td className="py-2 px-3 text-xs text-muted-foreground">
                            {o.reason === 'water' ? 'Water — skip' : 'Has [ ] brackets'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleAddOmitted(o)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted-foreground/20 text-muted-foreground text-xs font-bold hover:bg-muted-foreground/30 transition-colors"
                              title="Restore to shopping list"
                            >
                              +
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Results grouped by category */}
            <div className="space-y-3">
              {allCategories.map((cat) => {
                const catItems = items.filter((it) => it.category === cat.slug);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.slug} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/70 px-4 py-2 border-b border-border flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {cat.label} ({catItems.length})
                      </h3>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
                          <th className="py-2 px-3 text-left">Name</th>
                          <th className="py-2 px-3 text-center w-20">Qty</th>
                          <th className="py-2 px-3 text-center w-16">Unit</th>
                          <th className="py-2 px-3 text-left w-36">Category</th>
                          <th className="py-2 px-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map((item) => (
                          <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20 group/row">
                            {renderEditableCell(item, 'name', item.name, 'text-left')}
                            {renderEditableCell(item, 'quantity', item.quantity, 'text-center w-20')}
                            {renderEditableCell(item, 'unit', item.unit, 'text-center w-16')}
                            <td className="py-2 px-3 w-36">
                              <select
                                value={item.category}
                                onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                                className="w-full text-xs rounded border border-border bg-background px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                              >
                                {allCategories.map((c) => (
                                  <option key={c.slug} value={c.slug}>{c.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2 w-10 text-center">
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                title="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Add new item */}
            {addingItem ? (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Add ingredient</p>
                <div className="flex gap-2 flex-wrap">
                  <input
                    ref={newItemNameRef}
                    autoFocus
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={handleAddItemKeyDown}
                    placeholder="Name"
                    className="flex-1 min-w-32 text-sm rounded border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    onKeyDown={handleAddItemKeyDown}
                    placeholder="Qty"
                    className="w-20 text-sm rounded border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    onKeyDown={handleAddItemKeyDown}
                    placeholder="Unit"
                    className="w-20 text-sm rounded border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="text-sm rounded border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    {allCategories.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddItem}
                    disabled={!newItemName.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                  <button
                    onClick={() => setAddingItem(false)}
                    className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-dashed border-border rounded-md hover:bg-muted hover:border-border/80 transition-colors text-muted-foreground hover:text-foreground w-full justify-center"
              >
                <Plus className="h-3.5 w-3.5" />
                Add ingredient
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
