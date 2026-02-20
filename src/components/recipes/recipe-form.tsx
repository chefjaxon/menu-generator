'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { CUISINE_TYPES, ITEM_TYPES, COMMON_EXCLUSIONS } from '@/lib/types';
import { formatLabel } from '@/lib/utils';
import type { Recipe, IngredientRole } from '@/lib/types';

interface SwapField {
  restriction: string;
  substituteIngredient: string;
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

// Common "contains" tag suggestions for recipes
const RECIPE_TAG_SUGGESTIONS = [
  'dairy', 'gluten', 'nuts', 'soy', 'eggs', 'beef', 'pork', 'shellfish',
  'cilantro', 'mushrooms', 'olives', 'eggplant', 'spinach', 'beets',
  'corn', 'cornstarch', 'white sugar', 'honey', 'processed ingredients',
  'white flour', 'white rice', 'fermented foods', 'coffee',
];

// Keywords that map ingredient text to contains tags
const TAG_KEYWORD_MAP: Record<string, string[]> = {
  dairy: ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'parmesan', 'mozzarella', 'cheddar', 'ricotta', 'brie', 'feta', 'gouda', 'half and half', 'half & half', 'sour cream', 'ghee', 'whey', 'lactose', 'dairy'],
  gluten: ['flour', 'bread', 'pasta', 'spaghetti', 'noodle', 'wheat', 'barley', 'rye', 'soy sauce', 'panko', 'breadcrumb', 'crouton', 'tortilla', 'pita', 'couscous', 'semolina', 'gluten'],
  nuts: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'peanut', 'nut butter', 'almond milk', 'tahini'],
  soy: ['soy', 'tofu', 'edamame', 'miso', 'tempeh', 'soy sauce', 'tamari', 'soybean'],
  eggs: ['egg', 'eggs', 'yolk', 'egg white'],
  beef: ['beef', 'steak', 'ground beef', 'brisket', 'chuck', 'sirloin', 'ribeye', 'short rib', 'veal'],
  pork: ['pork', 'bacon', 'ham', 'pancetta', 'prosciutto', 'sausage', 'chorizo', 'salami', 'pepperoni', 'lard', 'pork chop', 'pulled pork', 'ribs'],
  shellfish: ['shrimp', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'prawn', 'crayfish', 'langoustine', 'shellfish'],
  cilantro: ['cilantro'],
  mushrooms: ['mushroom', 'portobello', 'shiitake', 'cremini', 'button mushroom', 'oyster mushroom'],
  olives: ['olive', 'kalamata', 'tapenade'],
  eggplant: ['eggplant', 'aubergine'],
  spinach: ['spinach'],
  beets: ['beet', 'beetroot'],
  corn: ['corn', 'maize', 'hominy', 'grits', 'polenta', 'corn tortilla', 'cornmeal'],
  cornstarch: ['cornstarch', 'corn starch', 'corn flour'],
  'white sugar': ['white sugar', 'granulated sugar', 'cane sugar', 'sugar'],
  honey: ['honey'],
  'white flour': ['white flour', 'all-purpose flour', 'all purpose flour', 'ap flour'],
  'white rice': ['white rice', 'jasmine rice', 'basmati rice'],
  'fermented foods': ['miso', 'kimchi', 'sauerkraut', 'kefir', 'kombucha', 'tempeh', 'vinegar', 'sourdough'],
  coffee: ['coffee', 'espresso', 'cold brew', 'instant coffee'],
};

function detectTagsFromIngredients(ingredients: IngredientField[]): string[] {
  const ingredientText = ingredients
    .map((i) => i.name.toLowerCase())
    .join(' | ');

  return Object.entries(TAG_KEYWORD_MAP)
    .filter(([, keywords]) => keywords.some((kw) => ingredientText.includes(kw)))
    .map(([tag]) => tag);
}

function emptyIngredient(): IngredientField {
  return { name: '', quantity: '', unit: '', role: 'core', swaps: [] };
}

export function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');
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
      role: (i.role === 'optional' ? 'optional' : 'core') as IngredientRole,
      swaps: i.swaps?.map((s) => ({
        restriction: s.restriction,
        substituteIngredient: s.substituteIngredient,
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
        // When switching to optional, clear swaps (swaps only make sense on core)
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
          ? { ...ing, swaps: [...ing.swaps, { restriction: '', substituteIngredient: '' }] }
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

  function updateSwap(ingIndex: number, swapIndex: number, field: keyof SwapField, value: string) {
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

      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() === '' && data.name ? data.name : prev.name,
        description: prev.description.trim() === '' && data.description ? data.description : prev.description,
        instructions: prev.instructions.trim() === '' && data.instructions ? data.instructions : prev.instructions,
        servingSize: prev.servingSize === 1 && data.servingSize ? data.servingSize : prev.servingSize,
        cuisineType: prev.cuisineType === 'american' && data.cuisineType ? data.cuisineType : prev.cuisineType,
        tags: prev.tags.length === 0
          ? (() => {
              const newIngredients =
                prev.ingredients.length === 1 &&
                prev.ingredients[0].name.trim() === '' &&
                data.ingredients?.length > 0
                  ? data.ingredients.map((ing: { name: string; quantity: string; unit: string }) => ({
                      name: ing.name,
                      quantity: ing.quantity,
                      unit: ing.unit,
                      role: 'core' as IngredientRole,
                      swaps: [],
                    }))
                  : prev.ingredients;
              return detectTagsFromIngredients(newIngredients);
            })()
          : prev.tags,
        proteinSwaps: prev.proteinSwaps.length === 0 && data.proteins?.length > 0 ? data.proteins : prev.proteinSwaps,
        ingredients:
          prev.ingredients.length === 1 &&
          prev.ingredients[0].name.trim() === '' &&
          data.ingredients?.length > 0
            ? data.ingredients.map((ing: { name: string; quantity: string; unit: string }) => ({
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                role: 'core' as IngredientRole,
                swaps: [],
              }))
            : prev.ingredients,
      }));
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
        swaps: ing.swaps.filter((s) => s.restriction.trim() && s.substituteIngredient.trim()),
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
                  title="Core = recipe fails without it. Optional = can be omitted."
                  className="w-28 px-2 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
                >
                  <option value="core">Core</option>
                  <option value="optional">Optional</option>
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

              {/* Swaps — only shown for core ingredients */}
              {ing.role === 'core' && (
                <div className="pl-2 space-y-1.5">
                  {ing.swaps.map((swap, si) => (
                    <div key={si} className="flex items-center gap-2">
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
