'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, RefreshCw, Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatLabel } from '@/lib/utils';
import type { Client, Menu, GenerateResult, SwapSuggestion } from '@/lib/types';

interface Props {
  clients: Client[];
}

type Step = 'select' | 'generating' | 'review' | 'finalizing' | 'done';

export function MenuGenerator({ clients }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('select');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [omitNotes, setOmitNotes] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [weekLabel, setWeekLabel] = useState('');

  // Swap state
  const [swappingItemId, setSwappingItemId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  async function handleGenerate() {
    if (!selectedClientId) return;
    setStep('generating');
    setError('');

    try {
      const res = await fetch('/api/menus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to generate menu');
        setStep('select');
        return;
      }

      const result: GenerateResult = await res.json();
      setMenu(result.menu);
      setWarnings(result.warnings);
      setOmitNotes(result.omitNotes ?? {});
      setStep('review');
    } catch {
      setError('Failed to generate menu');
      setStep('select');
    }
  }

  async function handleRegenerate() {
    setSwappingItemId(null);
    setSuggestions([]);
    await handleGenerate();
  }

  async function handleSwapClick(menuItemId: string) {
    if (swappingItemId === menuItemId) {
      setSwappingItemId(null);
      setSuggestions([]);
      return;
    }

    setSwappingItemId(menuItemId);
    setLoadingSuggestions(true);

    try {
      const res = await fetch('/api/menus/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuId: menu!.id, menuItemId }),
      });

      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    }

    setLoadingSuggestions(false);
  }

  async function handleSwapSelect(suggestion: SwapSuggestion) {
    if (!menu || !swappingItemId) return;

    const selectedProtein = suggestion.availableProteins.length > 0
      ? suggestion.availableProteins[0]
      : null;

    try {
      await fetch('/api/menus/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId: menu.id,
          menuItemId: swappingItemId,
          newRecipeId: suggestion.recipe.id,
          selectedProtein,
        }),
      });

      // Refresh the menu data
      const res = await fetch(`/api/menus/${menu.id}`);
      const updatedMenu = await res.json();
      setMenu(updatedMenu);
      setSwappingItemId(null);
      setSuggestions([]);
    } catch {
      setError('Failed to swap dish');
    }
  }

  async function handleFinalize() {
    if (!menu) return;
    setStep('finalizing');

    try {
      const res = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId: menu.id,
          weekLabel: weekLabel || undefined,
        }),
      });

      if (!res.ok) {
        setError('Failed to finalize menu');
        setStep('review');
        return;
      }

      const finalizedMenu = await res.json();
      setMenu(finalizedMenu);
      setStep('done');
    } catch {
      setError('Failed to finalize menu');
      setStep('review');
    }
  }

  return (
    <div className="max-w-3xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Select Client */}
      {step === 'select' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Client</label>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No clients yet. <a href="/clients/new" className="underline">Add a client</a> first.
              </p>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="">Choose a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.itemsPerMenu} items)
                  </option>

                ))}
              </select>
            )}
          </div>

          {selectedClient && (
            <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
              <p><strong>Proteins:</strong> {selectedClient.proteins.map(formatLabel).join(', ')}</p>
              {selectedClient.menuComposition.length > 0 && (
                <p><strong>Composition:</strong> {selectedClient.menuComposition.filter(c => c.count > 0).map((c) => `${c.count} ${formatLabel(c.category)}`).join(', ')}</p>
              )}
              {selectedClient.restrictions.length > 0 && (
                <p><strong>Exclusions:</strong> {selectedClient.restrictions.join(', ')}</p>
              )}
              {selectedClient.cuisinePreferences.length > 0 && (
                <p><strong>Cuisine preferences:</strong> {selectedClient.cuisinePreferences.map((cp) => `${formatLabel(cp.cuisineType)} (${cp.weight}/5)`).join(', ')}</p>
              )}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!selectedClientId}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Generate Menu
          </button>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === 'generating' && (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Generating menu for {selectedClient?.name}...</p>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && menu && (
        <div className="space-y-4">
          {warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              {warnings.map((w, i) => (
                <p key={i} className="text-sm text-yellow-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Menu for {selectedClient?.name}
            </h2>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          </div>

          <div className="space-y-3">
            {menu.items.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{item.recipe?.name || 'Unknown Recipe'}</span>
                      {item.recipe?.itemType === 'savory-snack' && (
                        <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">Savory Snack</span>
                      )}
                      {item.recipe?.itemType === 'sweet-snack' && (
                        <span className="px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded text-xs">Sweet Snack</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {item.recipe?.cuisineType && (
                        <span className="px-2 py-0.5 bg-secondary rounded text-xs">{formatLabel(item.recipe.cuisineType)}</span>
                      )}
                      {item.selectedProtein && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{formatLabel(item.selectedProtein)}</span>
                      )}
                      {item.recipe?.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{formatLabel(t)}</span>
                      ))}
                    </div>
                    {item.recipe?.description && (
                      <p className="text-xs text-muted-foreground">{item.recipe.description}</p>
                    )}
                    {omitNotes[item.id]?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {omitNotes[item.id].map((note, ni) => (
                          <span key={ni} className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs">
                            {note}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleSwapClick(item.id)}
                    className={`ml-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      swappingItemId === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border hover:bg-muted'
                    }`}
                  >
                    {swappingItemId === item.id ? 'Cancel' : 'Swap'}
                  </button>
                </div>

                {/* Swap suggestions panel */}
                {swappingItemId === item.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {loadingSuggestions ? (
                      <p className="text-xs text-muted-foreground">Loading alternatives...</p>
                    ) : suggestions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No alternatives available.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Choose a replacement:</p>
                        {suggestions.map((s) => (
                          <button
                            key={s.recipe.id}
                            onClick={() => handleSwapSelect(s)}
                            className="w-full text-left p-2.5 border border-border rounded-md hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{s.recipe.name}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="px-1.5 py-0.5 bg-secondary rounded text-xs">{formatLabel(s.recipe.cuisineType)}</span>
                              {s.availableProteins.map((p) => (
                                <span key={p} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{formatLabel(p)}</span>
                              ))}
                              {s.omitNotes?.map((note, ni) => (
                                <span key={ni} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs">{note}</span>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Week Label (optional)</label>
              <input
                type="text"
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                placeholder={`e.g. ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                className="w-64 px-3 py-2 border border-border rounded-md text-sm"
              />
            </div>
            <button
              onClick={handleFinalize}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              <Check className="h-4 w-4" />
              Finalize Menu
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Finalizing */}
      {step === 'finalizing' && (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Saving menu...</p>
        </div>
      )}

      {/* Step 5: Done */}
      {step === 'done' && menu && (
        <div className="text-center py-12 space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold">Menu Finalized</h2>
          <p className="text-muted-foreground text-sm">
            Menu for {selectedClient?.name} has been saved.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push(`/menus/${menu.id}`)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              View Menu
            </button>
            <button
              onClick={() => {
                setStep('select');
                setMenu(null);
                setWarnings([]);
                setOmitNotes({});
                setWeekLabel('');
                setSelectedClientId('');
              }}
              className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
