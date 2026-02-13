'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Search } from 'lucide-react';
import { formatLabel } from '@/lib/utils';
import { CUISINE_TYPES, ITEM_TYPES } from '@/lib/types';
import type { Recipe } from '@/lib/types';

export function RecipeTable({ recipes: initialRecipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = initialRecipes.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (cuisineFilter && r.cuisineType !== cuisineFilter) return false;
    if (typeFilter && r.itemType !== typeFilter) return false;
    return true;
  });

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
    router.refresh();
    setDeleting(null);
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={cuisineFilter}
          onChange={(e) => setCuisineFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm"
        >
          <option value="">All Cuisines</option>
          {CUISINE_TYPES.map((c) => (
            <option key={c} value={c}>{formatLabel(c)}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm"
        >
          <option value="">All Types</option>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{formatLabel(t)}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {initialRecipes.length === 0
            ? 'No recipes yet. Add your first recipe to get started.'
            : 'No recipes match your filters.'}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Cuisine</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Proteins</th>
                <th className="text-left px-4 py-3 font-medium">Tags</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((recipe) => (
                <tr key={recipe.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <span className="font-medium">{recipe.name}</span>
                    {recipe.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{recipe.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-secondary rounded text-xs">{formatLabel(recipe.cuisineType)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-secondary rounded text-xs">{formatLabel(recipe.itemType)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {recipe.proteinSwaps.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        recipe.proteinSwaps.map((p) => (
                          <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{formatLabel(p)}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        recipe.tags.map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{formatLabel(t)}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/recipes/${recipe.id}`}
                        className="p-1.5 hover:bg-muted rounded"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(recipe.id, recipe.name)}
                        disabled={deleting === recipe.id}
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
