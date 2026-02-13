'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus, X, Pencil, Check } from 'lucide-react';
import { formatLabel } from '@/lib/utils';

interface ProteinGroup {
  id: string;
  name: string;
  members: string[];
}

export default function SettingsPage() {
  const [proteins, setProteins] = useState<string[]>([]);
  const [usages, setUsages] = useState<Record<string, number>>({});
  const [newProtein, setNewProtein] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Protein groups state
  const [groups, setGroups] = useState<ProteinGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupMembers, setEditGroupMembers] = useState<string[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [proteinsRes, groupsRes] = await Promise.all([
        fetch('/api/proteins'),
        fetch('/api/protein-groups'),
      ]);
      const proteinsData = await proteinsRes.json();
      const groupsData = await groupsRes.json();
      setProteins(proteinsData);
      setGroups(groupsData);

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
      setError('Failed to load data');
    }
    setLoading(false);
  }

  async function handleAddProtein() {
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
      await fetchAll();
    } catch {
      setError('Failed to add protein');
    }
  }

  async function handleDeleteProtein(name: string) {
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
      await fetchAll();
    } catch {
      setError('Failed to delete protein');
    }
  }

  function handleProteinKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddProtein();
    }
  }

  // ── Protein Group Handlers ──────────────────────────────────────────────

  function toggleNewGroupMember(protein: string) {
    setNewGroupMembers((prev) =>
      prev.includes(protein) ? prev.filter((p) => p !== protein) : [...prev, protein]
    );
  }

  function toggleEditGroupMember(protein: string) {
    setEditGroupMembers((prev) =>
      prev.includes(protein) ? prev.filter((p) => p !== protein) : [...prev, protein]
    );
  }

  async function handleAddGroup() {
    const name = newGroupName.trim().toLowerCase();
    if (!name || newGroupMembers.length === 0) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/protein-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, members: newGroupMembers }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add group');
        return;
      }

      setNewGroupName('');
      setNewGroupMembers([]);
      setSuccess(`Created group "${formatLabel(name)}"`);
      await fetchAll();
    } catch {
      setError('Failed to add group');
    }
  }

  function startEditGroup(group: ProteinGroup) {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
    setEditGroupMembers([...group.members]);
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setEditGroupName('');
    setEditGroupMembers([]);
  }

  async function handleSaveEditGroup() {
    if (!editingGroupId || !editGroupName.trim() || editGroupMembers.length === 0) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/protein-groups/${editingGroupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editGroupName.trim(), members: editGroupMembers }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update group');
        return;
      }

      setEditingGroupId(null);
      setEditGroupName('');
      setEditGroupMembers([]);
      setSuccess(`Updated group "${formatLabel(editGroupName.trim())}"`);
      await fetchAll();
    } catch {
      setError('Failed to update group');
    }
  }

  async function handleDeleteGroup(id: string, name: string) {
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/protein-groups/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete group');
        return;
      }

      setSuccess(`Removed group "${formatLabel(name)}"`);
      await fetchAll();
    } catch {
      setError('Failed to delete group');
    }
  }

  function handleGroupKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddGroup();
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

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm max-w-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm max-w-xl">
          {success}
        </div>
      )}

      <div className="max-w-xl space-y-10">
        {/* ── Manage Proteins ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Manage Proteins</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add or remove protein types. Proteins in use by clients or recipes cannot be deleted.
          </p>

          {/* Add new protein */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newProtein}
              onChange={(e) => setNewProtein(e.target.value)}
              onKeyDown={handleProteinKeyDown}
              className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="New protein name (e.g. lamb, duck)"
            />
            <button
              onClick={handleAddProtein}
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
                    onClick={() => handleDeleteProtein(p)}
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

        {/* ── Protein Groups ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Protein Groups</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Group related proteins together. In menu composition, a group slot (e.g. &quot;Seafood&quot;) allows any mix of its member proteins (e.g. salmon, cod, trout, shrimp) to fill the slot count.
          </p>

          {/* Add new group */}
          <div className="border border-border rounded-md p-4 mb-4 space-y-3">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={handleGroupKeyDown}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="New group name (e.g. seafood, red meat)"
            />
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Select member proteins:</p>
              <div className="flex flex-wrap gap-1.5">
                {proteins.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleNewGroupMember(p)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      newGroupMembers.includes(p)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {formatLabel(p)}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleAddGroup}
              disabled={!newGroupName.trim() || newGroupMembers.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create Group
            </button>
          </div>

          {/* Group list */}
          <div className="border border-border rounded-md divide-y divide-border">
            {groups.map((group) => {
              const isEditing = editingGroupId === group.id;

              if (isEditing) {
                return (
                  <div key={group.id} className="px-4 py-3 space-y-2 bg-muted/30">
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {proteins.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleEditGroupMember(p)}
                          className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                            editGroupMembers.includes(p)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          {formatLabel(p)}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEditGroup}
                        disabled={!editGroupName.trim() || editGroupMembers.length === 0}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        Save
                      </button>
                      <button
                        onClick={cancelEditGroup}
                        className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-md text-xs hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={group.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm font-medium">{formatLabel(group.name)}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {group.members.map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs"
                        >
                          {formatLabel(m)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEditGroup(group)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title={`Edit ${formatLabel(group.name)}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      title={`Delete ${formatLabel(group.name)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {groups.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No protein groups defined. Create one above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
