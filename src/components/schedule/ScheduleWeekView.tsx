'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, X } from 'lucide-react';
import { ScheduleEntryForm } from './ScheduleEntryForm';
import type { ChefScheduleEntry } from '@/lib/queries/schedule';

interface Chef {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

interface Props {
  entries: ChefScheduleEntry[];
  weekStart: string; // "YYYY-MM-DD"
  chefs: Chef[];
  clients: Client[];
}

function getWeekDays(weekStart: string): Date[] {
  const start = new Date(weekStart + 'T00:00:00Z');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function ScheduleWeekView({ entries, weekStart, chefs, clients }: Props) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const days = getWeekDays(weekStart);

  const byDay = new Map<string, ChefScheduleEntry[]>();
  for (const day of days) {
    byDay.set(toDateStr(day), []);
  }
  for (const entry of entries) {
    const key = entry.scheduledDate;
    if (byDay.has(key)) {
      byDay.get(key)!.push(entry);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add appointment
        </button>
      </div>

      {showAddForm && (
        <ScheduleEntryForm
          chefs={chefs}
          clients={clients}
          onSuccess={() => setShowAddForm(false)}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {days.map((day) => {
        const dateStr = toDateStr(day);
        const dayEntries = byDay.get(dateStr) ?? [];

        return (
          <div key={dateStr}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {formatDay(day)}
            </h3>
            <div className="space-y-2">
              {dayEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-1">No appointments</p>
              ) : (
                dayEntries.map((entry) => (
                  <div key={entry.id}>
                    {editingId === entry.id ? (
                      <ScheduleEntryForm
                        chefs={chefs}
                        clients={clients}
                        editId={entry.id}
                        defaultValues={{
                          chefId: entry.chefId,
                          clientId: entry.clientId,
                          scheduledDate: entry.scheduledDate,
                          scheduledTime: entry.scheduledTime,
                          notes: entry.notes ?? undefined,
                        }}
                        onSuccess={() => setEditingId(null)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div className="flex items-center justify-between px-4 py-3 border border-border rounded-xl bg-card">
                        <div>
                          <p className="text-sm font-medium">
                            {formatTime(entry.scheduledTime)} · {entry.chefName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{entry.clientName}</p>
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">{entry.notes}</p>
                          )}
                          {entry.readyMenu ? (
                            <p className="text-xs text-emerald-600 mt-0.5">Menu ready</p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">Menu pending</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingId(entry.id)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingId === entry.id}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
