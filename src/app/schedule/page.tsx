import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getScheduleForWeek } from '@/lib/queries/schedule';
import { ScheduleWeekView } from '@/components/schedule/ScheduleWeekView';

export const dynamic = 'force-dynamic';

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function toDateParam(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${weekEnd.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;

  let weekStart: Date;
  if (week) {
    weekStart = getWeekMonday(new Date(week + 'T00:00:00Z'));
  } else {
    weekStart = getWeekMonday(new Date());
  }

  const prevWeek = new Date(weekStart);
  prevWeek.setUTCDate(weekStart.getUTCDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setUTCDate(weekStart.getUTCDate() + 7);

  const [entries, chefs, clients] = await Promise.all([
    getScheduleForWeek(weekStart),
    prisma.chef.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/schedule?week=${toDateParam(prevWeek)}`}
            className="p-2 rounded-md border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {formatWeekRange(weekStart)}
          </span>
          <Link
            href={`/schedule?week=${toDateParam(nextWeek)}`}
            className="p-2 rounded-md border border-border hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {chefs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No chefs yet.{' '}
          <Link href="/chefs/new" className="underline">
            Add a chef
          </Link>{' '}
          to start scheduling.
        </p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No clients yet.{' '}
          <Link href="/clients/new" className="underline">
            Add a client
          </Link>{' '}
          to start scheduling.
        </p>
      ) : (
        <ScheduleWeekView
          entries={entries}
          weekStart={toDateParam(weekStart)}
          chefs={chefs}
          clients={clients}
        />
      )}
    </div>
  );
}
