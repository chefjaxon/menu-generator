'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { CUISINE_TYPES, ITEM_TYPES, COMMON_EXCLUSIONS } from '@/lib/types';
import { formatLabel } from '@/lib/utils';
import type { Recipe, IngredientRole } from '@/lib/types';

const TAG_KEYWORD_MAP: Record<string, string[]> = {
  dairy: ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'whey', 'casein', 'lactose', 'ghee', 'sour cream', 'cream cheese', 'mozzarella', 'parmesan', 'cheddar', 'brie', 'ricotta', 'half-and-half', 'buttermilk'],
  gluten: ['flour', 'wheat', 'bread', 'pasta', 'breadcrumb', 'soy sauce', 'barley', 'rye', 'semolina', 'couscous', 'panko', 'crouton', 'tortilla', 'pita'],
  nuts: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'peanut', 'pine nut', 'macadamia', 'nut butter', 'tahini'],
  soy: ['tofu', 'edamame', 'miso', 'tempeh', 'soybean', 'tamari'],
  eggs: ['egg'],
  shellfish: ['shrimp', 'crab', 'lobster', 'clam', 'mussel', 'scallop', 'oyster', 'prawn'],
  beef: ['beef', 'steak', 'brisket', 'chuck', 'sirloin'],
  pork: ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard'],
  cilantro: ['cilantro'],
  mushrooms: ['mushroom', 'shiitake', 'portobello', 'cremini'],
  olives: ['olive'],
  eggplant: ['eggplant', 'aubergine'],
  spinach: ['spinach'],
  corn: ['corn'],
};

function detectTagsFromIngredients(ingredientNames: string[]): string[] {
  const detected = new Set<string>();
  for (const [tag, keywords] of Object.entries(TAG_KEYWORD_MAP)) {
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}s?\\b`, 'i');
      if (ingredientNames.some((name) => regex.test(name))) {
        detected.add(tag);
        break;
      }
    }
  }
  return Array.from(detected).sort();
}

interface SwapField {
  restriction: string;
  substituteIngredient: string;
  substituteQty: string;
  substituteUnit: string;
  priority: number;
}

interface IngredientField {
  name: string;
  quantity: string;
  unit: string;
  role: IngredientRole;
  swaps: SwapField[];
}

interface FormData {
  name: string;
  description: string;
  instructions: string;
  cuisineType: string;
  itemType: string;
  servingSize: number;
  recipeKeeperUrl: string;
  ingredients: IngredientField[];
  proteinSwaps: string[];
  tags: string[];
}

function emptyIngredient(): IngredientField {
  return { name: '', quantity: '', unit: '', role: 'core', swaps: [] };
}

export function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableProteins, setAvailableProteins] = useState<string[]>([]);
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  useEffect(() => {
    fetch('/api/proteins')
      .then((res) => res.json())
      .then((data) => setAvailableProteins(data))
      .catch(() => {});
  }, []);

  const [form, setForm] = useState<FormData>({
    name: recipe?.name ?? '',
    description: recipe?.description ?? '',
    instructions: recipe?.instructions ?? '',
    cuisineType: recipe?.cuisineType ?? 'american',
    itemType: recipe?.itemType ?? 'meal',
    servingSize: recipe?.servingSize ?? 1,
    recipeKeeperUrl: recipe?.recipeKeeperUrl ?? '',
    ingredients: recipe?.ingredients?.map((i) => ({
      name: i.name,
      quantity: i.quantity || '',
      unit: i.unit || '',
      role: (['optional', 'garnish'].includes(i.role) ? i.role : 'core') as IngredientRole,
      swaps: i.swaps?.map((s) => ({
        restriction: s.restriction,
        substituteIngredient: s.substituteIngredient,
        substituteQty: s.substituteQty ?? '',
        substituteUnit: s.substituteUnit ?? '',
        priority: s.priority ?? 0,
      })) ?? [],
    })) ?? [emptyIngredient()],
    proteinSwaps: recipe?.proteinSwaps ?? [],
    tags: recipe?.tags ?? [],
  });

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addIngredient() {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, emptyIngredient()],
    }));
  }

  function removeIngredient(index: number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  function updateIngredient(index: number, field: keyof Omit<IngredientField, 'swaps'>, value: string) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => {
        if (i !== index) return ing;
        const updated = { ...ing, [field]: value };
        // When switching to optional, clear swaps (swaps only make sense on core/garnish)
        if (field === 'role' && value === 'optional') updated.swaps = [];
        return updated;
      }),
    }));
  }

  function addSwap(ingIndex: number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === ingIndex
          ? { ...ing, swaps: [...ing.swaps, { restriction: '', substituteIngredient: '', substituteQty: '', substituteUnit: '', priority: 0 }] }
          : ing
      ),
    }));
  }

  function removeSwap(ingIndex: number, swapIndex: number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === ingIndex
          ? { ...ing, swaps: ing.swaps.filter((_, si) => si !== swapIndex) }
          : ing
      ),
    }));
  }

  function updateSwap(ingIndex: number, swapIndex: number, field: keyof SwapField, value: string | number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === ingIndex
          ? {
              ...ing,
              swaps: ing.swaps.map((s, si) =>
                si === swapIndex ? { ...s, [field]: value } : s
              ),
            }
          : ing
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

  function toggleTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag].sort(),
    }));
  }

  function removeTag(tag: string) {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }

  async function handleRecipeKeeperBlur() {
    const url = form.recipeKeeperUrl.trim();
    if (!url) return;

    try {
      new URL(url);
    } catch {
      return;
    }

    setScraping(true);
    setScrapeError('');

    try {
      const res = await fetch('/api/recipes/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setScrapeError(data.error ?? 'Could not fetch recipe data. You can fill in the fields manually.');
        return;
      }

      setForm((prev) => {
        const willPopulateIngredients =
          prev.ingredients.length === 1 &&
          prev.ingredients[0].name.trim() === '' &&
          data.ingredients?.length > 0;

        const newIngredients = willPopulateIngredients
          ? data.ingredients.map((ing: { name: string; quantity: string; unit: string }) => ({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              role: 'core' as IngredientRole,
              swaps: [],
            }))
          : prev.ingredients;

        const autoTags =
          prev.tags.length === 0 && willPopulateIngredients
            ? detectTagsFromIngredients(newIngredients.map((i: { name: string }) => i.name))
            : prev.tags;

        return {
          ...prev,
          name: prev.name.trim() === '' && data.name ? data.name : prev.name,
          description: prev.description.trim() === '' && data.description ? data.description : prev.description,
          instructions: prev.instructions.trim() === '' && data.instructions ? data.instructions : prev.instructions,
          servingSize: prev.servingSize === 1 && data.servingSize ? data.servingSize : prev.servingSize,
          cuisineType: prev.cuisineType === 'american' && data.cuisineType ? data.cuisineType : prev.cuisineType,
          proteinSwaps: prev.proteinSwaps.length === 0 && data.proteins?.length > 0 ? data.proteins : prev.proteinSwaps,
          ingredients: newIngredients,
          tags: autoTags,
        };
      });
    } catch {
      setScrapeError('Could not fetch recipe data. You can fill in the fields manually.');
    } finally {
      setScraping(false);
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
      ingredients: filteredIngredients.map((ing) => ({
        ...ing,
        swaps: ing.swaps
          .filter((s) => s.restriction.trim() && s.substituteIngredient.trim())
          .map((s) => ({
            restriction: s.restriction.trim(),
            substituteIngredient: s.substituteIngredient.trim(),
            substituteQty: s.substituteQty.trim() || null,
            substituteUnit: s.substituteUnit.trim() || null,
            priority: s.priority,
          })),
      })),
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
        <label className="block text-sm font-medium mb-1">Recipe Keeper Link</label>
        <div className="relative">
          <input
            type="url"
            value={form.recipeKeeperUrl}
            onChange={(e) => { updateField('recipeKeeperUrl', e.target.value); setScrapeError(''); }}
            onBlur={handleRecipeKeeperBlur}
            disabled={scraping}
            className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="https://recipekeeperonline.com/recipe/..."
          />
          {scraping && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
              Filling in fields...
            </span>
          )}
        </div>
        {scrapeError && (
          <p className="mt-1 text-xs text-amber-600">{scrapeError}</p>
        )}
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
          {availableProteins.map((p) => (
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

      <div>
        <label className="block text-sm font-medium mb-1">Contains Tags</label>
        <p className="text-xs text-muted-foreground mb-2">
          Tag any restricted ingredients this recipe contains. Used to automatically exclude the recipe for clients with those restrictions.
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMON_EXCLUSIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                form.tags.includes(tag)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        {/* Show any legacy tags not in the standard vocabulary */}
        {form.tags.filter((t) => !COMMON_EXCLUSIONS.includes(t)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs text-muted-foreground self-center">Other:</span>
            {form.tags
              .filter((t) => !COMMON_EXCLUSIONS.includes(t))
              .map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-amber-600 hover:text-amber-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
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
        <div className="space-y-3">
          {form.ingredients.map((ing, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2">
              {/* Ingredient row */}
              <div className="flex gap-2 items-center">
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
                <select
                  value={ing.role}
                  onChange={(e) => updateIngredient(i, 'role', e.target.value)}
                  title="Core = required. Optional = omit if restricted. Garnish = always on grocery list, omit only if restricted."
                  className="w-28 px-2 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
                >
                  <option value="core">Core</option>
                  <option value="optional">Optional</option>
                  <option value="garnish">Garnish</option>
                </select>
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

              {/* Swaps — shown for core and garnish ingredients */}
              {(ing.role === 'core' || ing.role === 'garnish') && (
                <div className="pl-2 space-y-2">
                  {ing.swaps.map((swap, si) => (
                    <div key={si} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">If restricted:</span>
                        <input
                          type="text"
                          value={swap.restriction}
                          onChange={(e) => updateSwap(i, si, 'restriction', e.target.value)}
                          placeholder="e.g. dairy"
                          className="w-28 px-2 py-1 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="text-xs text-muted-foreground">→</span>
                        <input
                          type="text"
                          value={swap.substituteIngredient}
                          onChange={(e) => updateSwap(i, si, 'substituteIngredient', e.target.value)}
                          placeholder="substitute ingredient"
                          className="flex-1 px-2 py-1 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          type="button"
                          onClick={() => removeSwap(i, si)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pl-20">
                        <input
                          type="text"
                          value={swap.substituteQty}
                          onChange={(e) => updateSwap(i, si, 'substituteQty', e.target.value)}
                          placeholder="Swap qty"
                          title="Leave blank to use original quantity"
                          className="w-20 px-2 py-1 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <input
                          type="text"
                          value={swap.substituteUnit}
                          onChange={(e) => updateSwap(i, si, 'substituteUnit', e.target.value)}
                          placeholder="Swap unit"
                          title="Leave blank to use original unit"
                          className="w-20 px-2 py-1 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="text-xs text-muted-foreground">Priority:</span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={swap.priority}
                          onChange={(e) => updateSwap(i, si, 'priority', parseInt(e.target.value) || 0)}
                          title="Higher priority wins when multiple swaps apply"
                          className="w-14 px-2 py-1 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addSwap(i)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add swap
                  </button>
                </div>
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
