'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import type { RemovedItem } from '@/lib/types';

interface Props {
  items: RemovedItem[];
  onRestore: (itemId: string) => void;
}

export function RemovedItemsPanel({ items, onRestore }: Props) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
        aria-expanded={open}
      >
        {open
          ? <ChevronDown className="h-4 w-4 text-amber-600 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-amber-600 shrink-0" />
        }
        <h2 className="text-base font-semibold text-amber-700">
          Removed Items ({items.length})
        </h2>
        <span className="text-xs text-amber-600 font-normal">
          — ingredients without measurements, removed during generation
        </span>
      </button>

      {open && (
        <div className="mt-3 border border-amber-200 rounded-lg overflow-hidden">
          <ul className="divide-y divide-amber-100 bg-amber-50">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm text-amber-900">{item.name}</span>
                <button
                  onClick={() => onRestore(item.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-300 rounded hover:bg-amber-100 transition-colors shrink-0"
                  title={`Restore "${item.name}" to grocery list`}
                >
                  <RotateCcw className="h-3 w-3" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 border-t border-amber-200 bg-amber-50/70">
            <p className="text-xs text-amber-600">
              Restoring an item adds it to the main grocery list as a manual entry. It will survive future regenerations.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
