import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ChefGroceryView } from './ChefGroceryView';

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'pantry', 'other'] as const;

export const dynamic = 'force-dynamic';

export default async function ChefGroceryPage({
  params,
}: {
  params: Promise<{ menuId: string }>;
}) {
  const { menuId } = await params;

  const menu = await prisma.menu.findUnique({
    where: { id: menuId },
    select: {
      id: true,
      weekLabel: true,
      createdAt: true,
      pantrySubmitted: true,
      client: {
        select: {
          name: true,
          chefNotes: true,
          servingsPerDish: true,
          dishCount: true,
        },
      },
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
          recipe: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!menu) {
    notFound();
  }

  const groceryByCategory = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = menu.groceryItems.filter((i) => i.category === cat);
    return acc;
  }, {} as Record<string, typeof menu.groceryItems>);

  return (
    <div className="min-h-screen bg-background">
      {/* Chef header */}
      <div className="bg-foreground text-background px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <h1 className="text-base font-semibold">{menu.client.name}</h1>
          <p className="text-xs opacity-70">
            {menu.weekLabel || new Date(menu.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })}
            {menu.client.dishCount && ` · ${menu.client.dishCount} dishes`}
            {menu.client.servingsPerDish && ` · ${menu.client.servingsPerDish} servings`}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Chef notes */}
        {menu.client.chefNotes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Chef Notes</p>
            <p className="text-sm text-amber-900 whitespace-pre-line">{menu.client.chefNotes}</p>
          </div>
        )}

        {/* Client selected dishes */}
        {menu.items.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-green-800 mb-2">Selected Dishes</p>
            <div className="space-y-1.5">
              {menu.items.map((item) => (
                <div key={item.id} className="text-sm">
                  <Link
                    href={`/chef/recipe/${item.id}`}
                    className="font-medium hover:underline"
                  >
                    {item.recipe?.name ?? '—'}
                  </Link>
                  {item.clientNote && (
                    <span className="ml-2 text-xs text-green-700 italic">
                      &ldquo;{item.clientNote}&rdquo;
                    </span>
                  )}
                  {item.omitNotes && JSON.parse(item.omitNotes as string).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(JSON.parse(item.omitNotes as string) as string[]).map((note, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          {note}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {menu.pantrySubmitted && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-4 text-xs text-blue-700 font-medium">
            Client submitted pantry list — checked items are already in their pantry
          </div>
        )}

        {/* Grocery list */}
        <ChefGroceryView
          menuId={menu.id}
          groceryByCategory={groceryByCategory}
          categoryOrder={[...CATEGORY_ORDER]}
        />
      </div>
    </div>
  );
}
