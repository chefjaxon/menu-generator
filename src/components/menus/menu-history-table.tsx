'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Search, Eye, Calendar, ChefHat } from 'lucide-react';
import { formatLabel } from '@/lib/utils';
import type { Menu, Client } from '@/lib/types';

export function MenuHistoryTable({
  menus,
  clients,
}: {
  menus: Menu[];
  clients: Client[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = menus.filter((m) => {
    if (!m.finalized) return false;
    if (clientFilter && m.clientId !== clientFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const nameMatch = m.clientName?.toLowerCase().includes(q);
      const labelMatch = m.weekLabel?.toLowerCase().includes(q);
      if (!nameMatch && !labelMatch) return false;
    }
    return true;
  });

  async function handleDelete(id: string) {
    if (!confirm('Delete this menu? This cannot be undone.')) return;
    setDeleting(id);
    await fetch(`/api/menus/${id}`, { method: 'DELETE' });
    router.refresh();
    setDeleting(null);
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search menus..."
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
          {menus.filter((m) => m.finalized).length === 0
            ? 'No menus created yet. Generate your first menu to get started.'
            : 'No menus match your filters.'}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Client</th>
                <th className="text-left px-4 py-3 font-medium">Week</th>
                <th className="text-left px-4 py-3 font-medium">Items</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((menu) => (
                <tr key={menu.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <span className="font-medium">{menu.clientName}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {menu.weekLabel || 'No label'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ChefHat className="h-3.5 w-3.5" />
                      {menu.items.length} items
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {menu.groceryGenerated ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Grocery Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Approved
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(menu.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/menus/${menu.id}`}
                        className="p-1.5 hover:bg-muted rounded"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(menu.id)}
                        disabled={deleting === menu.id}
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
