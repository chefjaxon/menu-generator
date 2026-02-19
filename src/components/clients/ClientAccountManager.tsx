'use client';

import { useState } from 'react';
import { KeyRound, CheckCircle2, Trash2 } from 'lucide-react';

interface Props {
  clientId: string;
  existingEmail: string | null;
}

export function ClientAccountManager({ clientId, existingEmail }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accountEmail, setAccountEmail] = useState(existingEmail);
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);

    const res = await fetch(`/api/admin/clients/${clientId}/account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setCreating(false);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to create account');
      return;
    }

    setAccountEmail(email);
    setShowForm(false);
    setSuccess('Client account created successfully');
    setEmail('');
    setPassword('');
  }

  async function handleDelete() {
    if (!confirm('Delete this client portal account? The client will lose access.')) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/clients/${clientId}/account`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      setAccountEmail(null);
      setSuccess('Account deleted');
    } else {
      setError('Failed to delete account');
    }
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <KeyRound className="h-4 w-4" />
          Client Portal Access
        </h3>
        {accountEmail && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            {deleting ? 'Removing…' : 'Remove access'}
          </button>
        )}
      </div>

      {accountEmail ? (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-muted-foreground">
            Account active: <span className="font-medium text-foreground">{accountEmail}</span>
          </span>
        </div>
      ) : showForm ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded text-sm bg-background focus:outline-none focus:border-primary"
              placeholder="client@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Password (min 8 chars)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded text-sm bg-background focus:outline-none focus:border-primary"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            No portal account. Create one to give this client login access.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-3 py-1.5 border border-border rounded hover:bg-muted"
          >
            Create portal account
          </button>
        </div>
      )}

      {success && !error && (
        <p className="mt-2 text-xs text-green-700">{success}</p>
      )}
    </div>
  );
}
