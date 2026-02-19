'use client';

import type { MenuItem } from '@/lib/types';
import { formatLabel } from '@/lib/utils';

interface Props {
  menuItems: MenuItem[];
  onToggle: (menuItemId: string, selected: boolean) => void;
}

export function ClientSelectionSection({ menuItems, onToggle }: Props) {
  const selectedCount = menuItems.filter((i) => i.clientSelected).length;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Client Selections</h2>
        <span className="text-sm text-muted-foreground">
          {selectedCount} of {menuItems.length} selected
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Check the items the client actually selected from their menu.
      </p>
      <div className="border border-border rounded-lg divide-y divide-border">
        {menuItems.map((item) => {
          const recipe = item.recipe;
          return (
            <label
              key={item.id}
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={item.clientSelected}
                onChange={(e) => onToggle(item.id, e.target.checked)}
                className="h-4 w-4 rounded border-border text-foreground"
              />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">
                  {recipe?.name ?? item.recipeId}
                </span>
                {recipe && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                      {formatLabel(recipe.itemType)}
                    </span>
                    {item.selectedProtein && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                        {formatLabel(item.selectedProtein)}
                      </span>
                    )}
                    {recipe.cuisineType && (
                      <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                        {formatLabel(recipe.cuisineType)}
                      </span>
                    )}
                  </div>
                )}
                {item.omitNotes && item.omitNotes.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {item.omitNotes.map((note, i) => (
                      <li key={i} className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded inline-block mr-1">
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
                {item.clientNote && (
                  <p className="mt-1 text-xs text-blue-700 italic">
                    Client note: {item.clientNote}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
