import Link from 'next/link';
import { ChefHat, Users, CalendarDays, Sparkles, Bell, CheckCircle2, Clock } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getStats() {
  const [recipeCount, clientCount, menuCount, recentMenus, pendingSelections] = await Promise.all([
    prisma.recipe.count(),
    prisma.client.count(),
    prisma.menu.count({ where: { finalized: true } }),
    prisma.menu.findMany({
      where: { finalized: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        weekLabel: true,
        createdAt: true,
        groceryGenerated: true,
        publishedAt: true,
        client: { select: { name: true } },
        _count: { select: { items: true } },
        items: { where: { clientSelected: true }, select: { id: true } },
      },
    }),
    // Menus that are published but grocery not yet generated — client has likely responded
    prisma.menu.findMany({
      where: {
        finalized: true,
        publishedAt: { not: null },
        groceryGenerated: false,
        items: { some: { clientSelected: true } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        weekLabel: true,
        createdAt: true,
        client: { select: { name: true } },
        items: { where: { clientSelected: true }, select: { id: true } },
      },
    }),
  ]);
  return { recipeCount, clientCount, menuCount, recentMenus, pendingSelections };
}

export default async function DashboardPage() {
  const { recipeCount, clientCount, menuCount, recentMenus, pendingSelections } = await getStats();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {pendingSelections.length > 0 && (
        <div className="mb-6 border border-amber-200 bg-amber-50 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Pending Client Selections ({pendingSelections.length})
          </h2>
          <div className="space-y-2">
            {pendingSelections.map((menu) => (
              <Link
                key={menu.id}
                href={`/menus/${menu.id}`}
                className="flex items-center justify-between p-3 bg-background rounded-md border border-amber-200 hover:bg-amber-50/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{menu.client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {menu.weekLabel || menu.createdAt.toLocaleDateString()} &middot; {menu.items.length} item{menu.items.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded font-medium">
                  Review →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <ChefHat className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Recipes</span>
          </div>
          <p className="text-3xl font-bold">{recipeCount}</p>
        </div>
        <div className="border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Clients</span>
          </div>
          <p className="text-3xl font-bold">{clientCount}</p>
        </div>
        <div className="border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Menus Created</span>
          </div>
          <p className="text-3xl font-bold">{menuCount}</p>
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        <Link
          href="/menus/generate"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          Generate Menu
        </Link>
        <Link
          href="/schedule"
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted"
        >
          <Clock className="h-4 w-4" />
          Schedule
        </Link>
        <Link
          href="/recipes/new"
          className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted"
        >
          Add Recipe
        </Link>
        <Link
          href="/clients/new"
          className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted"
        >
          Add Client
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Menus</h2>
        {recentMenus.length === 0 ? (
          <p className="text-muted-foreground text-sm">No menus created yet. Generate your first menu to get started.</p>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {recentMenus.map((menu) => (
              <Link
                key={menu.id}
                href={`/menus/${menu.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted transition-colors"
              >
                <div>
                  <p className="font-medium">{menu.client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {menu.weekLabel || menu.createdAt.toLocaleDateString()} &middot; {menu._count.items} items
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {menu.items.length > 0 && (
                    <span className="text-xs flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {menu.items.length} selected
                    </span>
                  )}
                  {menu.groceryGenerated && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                      Grocery Ready
                    </span>
                  )}
                  {menu.publishedAt && !menu.groceryGenerated && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded font-medium">
                      Published
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
