'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { formatLabel } from '@/lib/utils';

export default function SettingsPage() {
  const [proteins, setProteins] = useState<string[]>([]);
  const [usages, setUsages] = useState<Record<string, number>>({});
  const [newProtein, setNewProtein] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProteins();
  }, []);

  async function fetchProteins() {
    try {
      const [proteinsRes, usagesRes] = await Promise.all([
        fetch('/api/proteins'),
        fetch('/api/proteins?usages=1'),
      ]);
      const proteinsData = await proteinsRes.json();
      setProteins(proteinsData);

      // Fetch usage counts for each protein
      const usageMap: Record<string, number> = {};
      for (const p of proteinsData) {
        try {
          const res = await fetch(`/api/proteins/${encodeURIComponent(p)}?usage=1`);
          if (res.ok) {
            const data = await res.json();
            usageMap[p] = data.usage || 0;
          }
        } catch {
          usageMap[p] = 0;
        }
      }
      setUsages(usageMap);
    } catch {
      setError('Failed to load proteins');
    }
    setLoading(false);
  }

  async function handleAdd() {
    const name = newProtein.trim().toLowerCase();
    if (!name) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/proteins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add protein');
        return;
      }

      setNewProtein('');
      setSuccess(`Added "${formatLabel(name)}"`);
      await fetchProteins();
    } catch {
      setError('Failed to add protein');
    }
  }

  async function handleDelete(name: string) {
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/proteins/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete protein');
        return;
      }

      setSuccess(`Removed "${formatLabel(name)}"`);
      await fetchProteins();
    } catch {
      setError('Failed to delete protein');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="max-w-xl">
        <h2 className="text-lg font-semibold mb-1">Manage Proteins</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add or remove protein types. Proteins in use by clients or recipes cannot be deleted.
        </p>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            {success}
          </div>
        )}

        {/* Add new protein */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newProtein}
            onChange={(e) => setNewProtein(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="New protein name (e.g. lamb, duck)"
          />
          <button
            onClick={handleAdd}
            disabled={!newProtein.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {/* Protein list */}
        <div className="border border-border rounded-md divide-y divide-border">
          {proteins.map((p) => {
            const usage = usages[p] || 0;
            const inUse = usage > 0;

            return (
              <div key={p} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium">{formatLabel(p)}</span>
                  {inUse && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({usage} {usage === 1 ? 'use' : 'uses'})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={inUse}
                  className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
                  title={inUse ? `Cannot delete: used by ${usage} client(s)/recipe(s)` : `Delete ${formatLabel(p)}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {proteins.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No proteins defined. Add one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
