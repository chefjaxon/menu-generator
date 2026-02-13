'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronDown, ChevronUp, ClipboardPaste } from 'lucide-react';
import { CUISINE_TYPES, COMMON_EXCLUSIONS } from '@/lib/types';
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

// ── Notion Paste Parser ──────────────────────────────────────────────────────

const CUISINE_ALIASES: Record<string, string> = {
  mediterranean: 'mediterranean',
  'middle eastern': 'mediterranean',
  japanese: 'asian',
  chinese: 'asian',
  korean: 'asian',
  thai: 'asian',
  vietnamese: 'asian',
  asian: 'asian',
  mexican: 'mexican',
  'tex-mex': 'mexican',
  italian: 'italian',
  american: 'american',
  indian: 'indian',
};

function parseNotionPaste(text: string, availableProteins: string[]): {
  restrictions: string[];
  cuisineWeights: Record<string, number>;
  menuComposition: MenuComposition[];
  proteins: string[];
  notes: string;
} {
  const lines = text.split('\n').map((l) => l.trim());
  const restrictions: string[] = [];
  const cuisineWeights: Record<string, number> = {};
  const menuComposition: MenuComposition[] = [];
  const proteins: string[] = [];
  const noteLines: string[] = [];

  // Find section boundaries
  type Section = 'none' | 'restrictions' | 'adjustments' | 'preferences' | 'balance' | 'cooking' | 'history';
  let currentSection: Section = 'none';

  for (const line of lines) {
    const upper = line.toUpperCase();

    // Detect sections
    if (upper.includes('HARD RESTRICTIONS')) { currentSection = 'restrictions'; continue; }
    if (upper.includes('ADJUSTMENTS')) { currentSection = 'adjustments'; continue; }
    if (upper.includes('PREFERENCES') || upper.includes('LIKES')) { currentSection = 'preferences'; continue; }
    if (upper.includes('WEEKLY MENU BALANCE') || upper.includes('MENU BALANCE')) { currentSection = 'balance'; continue; }
    if (upper.includes('COOKING NOTES')) { currentSection = 'cooking'; continue; }
    if (upper.includes('HISTORY') || upper.includes('FEEDBACK')) { currentSection = 'history'; continue; }
    if (upper.includes('CLIENT OVERVIEW') || upper.includes('SERVICE NOTES')) { currentSection = 'none'; continue; }

    // Skip empty lines and contact info
    const cleaned = line.replace(/^\*\s*/, '').trim();
    if (!cleaned) continue;

    // Skip contact info lines
    if (/^(address|best contact|phone|email|household|1st service|service date)/i.test(cleaned)) continue;

    switch (currentSection) {
      case 'restrictions': {
        // "No beef" → "beef", "No added sugar" → "added sugar", "50% salt" → "50% salt"
        let restriction = cleaned.replace(/^no\s+/i, '').toLowerCase();
        if (restriction) restrictions.push(restriction);
        break;
      }

      case 'adjustments': {
        // Add adjustments as notes if non-empty
        if (cleaned) noteLines.push(`Adjustment: ${cleaned}`);
        break;
      }

      case 'preferences': {
        const lower = cleaned.toLowerCase();
        // Check if this matches a known cuisine
        let matchedCuisine = false;
        for (const [alias, cuisine] of Object.entries(CUISINE_ALIASES)) {
          if (lower.includes(alias)) {
            cuisineWeights[cuisine] = 5; // Favorite
            matchedCuisine = true;
            break;
          }
        }
        // If not a cuisine match, add as a note
        if (!matchedCuisine) {
          noteLines.push(cleaned);
        }
        break;
      }

      case 'balance': {
        // Parse lines like "2 venison", "2 fish (only salmon, cod, trout, and 1 shrimp)"
        const balanceMatch = cleaned.match(/^(\d+)\s+(.+)/);
        if (balanceMatch) {
          const count = parseInt(balanceMatch[1], 10);
          let proteinText = balanceMatch[2].toLowerCase();

          // Check for parenthetical constraints
          const parenMatch = proteinText.match(/^(.+?)\s*\((.+)\)/);
          if (parenMatch) {
            proteinText = parenMatch[1].trim();
            const constraint = parenMatch[2].trim();
            noteLines.push(`${formatLabel(proteinText)} note: ${constraint}`);
          }

          // "fish" is a generic term — check for specific fish proteins
          if (proteinText === 'fish') {
            // Look for specific fish in the constraint or just use "fish" as a note
            // The actual proteins should be set from the parenthetical
            // For now, add as a composition entry — user can adjust
            const fishProteins = availableProteins.filter((p) =>
              ['salmon', 'cod', 'trout', 'halibut', 'seabass', 'tilapia', 'mahi'].includes(p)
            );
            if (fishProteins.length > 0) {
              // Distribute count among available fish proteins — just mark 'fish' note
              noteLines.push(`Fish balance: ${count} fish meals total`);
              // Add each available fish protein to the protein list
              for (const fp of fishProteins) {
                if (!proteins.includes(fp)) proteins.push(fp);
              }
            }
          } else {
            // Check for sub-items like "at least 1 tofu, 1 bean/chickpea"
            const subItems = proteinText.split(',').map((s) => s.trim());
            let addedSub = false;

            for (const sub of subItems) {
              const subMatch = sub.match(/(?:at\s+least\s+)?(\d+)\s+(.+)/);
              if (subMatch) {
                const subCount = parseInt(subMatch[1], 10);
                const subProtein = subMatch[2].replace(/[()]/g, '').trim();
                // Check if this is a known protein
                const matchedProtein = availableProteins.find((p) => subProtein.includes(p));
                if (matchedProtein) {
                  menuComposition.push({ category: matchedProtein, count: subCount });
                  if (!proteins.includes(matchedProtein)) proteins.push(matchedProtein);
                  addedSub = true;
                } else {
                  noteLines.push(`${formatLabel(proteinText)}: ${sub}`);
                }
              }
            }

            if (!addedSub) {
              // Simple case: "2 venison"
              const matchedProtein = availableProteins.find((p) => proteinText.includes(p));
              if (matchedProtein) {
                menuComposition.push({ category: matchedProtein, count });
                if (!proteins.includes(matchedProtein)) proteins.push(matchedProtein);
              } else {
                // Protein not in DB — add as note
                noteLines.push(`Menu balance: ${count} ${proteinText} (protein not in system)`);
              }
            }
          }
        }
        break;
      }

      case 'cooking': {
        if (cleaned.toLowerCase() !== 'other notes:') {
          noteLines.push(cleaned);
        }
        break;
      }

      // Ignore history/feedback and other sections
      default:
        break;
    }
  }

  return {
    restrictions,
    cuisineWeights,
    menuComposition,
    proteins,
    notes: noteLines.filter(Boolean).join('\n'),
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [restrictionInput, setRestrictionInput] = useState('');
  const [availableProteins, setAvailableProteins] = useState<string[]>([]);

  // Notion paste state
  const [showImport, setShowImport] = useState(false);
  const [notionText, setNotionText] = useState('');
  const [parseMessage, setParseMessage] = useState('');

  // Fetch available proteins from API
  useEffect(() => {
    fetch('/api/proteins')
      .then((res) => res.json())
      .then((data) => setAvailableProteins(data))
      .catch(() => {});
  }, []);

  const defaultCuisinePrefs: CuisinePrefField[] = CUISINE_TYPES.map((c) => {
    const existing = client?.cuisinePreferences.find((p) => p.cuisineType === c);
    return { cuisineType: c, weight: existing?.weight || 3 };
  });

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

      let newComposition = [...prev.menuComposition];
      if (newProteins.includes(protein) && !prev.proteins.includes(protein)) {
        if (!newComposition.find((c) => c.category === protein)) {
          newComposition.push({ category: protein, count: 0 });
        }
      } else if (!newProteins.includes(protein)) {
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

  // ── Notion Parse Handler ─────────────────────────────────────────────────

  function handleParsePaste() {
    if (!notionText.trim()) return;

    const parsed = parseNotionPaste(notionText, availableProteins);

    setForm((prev) => {
      // Merge restrictions (avoid duplicates)
      const allRestrictions = [...new Set([...prev.restrictions, ...parsed.restrictions])];

      // Merge proteins (avoid duplicates)
      const allProteins = [...new Set([...prev.proteins, ...parsed.proteins])];

      // Update cuisine weights
      const newCuisinePrefs = prev.cuisinePreferences.map((cp) => {
        if (parsed.cuisineWeights[cp.cuisineType]) {
          return { ...cp, weight: parsed.cuisineWeights[cp.cuisineType] };
        }
        return cp;
      });

      // Merge composition (add new, keep existing)
      const newComposition = [...prev.menuComposition];
      for (const comp of parsed.menuComposition) {
        const existing = newComposition.find((c) => c.category === comp.category);
        if (existing) {
          existing.count = comp.count;
        } else {
          newComposition.push(comp);
        }
      }
      // Also add composition entries for proteins that don't have one yet
      for (const p of allProteins) {
        if (!newComposition.find((c) => c.category === p)) {
          newComposition.push({ category: p, count: 0 });
        }
      }

      // Merge notes
      const noteParts = [prev.notes, parsed.notes].filter(Boolean);
      const allNotes = noteParts.join('\n');

      return {
        ...prev,
        restrictions: allRestrictions,
        proteins: allProteins,
        cuisinePreferences: newCuisinePrefs,
        menuComposition: newComposition,
        notes: allNotes,
      };
    });

    setParseMessage('Parsed successfully! Review the form below and adjust as needed.');
    setNotionText('');
    setShowImport(false);
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

      {parseMessage && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          {parseMessage}
        </div>
      )}

      {/* Notion Import Section */}
      {!client && (
        <div className="border border-border rounded-md">
          <button
            type="button"
            onClick={() => { setShowImport(!showImport); setParseMessage(''); }}
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4" />
              Import from Notion
            </span>
            {showImport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showImport && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Copy a client profile from your Notion database and paste it below. The parser will extract restrictions, cuisine preferences, and menu balance.
              </p>
              <textarea
                value={notionText}
                onChange={(e) => setNotionText(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`CLIENT OVERVIEW\nAddress: ...\nHARD RESTRICTIONS (NEVER USE)\n* No beef\n* No dairy\nPREFERENCES / LIKES\n* Mediterranean\n* Japanese\nWEEKLY MENU BALANCE\n* 2 venison\n* 2 fish (only salmon, cod, trout)\n* 2 vegetarian`}
              />
              <button
                type="button"
                onClick={handleParsePaste}
                disabled={!notionText.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                Parse & Fill Form
              </button>
            </div>
          )}
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
          {availableProteins.map((p) => (
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
