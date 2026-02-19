'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, X } from 'lucide-react';

interface Chef {
  id: string;
  name: string;
  email: string;
}

interface Props {
  menuId: string;
  chefs: Chef[];
  assignedChef: Chef | null;
}

export function ChefAssignControl({ menuId, chefs, assignedChef }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(assignedChef?.id ?? '');
  const [saving, setSaving] = useState(false);

  async function assign() {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/menus/${menuId}/chef`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chefId: selected }),
    });
    setSaving(false);
    router.refresh();
  }

  async function unassign() {
    setSaving(true);
    await fetch(`/api/menus/${menuId}/chef`, { method: 'DELETE' });
    setSelected('');
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <ChefHat className="h-4 w-4 text-muted-foreground" />
        Assigned Chef
      </h3>

      {assignedChef ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{assignedChef.name}</p>
            <p className="text-xs text-muted-foreground">{assignedChef.email}</p>
          </div>
          <button
            onClick={unassign}
            disabled={saving}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            <option value="">Select a chef...</option>
            {chefs.map((chef) => (
              <option key={chef.id} value={chef.id}>
                {chef.name}
              </option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={!selected || saving}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Assign'}
          </button>
        </div>
      )}
    </div>
  );
}
