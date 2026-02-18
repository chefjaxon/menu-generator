'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Pencil } from 'lucide-react';

interface IngredientCluster {
  canonical: string;
  variants: string[];
}

interface ClusterState {
  canonical: string;
  variants: string[];
  confirmed: boolean;
  skipped: boolean;
  editing: boolean;
}

export default function IngredientImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ingredientCount, setIngredientCount] = useState<number | null>(null);
  const [clusters, setClusters] = useState<ClusterState[]>([]);
  const [error, setError] = useState('');
  const [saveResult, setSaveResult] = useState<{ added: number; skipped: number; message: string } | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setClusters([]);
    setIngredientCount(null);
    setError('');
    setSaveResult(null);
  }

  async function handleParse() {
    if (!file) return;
    setParsing(true);
    setError('');
    setClusters([]);
    setSaveResult(null);

    try {
      const formData = new FormData();
      formData.append('html', file);

      const res = await fetch('/api/admin/parse-recipe-keeper', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Unknown error during parsing.');
        return;
      }

      setIngredientCount(data.ingredientCount);
      const initialStates: ClusterState[] = (data.clusters as IngredientCluster[]).map((c) => ({
        canonical: c.canonical,
        variants: c.variants,
        confirmed: false,
        skipped: false,
        editing: false,
      }));
      setClusters(initialStates);

      // Auto-expand all clusters initially
      setExpandedIdx(new Set(initialStates.map((_, i) => i)));
    } catch {
      setError('Failed to contact the server. Please try again.');
    } finally {
      setParsing(false);
    }
  }

  function updateCluster(idx: number, updates: Partial<ClusterState>) {
    setClusters((prev) => prev.map((c, i) => (i === idx ? { ...c, ...updates } : c)));
  }

  function removeVariant(clusterIdx: number, variantIdx: number) {
    setClusters((prev) =>
      prev.map((c, i) => {
        if (i !== clusterIdx) return c;
        const newVariants = c.variants.filter((_, vi) => vi !== variantIdx);
        return { ...c, variants: newVariants };
      })
    );
  }

  function toggleExpanded(idx: number) {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function confirmAll() {
    setClusters((prev) =>
      prev.map((c) => (c.skipped || c.variants.length < 2 ? c : { ...c, confirmed: true }))
    );
  }

  async function handleSave() {
    const toSave = clusters.filter((c) => c.confirmed && !c.skipped && c.variants.length >= 2);
    if (toSave.length === 0) {
      setError('No confirmed clusters to save. Confirm at least one group first.');
      return;
    }

    setSaving(true);
    setError('');
    setSaveResult(null);

    try {
      const res = await fetch('/api/admin/save-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: toSave.map((c) => ({ canonical: c.canonical, variants: c.variants })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save aliases.');
        return;
      }

      setSaveResult(data);
      // Mark saved clusters as confirmed+saved
      setClusters((prev) =>
        prev.map((c) => (c.confirmed && !c.skipped ? { ...c, confirmed: true } : c))
      );
    } catch {
      setError('Failed to contact the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const confirmedCount = clusters.filter((c) => c.confirmed && !c.skipped).length;
  const pendingCount = clusters.filter((c) => !c.confirmed && !c.skipped).length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Ingredient Alias Import</h1>
        <p className="text-sm text-muted-foreground">
          Upload your Recipe Keeper HTML export to automatically discover ingredient name variants
          and add them to the consolidation alias table.
        </p>
      </div>

      {/* Upload section */}
      <div className="border border-border rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold mb-3">Step 1 — Upload Recipe Keeper export</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Export your recipes from Recipe Keeper as HTML (File → Export → HTML), then upload the
          exported <code className="bg-muted px-1 rounded text-xs">.html</code> file below.
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded text-sm hover:bg-muted transition-colors"
          >
            <Upload className="h-4 w-4" />
            {file ? file.name : 'Choose HTML file'}
          </button>
          {file && (
            <button
              onClick={handleParse}
              disabled={parsing}
              className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {parsing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analysing with Claude...</>
              ) : (
                'Parse & Analyse'
              )}
            </button>
          )}
        </div>
        {ingredientCount !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Found <strong>{ingredientCount}</strong> unique ingredient names in the export.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm flex items-start gap-2">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Save result */}
      {saveResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{saveResult.message}</span>
        </div>
      )}

      {/* Clusters review */}
      {clusters.length > 0 && (
        <>
          <div className="mb-4">
            <h2 className="text-base font-semibold mb-1">
              Step 2 — Review proposed groupings ({clusters.length})
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Claude has proposed these ingredient groups. Review each one — edit the canonical name,
              remove any incorrectly grouped variants, then confirm or skip.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={confirmAll}
                className="px-3 py-1.5 text-sm font-medium bg-foreground text-background rounded hover:opacity-90"
              >
                Confirm All Pending ({pendingCount})
              </button>
              <span className="text-xs text-muted-foreground">
                {confirmedCount} confirmed · {clusters.filter((c) => c.skipped).length} skipped
              </span>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {clusters.map((cluster, idx) => {
              const isExpanded = expandedIdx.has(idx);
              const statusColor = cluster.skipped
                ? 'border-border bg-muted/30 opacity-60'
                : cluster.confirmed
                ? 'border-green-200 bg-green-50'
                : 'border-border bg-background';

              return (
                <div key={idx} className={`border rounded-lg overflow-hidden ${statusColor}`}>
                  {/* Header row */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      onClick={() => toggleExpanded(idx)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>

                    {/* Canonical name */}
                    {cluster.editing ? (
                      <input
                        autoFocus
                        className="flex-1 text-sm font-medium bg-background border border-border rounded px-2 py-0.5 outline-none"
                        value={cluster.canonical}
                        onChange={(e) => updateCluster(idx, { canonical: e.target.value })}
                        onBlur={() => updateCluster(idx, { editing: false })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            updateCluster(idx, { editing: false });
                          }
                        }}
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium">{cluster.canonical}</span>
                    )}

                    <button
                      onClick={() => updateCluster(idx, { editing: true })}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title="Edit canonical name"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>

                    <span className="text-xs text-muted-foreground shrink-0">
                      {cluster.variants.length} variant{cluster.variants.length !== 1 ? 's' : ''}
                    </span>

                    {/* Action buttons */}
                    {!cluster.skipped && !cluster.confirmed && (
                      <>
                        <button
                          onClick={() => updateCluster(idx, { confirmed: true })}
                          disabled={cluster.variants.length < 2}
                          className="shrink-0 px-2.5 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => updateCluster(idx, { skipped: true })}
                          className="shrink-0 px-2.5 py-1 text-xs text-muted-foreground border border-border rounded hover:bg-muted"
                        >
                          Skip
                        </button>
                      </>
                    )}
                    {cluster.confirmed && !cluster.skipped && (
                      <span className="shrink-0 flex items-center gap-1 text-xs text-green-700 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Confirmed
                      </span>
                    )}
                    {cluster.skipped && (
                      <button
                        onClick={() => updateCluster(idx, { skipped: false })}
                        className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Undo skip
                      </button>
                    )}
                  </div>

                  {/* Variant chips */}
                  {isExpanded && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                      {cluster.variants.map((variant, vi) => (
                        <span
                          key={vi}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted rounded-full"
                        >
                          {variant}
                          {!cluster.confirmed && !cluster.skipped && (
                            <button
                              onClick={() => removeVariant(idx, vi)}
                              className="text-muted-foreground hover:text-destructive ml-0.5"
                              title={`Remove "${variant}" from this group`}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {cluster.variants.length < 2 && (
                        <span className="text-xs text-amber-600 italic">
                          Needs at least 2 variants to save
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save section */}
          <div className="border border-border rounded-lg p-6">
            <h2 className="text-base font-semibold mb-1">Step 3 — Save confirmed entries</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Saving adds the confirmed groups to the ingredient alias table. These entries will take
              effect the next time a grocery list is generated. All changes are saved to{' '}
              <code className="bg-muted px-1 rounded text-xs">src/lib/ingredient-aliases.ts</code>{' '}
              and can be reviewed or reverted via git at any time.
            </p>
            <button
              onClick={handleSave}
              disabled={saving || confirmedCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                `Save ${confirmedCount} Confirmed Group${confirmedCount !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </>
      )}

      {/* Empty state after parse with no clusters */}
      {ingredientCount !== null && clusters.length === 0 && !parsing && !error && (
        <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No ingredient groups were proposed. This could mean all ingredient names in your
          export are already unique or the names don&apos;t have enough variation for Claude to
          confidently group them. You can still use the grocery list — consolidation will rely on
          the static alias table and descriptor-stripping logic.
        </div>
      )}
    </div>
  );
}
