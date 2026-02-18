'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ShoppingCart, Calendar, CheckSquare, ChefHat } from 'lucide-react';
import type { Client } from '@/lib/types';
import type { GroceryListSummary } from '@/lib/queries/grocery';

export function GroceryListsTable({
  summaries,
  clients,
}: {
  summaries: GroceryListSummary[];
  clients: Client[];
}) {
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  const filtered = summaries.filter((s) => {
    if (clientFilter) {
      const client = clients.find((c) => c.id === clientFilter);
      if (client && s.clientName !== client.name) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const nameMatch = s.clientName.toLowerCase().includes(q);
      const labelMatch = s.weekLabel?.toLowerCase().includes(q);
      if (!nameMatch && !labelMatch) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by client or week..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {summaries.length === 0
            ? 'No grocery lists yet. Open a finalized menu and click "Grocery List" to get started.'
            : 'No grocery lists match your filters.'}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Client</th>
                <th className="text-left px-4 py-3 font-medium">Week</th>
                <th className="text-left px-4 py-3 font-medium">Selections</th>
                <th className="text-left px-4 py-3 font-medium">Grocery Items</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => {
                const hasGrocery = s.totalItems > 0;
                const progress = hasGrocery
                  ? Math.round((s.checkedItems / s.totalItems) * 100)
                  : 0;

                return (
                  <tr key={s.menuId} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{s.clientName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {s.weekLabel || 'No label'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <ChefHat className="h-3.5 w-3.5" />
                        {s.selectedCount} selected
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {hasGrocery ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <CheckSquare className="h-3.5 w-3.5" />
                            {s.checkedItems}/{s.totalItems} checked
                          </div>
                          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-foreground rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No items yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/menus/${s.menuId}/grocery`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {hasGrocery ? 'Open List' : 'Start List'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
