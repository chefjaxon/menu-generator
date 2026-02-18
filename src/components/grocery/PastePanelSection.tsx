'use client';

import { useState } from 'react';
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react';

interface ParsedRow {
  name: string;
  quantity: string;
  unit: string;
}

interface Props {
  menuId: string;
  onAdd: (items: Array<{ name: string; quantity: string | null; unit: string | null }>) => Promise<void>;
}

export function PastePanelSection({ menuId, onAdd }: Props) {
  const [text, setText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [parseError, setParseError] = useState('');

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setParseError('');
    try {
      const res = await fetch(`/api/menus/${menuId}/grocery/parse-paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const lines: Array<{ name: string; quantity: string | null; unit: string | null }> =
        await res.json();
      setParsedRows(
        lines.map((l) => ({
          name: l.name,
          quantity: l.quantity ?? '',
          unit: l.unit ?? '',
        }))
      );
    } catch {
      setParseError('Failed to parse ingredients. Please try again.');
    } finally {
      setParsing(false);
    }
  }

  function updateRow(index: number, field: keyof ParsedRow, value: string) {
    setParsedRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function removeRow(index: number) {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAdd() {
    const validRows = parsedRows.filter((r) => r.name.trim());
    if (validRows.length === 0) return;
    setAdding(true);
    try {
      await onAdd(
        validRows.map((r) => ({
          name: r.name.trim(),
          quantity: r.quantity.trim() || null,
          unit: r.unit.trim() || null,
        }))
      );
      setParsedRows([]);
      setText('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">Add Extra Ingredients</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Paste ingredients from past menus or other sources. Each line will be parsed
        into an individual item you can edit before adding to the grocery list.
      </p>

      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Paste ingredients here, one per line:\n2 cups chicken broth\n1 lb ground beef\nsalt and pepper'}
          rows={6}
          className="w-full text-sm px-3 py-2 border border-border rounded-lg bg-background resize-y font-mono"
        />

        {parseError && (
          <p className="text-sm text-destructive">{parseError}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleParse}
            disabled={!text.trim() || parsing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-sm hover:bg-muted disabled:opacity-50"
          >
            <ClipboardPaste className="h-4 w-4" />
            {parsing ? 'Parsing...' : 'Parse Ingredients'}
          </button>
          {parsedRows.length > 0 && (
            <button
              onClick={() => { setParsedRows([]); }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {parsedRows.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 border-b border-border px-3 py-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {parsedRows.length} ingredient{parsedRows.length !== 1 ? 's' : ''} parsed — edit as needed
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                    Ingredient
                  </th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground w-24">
                    Qty
                  </th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground w-20">
                    Unit
                  </th>
                  <th className="py-2 px-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0 group">
                    <td className="py-2 px-3">
                      <input
                        className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border"
                        value={row.name}
                        onChange={(e) => updateRow(i, 'name', e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border text-center"
                        value={row.quantity}
                        onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-border text-center"
                        value={row.unit}
                        onChange={(e) => updateRow(i, 'unit', e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => removeRow(i)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border p-3">
              <button
                onClick={handleAdd}
                disabled={adding || parsedRows.filter((r) => r.name.trim()).length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {adding
                  ? 'Adding...'
                  : `Add ${parsedRows.filter((r) => r.name.trim()).length} item${parsedRows.filter((r) => r.name.trim()).length !== 1 ? 's' : ''} to Grocery List`}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
