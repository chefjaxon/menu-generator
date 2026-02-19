'use client';

import { useState } from 'react';

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  protein: 'Proteins & Meat',
  dairy: 'Dairy',
  pantry: 'Pantry & Dry Goods',
  other: 'Other',
};

interface GroceryItem {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  category: string;
  notes: string | null;
}

interface Props {
  menuId: string;
  groceryByCategory: Record<string, GroceryItem[]>;
  categoryOrder: string[];
}

export function ChefGroceryView({ menuId, groceryByCategory, categoryOrder }: Props) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(
      Object.values(groceryByCategory)
        .flat()
        .filter((i) => i.checked)
        .map((i) => i.id)
    )
  );
  const [saving, setSaving] = useState<Set<string>>(new Set());

  async function toggleItem(id: string) {
    const wasChecked = checked.has(id);
    const newChecked = new Set(checked);
    if (wasChecked) newChecked.delete(id);
    else newChecked.add(id);
    setChecked(newChecked);

    setSaving((prev) => new Set([...prev, id]));
    await fetch(`/api/menus/${menuId}/grocery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: !wasChecked }),
    });
    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const allItems = categoryOrder.flatMap((cat) => groceryByCategory[cat] ?? []);
  const checkedCount = checked.size;
  const totalCount = allItems.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Shopping List</h2>
        <span className="text-xs text-muted-foreground">
          {checkedCount}/{totalCount} checked
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-foreground rounded-full transition-all"
          style={{ width: totalCount > 0 ? `${(checkedCount / totalCount) * 100}%` : '0%' }}
        />
      </div>

      <div className="space-y-4">
        {categoryOrder.map((cat) => {
          const items = groceryByCategory[cat] ?? [];
          if (items.length === 0) return null;

          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {CATEGORY_LABELS[cat] ?? cat}
              </h3>
              <div className="space-y-1">
                {items.map((item) => {
                  const isChecked = checked.has(item.id);
                  const isSaving = saving.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      disabled={isSaving}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                        isChecked
                          ? 'bg-muted/60 text-muted-foreground'
                          : 'bg-background border border-border hover:bg-muted/30'
                      }`}
                    >
                      {/* Large checkbox target for mobile */}
                      <span
                        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isChecked ? 'bg-foreground border-foreground' : 'border-border'
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-3 h-3 text-background" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-sm ${isChecked ? 'line-through' : 'font-medium'}`}>
                        {[item.quantity, item.unit, item.name].filter(Boolean).join(' ')}
                      </span>
                      {item.notes && !isChecked && (
                        <span className="text-xs text-muted-foreground ml-auto truncate max-w-24">
                          {item.notes}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
