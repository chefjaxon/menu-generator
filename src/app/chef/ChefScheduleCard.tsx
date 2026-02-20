'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ChefGroceryView } from './grocery/[menuId]/ChefGroceryView';

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'pantry', 'other'] as const;

interface GroceryItem {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  category: string;
  notes: string | null;
}

interface MenuItem {
  id: string;
  clientNote: string | null;
  omitNotes: string | null;
  recipe: { name: string } | null;
}

interface Schedule {
  id: string;
  scheduledDate: Date;
  scheduledTime: string;
  notes: string | null;
  client: {
    id: string;
    name: string;
    chefNotes: string | null;
    servingsPerDish: number | null;
    dishCount: number | null;
    proteins: { protein: string }[];
    restrictions: { restriction: string }[];
    cuisinePreferences: { cuisineType: string; weight: number }[];
  };
  menu: {
    id: string;
    weekLabel: string | null;
    groceryApproved: boolean;
    publishedAt: Date | null;
    pantrySubmitted: boolean;
    groceryItems: GroceryItem[];
    items: MenuItem[];
  } | null;
}

interface Props {
  schedule: Schedule;
  formattedDate: string;
  formattedTime: string;
}

type Tab = 'recipes' | 'client' | 'grocery';

export function ChefScheduleCard({ schedule, formattedDate, formattedTime }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('recipes');

  const menu = schedule.menu;
  const menuReady = menu && menu.groceryApproved && menu.publishedAt;
  const client = schedule.client;

  const groceryByCategory = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = (menu?.groceryItems ?? []).filter((i) => i.category === cat);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Card header — always visible */}
      <button
        onClick={() => menuReady && setOpen((o) => !o)}
        className={`w-full flex items-start justify-between p-4 text-left ${menuReady ? 'hover:bg-muted/30 transition-colors' : ''}`}
      >
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            {formattedDate} · {formattedTime}
          </p>
          <p className="font-medium text-sm">{client.name}</p>
          {menu && !menuReady && (
            <p className="text-xs text-amber-600 mt-1">Menu in progress</p>
          )}
          {!menu && (
            <p className="text-xs text-muted-foreground mt-1">Menu not yet available</p>
          )}
        </div>
        {menuReady && (
          <span className="text-muted-foreground mt-0.5 shrink-0">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {open && menuReady && (
        <div className="border-t border-border">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            {(['recipes', 'client', 'grocery'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-foreground text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'recipes' ? 'Recipes' : tab === 'client' ? 'Client Info' : 'Grocery List'}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {/* Recipes tab */}
            {activeTab === 'recipes' && (
              <div>
                {menu.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dishes selected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {menu.items.map((item) => (
                      <div key={item.id}>
                        <Link
                          href={`/chef/recipe/${item.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {item.recipe?.name ?? '—'}
                        </Link>
                        {item.clientNote && (
                          <span className="ml-2 text-xs text-green-700 italic">
                            &ldquo;{item.clientNote}&rdquo;
                          </span>
                        )}
                        {item.omitNotes && (JSON.parse(item.omitNotes) as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(JSON.parse(item.omitNotes) as string[]).map((note, i) => (
                              <span
                                key={i}
                                className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded"
                              >
                                {note}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Client info tab */}
            {activeTab === 'client' && (
              <div className="space-y-3">
                {client.chefNotes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Chef Notes</p>
                    <p className="text-sm text-amber-900 whitespace-pre-line">{client.chefNotes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Dishes per menu</p>
                    <p className="text-sm font-medium mt-0.5">{client.dishCount ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Servings per dish</p>
                    <p className="text-sm font-medium mt-0.5">{client.servingsPerDish ?? '—'}</p>
                  </div>
                </div>

                {client.restrictions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Dietary Restrictions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {client.restrictions.map((r) => (
                        <span
                          key={r.restriction}
                          className="px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded-full font-medium"
                        >
                          {r.restriction}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {client.proteins.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Preferred Proteins
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {client.proteins.map((p) => (
                        <span
                          key={p.protein}
                          className="px-2 py-0.5 bg-muted text-foreground text-xs rounded-full"
                        >
                          {p.protein}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {client.cuisinePreferences.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Cuisine Preferences
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {client.cuisinePreferences.map((c) => (
                        <span
                          key={c.cuisineType}
                          className="px-2 py-0.5 bg-muted text-foreground text-xs rounded-full"
                        >
                          {c.cuisineType}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Grocery list tab */}
            {activeTab === 'grocery' && (
              <div>
                {menu.pantrySubmitted && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-xs text-blue-700 font-medium">
                    Client submitted pantry list — checked items are already in their pantry
                  </div>
                )}
                <ChefGroceryView
                  menuId={menu.id}
                  groceryByCategory={groceryByCategory}
                  categoryOrder={[...CATEGORY_ORDER]}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
