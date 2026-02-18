import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getMenuById } from '@/lib/queries/menus';
import { getGroceryItemsForMenu } from '@/lib/queries/grocery';
import { GroceryPageClient } from '@/components/grocery/GroceryPageClient';

export default async function GroceryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [menu, groceryItems] = await Promise.all([
    getMenuById(id),
    getGroceryItemsForMenu(id),
  ]);

  if (!menu) {
    notFound();
  }

  return (
    <div>
      <Link
        href={`/menus/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Menu
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Grocery List</h1>
        <p className="text-sm text-muted-foreground">
          {menu.clientName}
          {menu.weekLabel ? ` — ${menu.weekLabel}` : ''}
        </p>
      </div>

      <GroceryPageClient menu={menu} initialGroceryItems={groceryItems} />
    </div>
  );
}
