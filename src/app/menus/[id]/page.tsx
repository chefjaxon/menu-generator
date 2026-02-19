import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, User, ChefHat, UtensilsCrossed, Cookie, ShoppingCart, ExternalLink, CheckCircle2, MessageSquare, Smartphone } from 'lucide-react';
import { getMenuById } from '@/lib/queries/menus';
import { formatLabel } from '@/lib/utils';
import { PublishControls } from '@/components/menus/PublishControls';
import { ChefAssignControl } from '@/components/menus/ChefAssignControl';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function MenuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [menu, allChefs, assignment] = await Promise.all([
    getMenuById(id),
    prisma.chef.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } }),
    prisma.chefAssignment.findFirst({
      where: { menuId: id },
      include: { chef: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  if (!menu) {
    notFound();
  }

  const assignedChef = assignment?.chef ?? null;

  const meals = menu.items.filter((i) => i.recipe?.itemType === 'meal');
  const sweetSnacks = menu.items.filter((i) => i.recipe?.itemType === 'sweet-snack');
  const savorySnacks = menu.items.filter((i) => i.recipe?.itemType === 'savory-snack');

  const clientSelectedItems = menu.items.filter((i) => i.clientSelected);
  const hasClientSelections = clientSelectedItems.length > 0;

  return (
    <div>
      <Link
        href="/menus"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Menus
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Menu Details</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {menu.clientName}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {menu.weekLabel ||
                new Date(menu.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
            </span>
            <span className="flex items-center gap-1.5">
              <ChefHat className="h-4 w-4" />
              {menu.items.length} items
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/menus/${menu.id}/grocery`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted"
          >
            <ShoppingCart className="h-4 w-4" />
            Grocery List
          </Link>
          {menu.groceryGenerated && (
            <Link
              href={`/chef/grocery/${menu.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted"
            >
              <Smartphone className="h-4 w-4" />
              Chef View
            </Link>
          )}
          {!menu.finalized && (
            <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
              Draft
            </span>
          )}
        </div>
      </div>

      {/* Client sharing controls */}
      <div className="mb-6">
        <PublishControls
          menuId={menu.id}
          initialClientToken={menu.clientToken}
          initialPantryToken={menu.pantryToken}
          pantrySubmitted={menu.pantrySubmitted}
          groceryGenerated={menu.groceryGenerated}
        />
      </div>

      {/* Chef assignment */}
      <div className="mb-6">
        <ChefAssignControl
          menuId={menu.id}
          chefs={allChefs}
          assignedChef={assignedChef}
        />
      </div>

      {/* Client selections summary */}
      {hasClientSelections && (
        <div className="mb-6 border border-green-200 bg-green-50 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Client Selected {clientSelectedItems.length} item{clientSelectedItems.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-1.5">
            {clientSelectedItems.map((item) => (
              <div key={item.id} className="text-sm">
                <span className="font-medium">{item.recipe?.name ?? item.recipeId}</span>
                {item.clientNote && (
                  <span className="ml-2 text-xs text-green-700 flex items-center gap-1 inline-flex">
                    <MessageSquare className="h-3 w-3" />
                    {item.clientNote}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {meals.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
            Meals ({meals.length})
          </h2>
          <div className="grid gap-3">
            {meals.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {savorySnacks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-muted-foreground" />
            Savory Snacks ({savorySnacks.length})
          </h2>
          <div className="grid gap-3">
            {savorySnacks.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {sweetSnacks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Cookie className="h-5 w-5 text-muted-foreground" />
            Sweet Snacks ({sweetSnacks.length})
          </h2>
          <div className="grid gap-3">
            {sweetSnacks.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItemCard({ item }: { item: import('@/lib/types').MenuItem }) {
  const recipe = item.recipe;
  if (!recipe) return null;

  return (
    <div className={`border rounded-lg p-4 ${item.clientSelected ? 'border-green-300 bg-green-50/50' : 'border-border'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {item.clientSelected && (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            )}
            <h3 className="font-medium">{recipe.name}</h3>
            {recipe.recipeKeeperUrl && (
              <a
                href={recipe.recipeKeeperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-3 w-3" />
                Recipe
              </a>
            )}
          </div>
          {recipe.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {recipe.description}
            </p>
          )}
          {item.clientNote && (
            <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Client note: {item.clientNote}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
              {formatLabel(recipe.cuisineType)}
            </span>
            {item.selectedProtein && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                {formatLabel(item.selectedProtein)}
              </span>
            )}
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
          {item.omitNotes && item.omitNotes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.omitNotes.map((note, i) => (
                <span key={i} className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs">
                  {note}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground ml-3 shrink-0">
          Serves {recipe.servingSize}
        </span>
      </div>

      {recipe.ingredients.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Ingredients
          </p>
          <p className="text-sm text-muted-foreground">
            {recipe.ingredients
              .map(
                (ing) =>
                  `${ing.quantity ? ing.quantity + ' ' : ''}${ing.unit ? ing.unit + ' ' : ''}${ing.name}`
              )
              .join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
