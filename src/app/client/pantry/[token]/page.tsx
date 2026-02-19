import { notFound } from 'next/navigation';
import { getMenuByPantryToken } from '@/lib/queries/menus';
import { prisma } from '@/lib/prisma';
import { PantryChecklist } from './PantryChecklist';

export default async function PantryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const menu = await getMenuByPantryToken(token);

  if (!menu || !menu.pantryToken) {
    notFound();
  }

  // Fetch grocery items for this menu
  const groceryItems = await prisma.groceryItem.findMany({
    where: { menuId: menu.id, source: { not: 'removed' } },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">Pantry Check</h1>
          <p className="text-muted-foreground text-sm">
            Check off items you already have at home so your chef can skip them.
          </p>
          {menu.weekLabel && (
            <p className="text-xs text-muted-foreground mt-1">{menu.weekLabel}</p>
          )}
        </div>

        <PantryChecklist
          menuId={menu.id}
          token={token}
          items={groceryItems.map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            category: i.category,
            checked: i.checked,
          }))}
          alreadySubmitted={menu.pantrySubmitted}
        />
      </div>
    </div>
  );
}
