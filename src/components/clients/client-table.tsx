'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Search } from 'lucide-react';
import { formatLabel } from '@/lib/utils';
import type { Client } from '@/lib/types';

export function ClientTable({ clients: initialClients }: { clients: Client[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = initialClients.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete client "${name}"? This will also delete all their menus. This cannot be undone.`)) return;
    setDeleting(id);
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
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
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {initialClients.length === 0
            ? 'No clients yet. Add your first client to get started.'
            : 'No clients match your search.'}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Proteins</th>
                <th className="text-left px-4 py-3 font-medium">Restrictions</th>
                <th className="text-left px-4 py-3 font-medium">Items/Menu</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((client) => (
                <tr key={client.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <span className="font-medium">{client.name}</span>
                    {client.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{client.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {client.proteins.map((p) => (
                        <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{formatLabel(p)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {client.restrictions.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        client.restrictions.map((r) => (
                          <span key={r} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">{formatLabel(r)}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {client.itemsPerMenu}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/clients/${client.id}`}
                        className="p-1.5 hover:bg-muted rounded"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(client.id, client.name)}
                        disabled={deleting === client.id}
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
