'use client';

import { useState } from 'react';
import { CheckCircle2, ShoppingCart } from 'lucide-react';

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'pantry', 'other'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  protein: 'Proteins & Meat',
  dairy: 'Dairy',
  pantry: 'Pantry & Dry Goods',
  other: 'Other',
};

interface PantryItem {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string;
  checked: boolean;
}

interface Props {
  menuId: string;
  token: string;
  items: PantryItem[];
  alreadySubmitted: boolean;
}

export function PantryChecklist({ menuId, token, items, alreadySubmitted }: Props) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.checked).map((i) => i.id))
  );
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleItem(id: string) {
    if (submitted) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setError('');
    setSubmitting(true);

    const res = await fetch(`/api/client/pantry/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkedItemIds: Array.from(checked) }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Pantry list submitted!</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Your chef will skip the items you already have. Thank you!
        </p>
      </div>
    );
  }

  const checkedCount = checked.size;

  return (
    <div>
      {checkedCount > 0 && (
        <div className="bg-background border border-border rounded-xl p-3 mb-5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{checkedCount}</span>
          {' '}item{checkedCount !== 1 ? 's' : ''} marked as already in your pantry
        </div>
      )}

      <div className="space-y-4">
        {CATEGORY_ORDER.map((cat) => {
          const catItems = items.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;
          return (
            <div key={cat} className="bg-background border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/60 px-4 py-2 border-b border-border">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {catItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className={`text-sm flex-1 ${checked.has(item.id) ? 'line-through text-muted-foreground' : ''}`}>
                      {[item.quantity, item.unit, item.name].filter(Boolean).join(' ')}
                    </span>
                    {checked.has(item.id) && (
                      <span className="text-xs text-green-600 font-medium shrink-0">Have it</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      <div className="mt-8">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-foreground text-background font-medium rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          <ShoppingCart className="h-4 w-4" />
          {submitting ? 'Submitting…' : 'Submit Pantry List'}
        </button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Your chef will only shop for items not checked off
        </p>
      </div>
    </div>
  );
}
