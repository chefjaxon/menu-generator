'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, CheckCircle2, Circle, ChefHat, Home } from 'lucide-react';
import type { Menu, MenuItem, Recipe, IngredientSwapCallout } from '@/lib/types';
import { formatLabel } from '@/lib/utils';

interface SelectionState {
  selected: boolean;
  note: string;
}

interface Props {
  menu: Menu;
  token: string;
}

export function ClientMenuSelector({ menu, token }: Props) {
  const [selections, setSelections] = useState<Record<string, SelectionState>>(
    () => Object.fromEntries(
      menu.items.map((item) => [
        item.id,
        { selected: item.clientSelected, note: item.clientNote ?? '' },
      ])
    )
  );
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedCount = Object.values(selections).filter((s) => s.selected).length;

  function toggleItem(itemId: string) {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId].selected },
    }));
  }

  function setNote(itemId: string, note: string) {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], note },
    }));
  }

  async function handleSubmit() {
    if (selectedCount === 0) {
      setError('Please select at least one meal.');
      return;
    }
    setError('');
    setSubmitting(true);

    const selectedItems = Object.entries(selections)
      .filter(([, s]) => s.selected)
      .map(([menuItemId, s]) => ({ menuItemId, note: s.note || undefined }));

    const res = await fetch(`/api/client/menu/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections: selectedItems }),
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
        <h2 className="text-xl font-semibold mb-2">Selections received!</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Your chef has been notified and will finalize your menu shortly.
        </p>
        <Link
          href="/client"
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-foreground text-background text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    );
  }

  const meals = menu.items.filter((i) => i.recipe?.itemType === 'meal');
  const savorySnacks = menu.items.filter((i) => i.recipe?.itemType === 'savory-snack');
  const sweetSnacks = menu.items.filter((i) => i.recipe?.itemType === 'sweet-snack');

  return (
    <div>
      <div className="bg-background border border-border rounded-xl p-4 mb-6 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{selectedCount} selected</span>
          {' '}— Choose the meals you&apos;d like for this week. You can add a note to any selection.
        </p>
      </div>

      <div className="space-y-6">
        {meals.length > 0 && (
          <ItemGroup
            title="Meals"
            icon={<ChefHat className="h-4 w-4" />}
            items={meals}
            selections={selections}
            onToggle={toggleItem}
            onNote={setNote}
          />
        )}
        {savorySnacks.length > 0 && (
          <ItemGroup
            title="Savory Snacks"
            icon={<ChefHat className="h-4 w-4" />}
            items={savorySnacks}
            selections={selections}
            onToggle={toggleItem}
            onNote={setNote}
          />
        )}
        {sweetSnacks.length > 0 && (
          <ItemGroup
            title="Sweet Treats"
            icon={<ChefHat className="h-4 w-4" />}
            items={sweetSnacks}
            selections={selections}
            onToggle={toggleItem}
            onNote={setNote}
          />
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      <div className="mt-8">
        <button
          onClick={handleSubmit}
          disabled={submitting || selectedCount === 0}
          className="w-full py-3 bg-foreground text-background font-medium rounded-xl hover:opacity-90 disabled:opacity-50 text-sm"
        >
          {submitting ? 'Submitting…' : `Submit ${selectedCount} Selection${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

function ItemGroup({
  title,
  icon,
  items,
  selections,
  onToggle,
  onNote,
}: {
  title: string;
  icon: React.ReactNode;
  items: MenuItem[];
  selections: Record<string, SelectionState>;
  onToggle: (id: string) => void;
  onNote: (id: string, note: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
        {icon}
        {title}
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <RecipeCard
            key={item.id}
            item={item}
            recipe={item.recipe!}
            state={selections[item.id]}
            onToggle={() => onToggle(item.id)}
            onNote={(note) => onNote(item.id, note)}
          />
        ))}
      </div>
    </div>
  );
}

function RecipeCard({
  item,
  recipe,
  state,
  onToggle,
  onNote,
}: {
  item: MenuItem;
  recipe: Recipe;
  state: SelectionState;
  onToggle: () => void;
  onNote: (note: string) => void;
}) {
  return (
    <div
      className={`border rounded-xl p-4 transition-colors cursor-pointer ${
        state.selected
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-background hover:border-primary/20'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {state.selected ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm">{recipe.name}</h3>
            {recipe.recipeKeeperUrl && (
              <a
                href={recipe.recipeKeeperUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-3 w-3" />
                View recipe
              </a>
            )}
          </div>
          {recipe.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {recipe.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
              {formatLabel(recipe.cuisineType)}
            </span>
            {item.selectedProtein && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                {formatLabel(item.selectedProtein)}
              </span>
            )}
          </div>
          {item.applicableSwaps && item.applicableSwaps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.applicableSwaps.map((swap: IngredientSwapCallout, i: number) => (
                <span
                  key={i}
                  className="text-xs px-1.5 py-0.5 bg-muted/60 text-muted-foreground rounded border border-border/60"
                >
                  {swap.original} &rarr; {swap.substitute}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {state.selected && (
        <div className="mt-3 ml-8" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={state.note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Any notes for the chef? (optional)"
            className="w-full text-sm px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary/50"
          />
        </div>
      )}
    </div>
  );
}
