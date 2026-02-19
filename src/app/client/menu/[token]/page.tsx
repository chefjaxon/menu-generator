import { notFound } from 'next/navigation';
import { getMenuByClientToken } from '@/lib/queries/menus';
import { ClientMenuSelector } from './ClientMenuSelector';
import type { IngredientSwapCallout } from '@/lib/types';

export default async function ClientMenuPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const menu = await getMenuByClientToken(token);

  if (!menu || !menu.publishedAt) {
    notFound();
  }

  // Compute applicable ingredient swaps per menu item for this client
  const restrictions = menu.clientRestrictions ?? [];
  if (restrictions.length > 0) {
    for (const item of menu.items) {
      if (!item.recipe) continue;
      const swaps: IngredientSwapCallout[] = [];
      for (const ing of item.recipe.ingredients) {
        const ingName = ing.name.toLowerCase().trim();
        for (const restriction of restrictions) {
          if (ingName.includes(restriction) || restriction.includes(ingName)) {
            const swap = ing.swaps.find(
              (s) => s.restriction.toLowerCase().trim() === restriction
            );
            if (swap) {
              swaps.push({ original: ing.name, substitute: swap.substituteIngredient });
            }
            break;
          }
        }
      }
      if (swaps.length > 0) {
        item.applicableSwaps = swaps;
      }
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">Your Meal Selections</h1>
          <p className="text-muted-foreground text-sm">
            {menu.weekLabel || new Date(menu.createdAt).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>

        <ClientMenuSelector menu={menu} token={token} />
      </div>
    </div>
  );
}
