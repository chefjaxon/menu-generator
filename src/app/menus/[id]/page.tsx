import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, User, ChefHat, UtensilsCrossed, Cookie } from 'lucide-react';
import { getMenuById } from '@/lib/queries/menus';
import { formatLabel } from '@/lib/utils';

export default async function MenuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const menu = await getMenuById(id);

  if (!menu) {
    notFound();
  }

  const meals = menu.items.filter((i) => i.recipe?.itemType === 'meal');
  const sweetSnacks = menu.items.filter((i) => i.recipe?.itemType === 'sweet-snack');
  const savorySnacks = menu.items.filter((i) => i.recipe?.itemType === 'savory-snack');

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
        {!menu.finalized && (
          <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
            Draft
          </span>
        )}
      </div>

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
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{recipe.name}</h3>
          {recipe.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {recipe.description}
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
        </div>
        <span className="text-xs text-muted-foreground">
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
