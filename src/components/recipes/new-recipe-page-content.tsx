'use client';

import { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { RecipeForm } from './recipe-form';

interface ImportedData {
  name: string;
  description: string;
  instructions: string;
  cuisineType: string;
  itemType: string;
  servingSize: number;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  proteinSwaps: string[];
  tags: string[];
}

export function NewRecipePageContent() {
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedData, setImportedData] = useState<ImportedData | null>(null);

  async function handleImport() {
    const url = importUrl.trim();
    if (!url) return;

    setImporting(true);
    setImportError('');
    setImportSuccess(false);

    try {
      const res = await fetch('/api/recipes/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setImportError(data.error || 'Failed to import recipe');
        setImporting(false);
        return;
      }

      setImportedData(data);
      setImportSuccess(true);
      setImportError('');
    } catch {
      setImportError('Failed to import recipe. Check the URL and try again.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      {/* Import from URL section */}
      <div className="mb-8 p-4 bg-muted/50 border border-border rounded-lg">
        <h2 className="text-sm font-medium mb-1 flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Import from URL
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Paste a recipe link to auto-fill the form below. Review and edit before saving.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://recipekeeperonline.com/recipe/..."
            className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleImport();
              }
            }}
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !importUrl.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Import'
            )}
          </button>
        </div>

        {importError && (
          <p className="mt-2 text-sm text-red-600">{importError}</p>
        )}
        {importSuccess && (
          <p className="mt-2 text-sm text-green-600">
            Recipe imported! Review and edit the details below, then save.
          </p>
        )}
      </div>

      {/* Recipe form — key forces remount when data is imported */}
      <RecipeForm
        initialData={importedData}
        key={importedData ? `imported-${Date.now()}` : 'new'}
      />
    </>
  );
}
