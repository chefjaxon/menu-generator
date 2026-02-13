'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { PROTEINS, CUISINE_TYPES, ITEM_TYPES, COMMON_EXCLUSIONS } from '@/lib/types';
import { formatLabel } from '@/lib/utils';
import type { Recipe } from '@/lib/types';

interface IngredientField {
  name: string;
  quantity: string;
  unit: string;
}

interface FormData {
  name: string;
  description: string;
  instructions: string;
  cuisineType: string;
  itemType: string;
  servingSize: number;
  ingredients: IngredientField[];
  proteinSwaps: string[];
  tags: string[];
}

// Common "contains" tag suggestions for recipes
const RECIPE_TAG_SUGGESTIONS = [
  'dairy', 'gluten', 'nuts', 'soy', 'eggs', 'beef', 'pork', 'shellfish',
  'cilantro', 'mushrooms', 'olives', 'eggplant', 'spinach', 'beets',
  'corn', 'cornstarch', 'white sugar', 'honey', 'processed ingredients',
  'white flour', 'white rice', 'fermented foods', 'coffee',
];

export function RecipeForm({ recipe, initialData }: { recipe?: Recipe; initialData?: Partial<FormData> | null }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');

  const [form, setForm] = useState<FormData>({
    name: initialData?.name ?? recipe?.name ?? '',
    description: initialData?.description ?? recipe?.description ?? '',
    instructions: initialData?.instructions ?? recipe?.instructions ?? '',
    cuisineType: initialData?.cuisineType ?? recipe?.cuisineType ?? 'american',
    itemType: initialData?.itemType ?? recipe?.itemType ?? 'meal',
    servingSize: initialData?.servingSize ?? recipe?.servingSize ?? 1,
    ingredients: initialData?.ingredients ?? recipe?.ingredients?.map((i) => ({
      name: i.name,
      quantity: i.quantity || '',
      unit: i.unit || '',
    })) ?? [{ name: '', quantity: '', unit: '' }],
    proteinSwaps: initialData?.proteinSwaps ?? recipe?.proteinSwaps ?? [],
    tags: initialData?.tags ?? recipe?.tags ?? [],
  });

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addIngredient() {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', quantity: '', unit: '' }],
    }));
  }

  function removeIngredient(index: number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  function updateIngredient(index: number, field: keyof IngredientField, value: string) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }));
  }

  function toggleArrayItem(key: 'proteinSwaps', value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  }

  function addTag(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    if (form.tags.includes(trimmed)) return;
    updateField('tags', [...form.tags, trimmed]);
    setTagInput('');
  }

  function removeTag(value: string) {
    updateField('tags', form.tags.filter((t) => t !== value));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const filteredIngredients = form.ingredients.filter((i) => i.name.trim());
    if (filteredIngredients.length === 0) {
      setError('Add at least one ingredient');
      setSaving(false);
      return;
    }

    const payload = {
      ...form,
      ingredients: filteredIngredients,
    };

    try {
      const url = recipe ? `/api/recipes/${recipe.id}` : '/api/recipes';
      const method = recipe ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ? JSON.stringify(data.error) : 'Failed to save recipe');
        setSaving(false);
        return;
      }

      router.push('/recipes');
      router.refresh();
    } catch {
      setError('Failed to save recipe');
      setSaving(false);
    }
  }

  const availableTagSuggestions = RECIPE_TAG_SUGGESTIONS.filter(
    (s) => !form.tags.includes(s)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Dish Name *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. Grilled Chicken with Roasted Vegetables"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Brief description of the dish"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Instructions</label>
        <textarea
          value={form.instructions}
          onChange={(e) => updateField('instructions', e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Step-by-step preparation instructions"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Cuisine Type *</label>
          <select
            value={form.cuisineType}
            onChange={(e) => updateField('cuisineType', e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CUISINE_TYPES.map((c) => (
              <option key={c} value={c}>{formatLabel(c)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Type *</label>
          <select
            value={form.itemType}
            onChange={(e) => updateField('itemType', e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{formatLabel(t)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Serving Size *</label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.servingSize}
            onChange={(e) => updateField('servingSize', parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Protein Options</label>
        <p className="text-xs text-muted-foreground mb-2">Select all proteins this dish can be prepared with. Leave empty for protein-free dishes (salads, sides, etc).</p>
        <div className="flex flex-wrap gap-2">
          {PROTEINS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => toggleArrayItem('proteinSwaps', p)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                form.proteinSwaps.includes(p)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {formatLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Contains tags (free-text) */}
      <div>
        <label className="block text-sm font-medium mb-2">Contains</label>
        <p className="text-xs text-muted-foreground mb-2">
          Tag what this recipe contains. Clients who exclude these items will not receive this recipe.
        </p>

        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {form.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="hover:text-orange-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Type a tag and press Enter (e.g. dairy, gluten, beef)"
          />
          <button
            type="button"
            onClick={() => addTag(tagInput)}
            disabled={!tagInput.trim()}
            className="px-3 py-2 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-30"
          >
            Add
          </button>
        </div>

        {availableTagSuggestions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Suggestions:</p>
            <div className="flex flex-wrap gap-1">
              {availableTagSuggestions.slice(0, 16).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
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
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Ingredients *</label>
          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        <div className="space-y-2">
          {form.ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                placeholder="Ingredient name"
                className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                value={ing.quantity}
                onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                placeholder="Qty"
                className="w-20 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                value={ing.unit}
                onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                placeholder="Unit"
                className="w-20 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {form.ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
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
          {saving ? 'Saving...' : recipe ? 'Update Recipe' : 'Create Recipe'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/recipes')}
          className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
