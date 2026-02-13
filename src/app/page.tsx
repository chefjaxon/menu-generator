import Link from 'next/link';
import { ChefHat, Users, CalendarDays, Sparkles } from 'lucide-react';
import { getDb } from '@/lib/db';

function getStats() {
  const db = getDb();
  const recipeCount = (db.prepare('SELECT COUNT(*) as count FROM recipes').get() as { count: number }).count;
  const clientCount = (db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number }).count;
  const menuCount = (db.prepare('SELECT COUNT(*) as count FROM menus WHERE finalized = 1').get() as { count: number }).count;
  const recentMenus = db.prepare(`
    SELECT m.id, m.week_label, m.created_at, c.name as client_name,
      (SELECT COUNT(*) FROM menu_items WHERE menu_id = m.id) as item_count
    FROM menus m
    JOIN clients c ON c.id = m.client_id
    WHERE m.finalized = 1
    ORDER BY m.created_at DESC
    LIMIT 5
  `).all() as Array<{ id: string; week_label: string | null; created_at: string; client_name: string; item_count: number }>;
  return { recipeCount, clientCount, menuCount, recentMenus };
}

export default function DashboardPage() {
  const { recipeCount, clientCount, menuCount, recentMenus } = getStats();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

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
                  <p className="font-medium">{menu.client_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {menu.week_label || new Date(menu.created_at).toLocaleDateString()} &middot; {menu.item_count} items
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
