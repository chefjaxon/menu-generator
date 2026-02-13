import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { getAllMenus } from '@/lib/queries/menus';
import { getAllClients } from '@/lib/queries/clients';
import { MenuHistoryTable } from '@/components/menus/menu-history-table';

export const dynamic = 'force-dynamic';

export default function MenusPage() {
  const menus = getAllMenus();
  const clients = getAllClients();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Menu History</h1>
        <Link
          href="/menus/generate"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          Generate Menu
        </Link>
      </div>
      <MenuHistoryTable menus={menus} clients={clients} />
    </div>
  );
}
