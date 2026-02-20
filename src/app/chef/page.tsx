import Link from 'next/link';
import { cookies } from 'next/headers';
import { ShoppingCart, CalendarDays } from 'lucide-react';
import { validateChefSession } from '@/lib/chef-auth';
import { prisma } from '@/lib/prisma';
import { ChefLogoutButton } from './ChefLogoutButton';
import { ChefScheduleCard } from './ChefScheduleCard';

export const dynamic = 'force-dynamic';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export default async function ChefDashboardPage() {
  const cookieStore = await cookies();
  const chefToken = cookieStore.get('chef-session')?.value;

  let chef: { chefId: string; name: string; email: string } | null = null;
  if (chefToken) {
    chef = await validateChefSession(chefToken);
  }

  // Chef session: show only their assigned menus. Admin session: show all assignments.
  const whereClause = chef ? { chefId: chef.chefId } : {};

  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr + 'T00:00:00Z');
  const twoWeeks = new Date(today);
  twoWeeks.setUTCDate(today.getUTCDate() + 14);

  const [assignments, schedules] = await Promise.all([
    prisma.chefAssignment.findMany({
      where: whereClause,
      include: {
        menu: {
          select: {
            id: true,
            weekLabel: true,
            createdAt: true,
            groceryGenerated: true,
            client: { select: { name: true } },
          },
        },
        chef: { select: { name: true } },
      },
      orderBy: { menu: { createdAt: 'desc' } },
    }),
    chef
      ? prisma.chefSchedule.findMany({
          where: {
            chefId: chef.chefId,
            scheduledDate: { gte: today, lte: twoWeeks },
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                chefNotes: true,
                servingsPerDish: true,
                dishCount: true,
                proteins: { select: { protein: true }, orderBy: { protein: 'asc' } },
                restrictions: { select: { restriction: true }, orderBy: { restriction: 'asc' } },
                cuisinePreferences: {
                  select: { cuisineType: true, weight: true },
                  orderBy: { weight: 'desc' },
                },
              },
            },
            menu: {
              select: {
                id: true,
                weekLabel: true,
                groceryApproved: true,
                publishedAt: true,
                pantrySubmitted: true,
                groceryItems: {
                  where: { source: { not: 'removed' } },
                  orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
                  select: {
                    id: true,
                    name: true,
                    quantity: true,
                    unit: true,
                    checked: true,
                    category: true,
                    notes: true,
                  },
                },
                items: {
                  where: { clientSelected: true },
                  select: {
                    id: true,
                    clientNote: true,
                    omitNotes: true,
                    recipe: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-foreground text-background px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">Chef Dashboard</h1>
            {chef && <p className="text-xs opacity-70">{chef.name}</p>}
          </div>
          {chef && <ChefLogoutButton />}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Upcoming Schedule — only shown to chef sessions */}
        {chef && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Your Schedule (Next 2 Weeks)</h2>
            </div>
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
            ) : (
              <div className="space-y-3">
                {schedules.map((s) => (
                  <ChefScheduleCard
                    key={s.id}
                    schedule={s}
                    formattedDate={formatDate(s.scheduledDate)}
                    formattedTime={formatTime(s.scheduledTime)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assigned Menus */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Assigned Menus</h2>
          </div>
          {assignments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No menus assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/chef/grocery/${a.menu.id}`}
                  className="block border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{a.menu.client.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.menu.weekLabel || new Date(a.menu.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                        {!chef && ` · ${a.chef.name}`}
                      </p>
                    </div>
                    {a.menu.groceryGenerated && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Grocery ready
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
