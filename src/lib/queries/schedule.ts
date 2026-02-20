import { prisma } from '../prisma';

export interface ChefScheduleEntry {
  id: string;
  chefId: string;
  chefName: string;
  clientId: string;
  clientName: string;
  clientChefNotes: string | null;
  scheduledDate: string; // ISO date string "2026-02-21"
  scheduledTime: string; // "09:00"
  notes: string | null;
  readyMenu: { id: string; weekLabel: string | null } | null;
}

function mapEntry(row: {
  id: string;
  chefId: string;
  clientId: string;
  scheduledDate: Date;
  scheduledTime: string;
  notes: string | null;
  chef: { name: string };
  client: {
    name: string;
    chefNotes: string | null;
    menus: { id: string; weekLabel: string | null }[];
  };
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
    readyMenu: row.client.menus[0] ?? null,
  };
}

const readyMenuInclude = {
  menus: {
    where: {
      groceryApproved: true,
      publishedAt: { not: null },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { id: true, weekLabel: true },
  },
};

export async function getScheduleForWeek(weekStart: Date): Promise<ChefScheduleEntry[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const rows = await prisma.chefSchedule.findMany({
    where: {
      scheduledDate: { gte: weekStart, lt: weekEnd },
    },
    include: {
      chef: { select: { name: true } },
      client: {
        select: {
          name: true,
          chefNotes: true,
          ...readyMenuInclude,
        },
      },
    },
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
    where: {
      chefId,
      scheduledDate: { gte: from, lte: to },
    },
    include: {
      chef: { select: { name: true } },
      client: {
        select: {
          name: true,
          chefNotes: true,
          ...readyMenuInclude,
        },
      },
    },
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
  });

  return rows.map(mapEntry);
}

export async function createScheduleEntry(data: {
  chefId: string;
  clientId: string;
  scheduledDate: string; // "YYYY-MM-DD"
  scheduledTime: string; // "HH:MM"
  notes?: string;
}): Promise<ChefScheduleEntry> {
  const row = await prisma.chefSchedule.create({
    data: {
      chefId: data.chefId,
      clientId: data.clientId,
      scheduledDate: new Date(data.scheduledDate + 'T00:00:00Z'),
      scheduledTime: data.scheduledTime,
      notes: data.notes ?? null,
    },
    include: {
      chef: { select: { name: true } },
      client: {
        select: {
          name: true,
          chefNotes: true,
          ...readyMenuInclude,
        },
      },
    },
  });

  return mapEntry(row);
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
    include: {
      chef: { select: { name: true } },
      client: {
        select: {
          name: true,
          chefNotes: true,
          ...readyMenuInclude,
        },
      },
    },
  });

  return mapEntry(row);
}

export async function deleteScheduleEntry(id: string): Promise<boolean> {
  await prisma.chefSchedule.delete({ where: { id } });
  return true;
}
