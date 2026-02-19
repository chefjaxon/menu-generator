'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChefHat, Users, CalendarDays, LayoutDashboard, Plus, Sparkles, LogOut, Settings, ShoppingCart } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/recipes', label: 'Recipes', icon: ChefHat },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/menus', label: 'Menu History', icon: CalendarDays },
  { href: '/grocery-lists', label: 'Grocery Lists', icon: ShoppingCart },
{ href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-border">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <ChefHat className="h-6 w-6" />
          Menu Generator
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <Link
          href="/menus/generate"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate Menu
        </Link>
        <div className="flex gap-2">
          <Link
            href="/recipes/new"
            className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Recipe
          </Link>
          <Link
            href="/clients/new"
            className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Client
          </Link>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
