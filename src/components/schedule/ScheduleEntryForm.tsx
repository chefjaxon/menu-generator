'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Repeat2 } from 'lucide-react';

interface Chef {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

interface Props {
  chefs: Chef[];
  clients: Client[];
  defaultValues?: {
    chefId?: string;
    clientId?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    notes?: string;
    recurrenceId?: string | null;
  };
  editId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function ScheduleEntryForm({ chefs, clients, defaultValues, editId, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chefId, setChefId] = useState(defaultValues?.chefId ?? '');
  const [clientId, setClientId] = useState(defaultValues?.clientId ?? '');
  const [scheduledDate, setScheduledDate] = useState(defaultValues?.scheduledDate ?? '');
  const [scheduledTime, setScheduledTime] = useState(defaultValues?.scheduledTime ?? '');
  const [notes, setNotes] = useState(defaultValues?.notes ?? '');
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly'>('none');

  const isEdit = !!editId;
  const isRecurring = !!defaultValues?.recurrenceId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = isEdit ? `/api/schedule/${editId}` : '/api/schedule';
      const method = isEdit ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = {
        chefId,
        clientId,
        scheduledDate,
        scheduledTime,
        notes: notes || null,
      };
      if (!isEdit) {
        body.recurrence = recurrence;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save');
        return;
      }

      router.refresh();
      onSuccess();
    } catch {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
      {isEdit && isRecurring && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 italic">
          <Repeat2 className="h-3.5 w-3.5 shrink-0" />
          Part of a recurring series — editing this occurrence only
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Chef</label>
          <select
            required
            value={chefId}
            onChange={(e) => setChefId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select chef…</option>
            {chefs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Client</label>
          <select
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <input
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Time</label>
          <input
            type="time"
            required
            step="900"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      {!isEdit && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Repeat</label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as 'none' | 'weekly' | 'biweekly')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="none">Does not repeat</option>
            <option value="weekly">Weekly (8 weeks)</option>
            <option value="biweekly">Every 2 weeks (8 occurrences)</option>
          </select>
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any additional notes…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving
            ? 'Saving…'
            : isEdit
            ? 'Save changes'
            : recurrence !== 'none'
            ? 'Add recurring appointments'
            : 'Add appointment'}
        </button>
      </div>
    </form>
  );
}
