import Link from 'next/link';
import { cookies } from 'next/headers';
import { ShoppingCart } from 'lucide-react';
import { validateChefSession } from '@/lib/chef-auth';
import { prisma } from '@/lib/prisma';
import { ChefLogoutButton } from './ChefLogoutButton';

export const dynamic = 'force-dynamic';

export default async function ChefDashboardPage() {
  const cookieStore = await cookies();
  const chefToken = cookieStore.get('chef-session')?.value;

  let chef: { chefId: string; name: string; email: string } | null = null;
  if (chefToken) {
    chef = await validateChefSession(chefToken);
  }

  // Chef session: show only their assigned menus. Admin session: show all assignments.
  const whereClause = chef ? { chefId: chef.chefId } : {};

  const assignments = await prisma.chefAssignment.findMany({
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
  });

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

      <div className="max-w-lg mx-auto px-4 py-6">
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
  );
}
