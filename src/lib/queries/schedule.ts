import { nanoid } from 'nanoid';
import { prisma } from '../prisma';

export interface LinkedMenu {
  id: string;
  weekLabel: string | null;
  groceryApproved: boolean;
  publishedAt: string | null;
}

export interface ChefScheduleEntry {
  id: string;
  chefId: string;
  chefName: string;
  clientId: string;
  clientName: string;
  clientChefNotes: string | null;
  scheduledDate: string; // "2026-02-21"
  scheduledTime: string; // "09:00"
  notes: string | null;
  recurrenceId: string | null;
  linkedMenu: LinkedMenu | null;
}

function mapEntry(row: {
  id: string;
  chefId: string;
  clientId: string;
  scheduledDate: Date;
  scheduledTime: string;
  notes: string | null;
  recurrenceId: string | null;
  chef: { name: string };
  client: { name: string; chefNotes: string | null };
  menu: {
    id: string;
    weekLabel: string | null;
    groceryApproved: boolean;
    publishedAt: Date | null;
  } | null;
}): ChefScheduleEntry {
  return {
    id: row.id,
    chefId: row.chefId,
    chefName: row.chef.name,
    clientId: row.clientId,
    clientName: row.client.name,
    clientChefNotes: row.client.chefNotes,
    scheduledDate: row.scheduledDate.toISOString().split('T')[0],
    scheduledTime: row.scheduledTime,
    notes: row.notes,
    recurrenceId: row.recurrenceId,
    linkedMenu: row.menu
      ? {
          id: row.menu.id,
          weekLabel: row.menu.weekLabel,
          groceryApproved: row.menu.groceryApproved,
          publishedAt: row.menu.publishedAt ? row.menu.publishedAt.toISOString() : null,
        }
      : null,
  };
}

const menuInclude = {
  select: {
    id: true,
    weekLabel: true,
    groceryApproved: true,
    publishedAt: true,
  },
} as const;

const baseInclude = {
  chef: { select: { name: true } },
  client: { select: { name: true, chefNotes: true } },
  menu: menuInclude,
} as const;

export async function getScheduleForWeek(weekStart: Date): Promise<ChefScheduleEntry[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  const rows = await prisma.chefSchedule.findMany({
    where: { scheduledDate: { gte: weekStart, lt: weekEnd } },
    include: baseInclude,
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
  });

  return rows.map(mapEntry);
}

export async function getScheduleForChef(
  chefId: string,
  from: Date,
  to: Date
): Promise<ChefScheduleEntry[]> {
  const rows = await prisma.chefSchedule.findMany({
    where: { chefId, scheduledDate: { gte: from, lte: to } },
    include: baseInclude,
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
  });

  return rows.map(mapEntry);
}

export async function createScheduleEntry(data: {
  chefId: string;
  clientId: string;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
  recurrenceId?: string;
}): Promise<ChefScheduleEntry> {
  const row = await prisma.chefSchedule.create({
    data: {
      chefId: data.chefId,
      clientId: data.clientId,
      scheduledDate: new Date(data.scheduledDate + 'T00:00:00Z'),
      scheduledTime: data.scheduledTime,
      notes: data.notes ?? null,
      recurrenceId: data.recurrenceId ?? null,
    },
    include: baseInclude,
  });

  return mapEntry(row);
}

export async function createRecurringEntries(
  data: {
    chefId: string;
    clientId: string;
    scheduledDate: string;
    scheduledTime: string;
    notes?: string;
  },
  recurrence: 'weekly' | 'biweekly'
): Promise<void> {
  const recurrenceId = nanoid();
  const intervalDays = recurrence === 'weekly' ? 7 : 14;
  const count = 8;

  const baseDate = new Date(data.scheduledDate + 'T00:00:00Z');
  const rows = Array.from({ length: count }, (_, i) => {
    const d = new Date(baseDate);
    d.setUTCDate(baseDate.getUTCDate() + i * intervalDays);
    return {
      chefId: data.chefId,
      clientId: data.clientId,
      scheduledDate: d,
      scheduledTime: data.scheduledTime,
      notes: data.notes ?? null,
      recurrenceId,
    };
  });

  await prisma.chefSchedule.createMany({ data: rows });
}

export async function updateScheduleEntry(
  id: string,
  data: {
    chefId?: string;
    clientId?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    notes?: string | null;
  }
): Promise<ChefScheduleEntry | null> {
  const row = await prisma.chefSchedule.update({
    where: { id },
    data: {
      ...(data.chefId !== undefined && { chefId: data.chefId }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.scheduledDate !== undefined && {
        scheduledDate: new Date(data.scheduledDate + 'T00:00:00Z'),
      }),
      ...(data.scheduledTime !== undefined && { scheduledTime: data.scheduledTime }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: baseInclude,
  });

  return mapEntry(row);
}

export async function deleteScheduleEntry(id: string): Promise<boolean> {
  await prisma.chefSchedule.delete({ where: { id } });
  return true;
}
