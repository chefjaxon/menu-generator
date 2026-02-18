'use client';

import { useState } from 'react';
import { Trash2, RefreshCw, GitMerge, X } from 'lucide-react';
import type { GroceryItem, DuplicatePair } from '@/lib/types';

interface EditableRowProps {
  item: GroceryItem;
  onUpdate: (itemId: string, data: Partial<GroceryItem>) => void;
  onDelete: (itemId: string) => void;
}

function EditableRow({ item, onUpdate, onDelete }: EditableRowProps) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantity ?? '');
  const [unit, setUnit] = useState(item.unit ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');

  function handleBlur(field: string, value: string) {
    const normalized = value.trim();
    const original =
      field === 'name' ? item.name :
      field === 'quantity' ? (item.quantity ?? '') :
      field === 'unit' ? (item.unit ?? '') :
      (item.notes ?? '');
    if (normalized !== original) {
      onUpdate(item.id, {
        [field]: normalized === '' ? null : normalized,
      });
    }
  }

  return (
    <tr className="border-b border-border last:border-0 group">
      <td className="py-2 px-3 w-10">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={(e) => onUpdate(item.id, { checked: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
      </td>
      <td className="py-2 px-3">
        <input
          className={`w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border ${item.checked ? 'line-through text-muted-foreground' : ''}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => handleBlur('name', name)}
        />
      </td>
      <td className="py-2 px-3 w-24">
        <input
          className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border text-center"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={() => handleBlur('quantity', qty)}
          placeholder="—"
        />
      </td>
      <td className="py-2 px-3 w-20">
        <input
          className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border text-center"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          onBlur={() => handleBlur('unit', unit)}
          placeholder="—"
        />
      </td>
      <td className="py-2 px-3">
        <input
          className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border text-muted-foreground"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => handleBlur('notes', notes)}
          placeholder="Notes..."
        />
      </td>
      <td className="py-2 px-3 w-10">
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          title="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

interface MergeFormProps {
  pair: DuplicatePair;
  onMerge: (keepId: string, deleteId: string, mergedData: {
    name: string;
    quantity: string | null;
    unit: string | null;
    notes: string | null;
  }) => void;
  onDismiss: () => void;
}

function MergeForm({ pair, onMerge, onDismiss }: MergeFormProps) {
  const [name, setName] = useState(pair.itemA.name);
  const [qty, setQty] = useState(pair.itemA.quantity ?? '');
  const [unit, setUnit] = useState(pair.itemA.unit ?? '');
  const [notes, setNotes] = useState(
    [pair.itemA.notes, pair.itemB.notes].filter(Boolean).join('; ')
  );

  function handleMerge() {
    onMerge(pair.itemA.id, pair.itemB.id, {
      name: name.trim(),
      quantity: qty.trim() || null,
      unit: unit.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Merged item:</p>
      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 text-sm px-2 py-1 border border-border rounded bg-background"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-20 text-sm px-2 py-1 border border-border rounded bg-background text-center"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <input
          className="w-16 text-sm px-2 py-1 border border-border rounded bg-background text-center"
          placeholder="Unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
      <input
        className="w-full text-sm px-2 py-1 border border-border rounded bg-background mb-2"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={handleMerge}
          disabled={!name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded hover:opacity-90 disabled:opacity-50"
        >
          <GitMerge className="h-3 w-3" />
          Confirm Merge
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded border border-border hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface Props {
  menuId: string;
  items: GroceryItem[];
  duplicatePairs: DuplicatePair[];
  generating: boolean;
  onGenerate: () => void;
  onUpdate: (itemId: string, data: Partial<GroceryItem>) => void;
  onDelete: (itemId: string) => void;
  onMerge: (keepId: string, deleteId: string, mergedData: {
    name: string;
    quantity: string | null;
    unit: string | null;
    notes: string | null;
  }) => void;
}

export function GroceryListSection({
  items,
  duplicatePairs,
  generating,
  onGenerate,
  onUpdate,
  onDelete,
  onMerge,
}: Props) {
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [mergingPairKey, setMergingPairKey] = useState<string | null>(null);

  function pairKey(pair: DuplicatePair) {
    return `${pair.itemA.id}|${pair.itemB.id}`;
  }

  const visiblePairs = duplicatePairs.filter(
    (p) => !dismissedPairs.has(pairKey(p))
  );

  function handleDismiss(pair: DuplicatePair) {
    setDismissedPairs((prev) => new Set([...prev, pairKey(pair)]));
    setMergingPairKey(null);
  }

  function handleMerge(pair: DuplicatePair, mergedData: {
    name: string; quantity: string | null; unit: string | null; notes: string | null;
  }) {
    onMerge(pair.itemA.id, pair.itemB.id, mergedData);
    setDismissedPairs((prev) => new Set([...prev, pairKey(pair)]));
    setMergingPairKey(null);
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Grocery List</h2>
          {items.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {checkedCount} of {items.length} items checked
            </p>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Generate from Selections'}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No items yet. Select recipes above and click &quot;Generate from Selections&quot;,
          or paste ingredients in the section below.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="py-2 px-3 w-10"></th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                  Ingredient
                </th>
                <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground w-24">
                  Qty
                </th>
                <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground w-20">
                  Unit
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                  Notes
                </th>
                <th className="py-2 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <EditableRow
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visiblePairs.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-amber-700">
              Potential Duplicates ({visiblePairs.length})
            </h3>
            <span className="text-xs text-muted-foreground">
              Review and merge items that may be the same ingredient
            </span>
          </div>
          <div className="space-y-2">
            {visiblePairs.map((pair) => {
              const key = pairKey(pair);
              const isMerging = mergingPairKey === key;
              return (
                <div key={key} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isMerging && (
                        <button
                          onClick={() => setMergingPairKey(key)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700"
                        >
                          <GitMerge className="h-3 w-3" />
                          Merge
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(pair)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded border border-border hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                        Keep Separate
                      </button>
                    </div>
                  </div>
                  {isMerging && (
                    <MergeForm
                      pair={pair}
                      onMerge={(keepId, deleteId, data) => handleMerge(pair, data)}
                      onDismiss={() => setMergingPairKey(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
