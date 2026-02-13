'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { PROTEINS, CUISINE_TYPES, COMMON_EXCLUSIONS } from '@/lib/types';
import { formatLabel } from '@/lib/utils';
import type { Client, MenuComposition } from '@/lib/types';

interface CuisinePrefField {
  cuisineType: string;
  weight: number;
}

interface FormData {
  name: string;
  notes: string;
  proteins: string[];
  restrictions: string[];
  cuisinePreferences: CuisinePrefField[];
  menuComposition: MenuComposition[];
}

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [restrictionInput, setRestrictionInput] = useState('');

  const defaultCuisinePrefs: CuisinePrefField[] = CUISINE_TYPES.map((c) => {
    const existing = client?.cuisinePreferences.find((p) => p.cuisineType === c);
    return { cuisineType: c, weight: existing?.weight || 3 };
  });

  // Build default composition from existing client or empty
  const defaultComposition: MenuComposition[] = client?.menuComposition.length
    ? client.menuComposition
    : [];

  const [form, setForm] = useState<FormData>({
    name: client?.name || '',
    notes: client?.notes || '',
    proteins: client?.proteins || [],
    restrictions: client?.restrictions || [],
    cuisinePreferences: defaultCuisinePrefs,
    menuComposition: defaultComposition,
  });

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleProtein(protein: string) {
    setForm((prev) => {
      const newProteins = prev.proteins.includes(protein)
        ? prev.proteins.filter((v) => v !== protein)
        : [...prev.proteins, protein];

      // Update composition: add entry for new proteins, remove for deselected
      let newComposition = [...prev.menuComposition];
      if (newProteins.includes(protein) && !prev.proteins.includes(protein)) {
        // Protein added — add composition entry if not present
        if (!newComposition.find((c) => c.category === protein)) {
          newComposition.push({ category: protein, count: 0 });
        }
      } else if (!newProteins.includes(protein)) {
        // Protein removed — remove composition entry
        newComposition = newComposition.filter((c) => c.category !== protein);
      }

      return { ...prev, proteins: newProteins, menuComposition: newComposition };
    });
  }

  function addRestriction(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    if (form.restrictions.includes(trimmed)) return;
    updateField('restrictions', [...form.restrictions, trimmed]);
    setRestrictionInput('');
  }

  function removeRestriction(value: string) {
    updateField('restrictions', form.restrictions.filter((r) => r !== value));
  }

  function handleRestrictionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRestriction(restrictionInput);
    }
  }

  function updateCompositionCount(category: string, count: number) {
    setForm((prev) => {
      const existing = prev.menuComposition.find((c) => c.category === category);
      if (existing) {
        return {
          ...prev,
          menuComposition: prev.menuComposition.map((c) =>
            c.category === category ? { ...c, count: Math.max(0, Math.min(10, count)) } : c
          ),
        };
      }
      return {
        ...prev,
        menuComposition: [...prev.menuComposition, { category, count: Math.max(0, Math.min(10, count)) }],
      };
    });
  }

  function getCompositionCount(category: string): number {
    return form.menuComposition.find((c) => c.category === category)?.count || 0;
  }

  const totalItems = form.menuComposition.reduce((sum, c) => sum + c.count, 0);

  function updateCuisineWeight(cuisineType: string, weight: number) {
    setForm((prev) => ({
      ...prev,
      cuisinePreferences: prev.cuisinePreferences.map((cp) =>
        cp.cuisineType === cuisineType ? { ...cp, weight } : cp
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (form.proteins.length === 0) {
      setError('Select at least one protein preference');
      setSaving(false);
      return;
    }

    if (totalItems === 0) {
      setError('Set at least one item in the menu composition');
      setSaving(false);
      return;
    }

    // Only send cuisine preferences with non-default weights
    const payload = {
      ...form,
      itemsPerMenu: totalItems,
      cuisinePreferences: form.cuisinePreferences.filter((cp) => cp.weight !== 3),
      menuComposition: form.menuComposition.filter((c) => c.count > 0),
    };

    try {
      const url = client ? `/api/clients/${client.id}` : '/api/clients';
      const method = client ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ? JSON.stringify(data.error) : 'Failed to save client');
        setSaving(false);
        return;
      }

      router.push('/clients');
      router.refresh();
    } catch {
      setError('Failed to save client');
      setSaving(false);
    }
  }

  const weightLabels: Record<number, string> = {
    1: 'Rarely',
    2: 'Sometimes',
    3: 'Neutral',
    4: 'Often',
    5: 'Favorite',
  };

  // Suggestions that aren't already added
  const availableSuggestions = COMMON_EXCLUSIONS.filter(
    (s) => !form.restrictions.includes(s)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Client Name *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. John Smith"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Any additional notes about this client"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Protein Preferences *</label>
        <p className="text-xs text-muted-foreground mb-2">Select all protein types this client eats.</p>
        <div className="flex flex-wrap gap-2">
          {PROTEINS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => toggleProtein(p)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                form.proteins.includes(p)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {formatLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Composition */}
      <div>
        <label className="block text-sm font-medium mb-2">Menu Composition *</label>
        <p className="text-xs text-muted-foreground mb-3">
          Set how many of each item type to include on each menu.
        </p>

        {form.proteins.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Meals by Protein</p>
            <div className="space-y-2">
              {form.proteins.map((protein) => (
                <div key={protein} className="flex items-center gap-3">
                  <span className="text-sm w-28">{formatLabel(protein)} meals</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateCompositionCount(protein, getCompositionCount(protein) - 1)}
                      className="w-8 h-8 rounded border border-border text-sm hover:bg-muted disabled:opacity-30"
                      disabled={getCompositionCount(protein) <= 0}
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {getCompositionCount(protein)}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCompositionCount(protein, getCompositionCount(protein) + 1)}
                      className="w-8 h-8 rounded border border-border text-sm hover:bg-muted disabled:opacity-30"
                      disabled={getCompositionCount(protein) >= 10}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Snacks</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm w-28">Sweet snacks</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateCompositionCount('sweet-snack', getCompositionCount('sweet-snack') - 1)}
                  className="w-8 h-8 rounded border border-border text-sm hover:bg-muted disabled:opacity-30"
                  disabled={getCompositionCount('sweet-snack') <= 0}
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-medium">
                  {getCompositionCount('sweet-snack')}
                </span>
                <button
                  type="button"
                  onClick={() => updateCompositionCount('sweet-snack', getCompositionCount('sweet-snack') + 1)}
                  className="w-8 h-8 rounded border border-border text-sm hover:bg-muted disabled:opacity-30"
                  disabled={getCompositionCount('sweet-snack') >= 10}
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm w-28">Savory snacks</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateCompositionCount('savory-snack', getCompositionCount('savory-snack') - 1)}
                  className="w-8 h-8 rounded border border-border text-sm hover:bg-muted disabled:opacity-30"
                  disabled={getCompositionCount('savory-snack') <= 0}
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-medium">
                  {getCompositionCount('savory-snack')}
                </span>
                <button
                  type="button"
                  onClick={() => updateCompositionCount('savory-snack', getCompositionCount('savory-snack') + 1)}
                  className="w-8 h-8 rounded border border-border text-sm hover:bg-muted disabled:opacity-30"
                  disabled={getCompositionCount('savory-snack') >= 10}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm font-medium px-3 py-2 bg-muted rounded-md">
          Total items per menu: <span className="text-primary">{totalItems}</span>
        </div>
      </div>

      {/* Exclusions / Restrictions */}
      <div>
        <label className="block text-sm font-medium mb-2">Food Exclusions</label>
        <p className="text-xs text-muted-foreground mb-2">
          Add any ingredients or food types this client cannot eat. Recipes containing these will be excluded.
        </p>

        {/* Current exclusions as chips */}
        {form.restrictions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {form.restrictions.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs"
              >
                {r}
                <button
                  type="button"
                  onClick={() => removeRestriction(r)}
                  className="hover:text-red-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text input */}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={restrictionInput}
            onChange={(e) => setRestrictionInput(e.target.value)}
            onKeyDown={handleRestrictionKeyDown}
            className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Type an exclusion and press Enter (e.g. beef, cilantro, dairy)"
          />
          <button
            type="button"
            onClick={() => addRestriction(restrictionInput)}
            disabled={!restrictionInput.trim()}
            className="px-3 py-2 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-30"
          >
            Add
          </button>
        </div>

        {/* Suggestions */}
        {availableSuggestions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Common exclusions:</p>
            <div className="flex flex-wrap gap-1">
              {availableSuggestions.slice(0, 20).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addRestriction(s)}
                  className="px-2 py-0.5 border border-dashed border-border rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Cuisine Preferences</label>
        <p className="text-xs text-muted-foreground mb-3">Rate how much of each cuisine type to include. Higher = more likely to appear on menus.</p>
        <div className="space-y-3">
          {form.cuisinePreferences.map((cp) => (
            <div key={cp.cuisineType} className="flex items-center gap-4">
              <span className="text-sm w-28">{formatLabel(cp.cuisineType)}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updateCuisineWeight(cp.cuisineType, w)}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      cp.weight === w
                        ? 'bg-primary text-primary-foreground'
                        : cp.weight > w
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{weightLabels[cp.weight]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : client ? 'Update Client' : 'Create Client'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/clients')}
          className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
