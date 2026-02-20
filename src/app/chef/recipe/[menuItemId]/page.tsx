import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ChefRecipePage({
  params,
}: {
  params: Promise<{ menuItemId: string }>;
}) {
  const { menuItemId } = await params;

  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: {
      recipe: {
        include: {
          ingredients: {
            orderBy: { sortOrder: 'asc' },
            include: { swaps: true },
          },
        },
      },
      menu: {
        include: {
          client: {
            include: {
              restrictions: true,
            },
          },
        },
      },
    },
  });

  if (!menuItem || !menuItem.recipe) {
    notFound();
  }

  const recipe = menuItem.recipe;
  const clientName = menuItem.menu.client.name;
  const menuId = menuItem.menuId;
  const clientRestrictions = menuItem.menu.client.restrictions.map((r) =>
    r.restriction.toLowerCase().trim()
  );

  // Compute per-ingredient swap callouts
  const ingredientSwaps = new Map<string, string>(); // ingId -> substitute name
  for (const ing of recipe.ingredients) {
    const ingName = ing.name.toLowerCase().trim();
    for (const restriction of clientRestrictions) {
      if (ingName.includes(restriction) || restriction.includes(ingName)) {
        const swap = ing.swaps.find(
          (s) => s.restriction.toLowerCase().trim() === restriction
        );
        if (swap) {
          ingredientSwaps.set(ing.id, swap.substituteIngredient);
        }
        break;
      }
    }
  }

  const hasSwaps = ingredientSwaps.size > 0;

  // Build a name-keyed map for instruction highlighting: originalName -> substituteName
  // Sort by length descending so longer names match before shorter substrings
  const nameSwaps: Array<{ original: string; substitute: string }> = Array.from(
    ingredientSwaps.entries()
  )
    .map(([ingId, sub]) => {
      const ing = recipe.ingredients.find((i) => i.id === ingId)!;
      return { original: ing.name, substitute: sub };
    })
    .sort((a, b) => b.original.length - a.original.length);

  /**
   * Splits `text` into segments, tagging any span that matches a swapped
   * ingredient name so it can be rendered with a swap callout inline.
   */
  function highlightSwaps(
    text: string
  ): Array<{ text: string; swap?: { original: string; substitute: string } }> {
    if (nameSwaps.length === 0) return [{ text }];

    // Build a single regex that alternates all original names (escaped)
    const pattern = nameSwaps
      .map((s) => s.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    const parts: Array<{ text: string; swap?: { original: string; substitute: string } }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index) });
      }
      const matched = match[0];
      const swapEntry = nameSwaps.find(
        (s) => s.original.toLowerCase() === matched.toLowerCase()
      )!;
      parts.push({ text: matched, swap: swapEntry });
      lastIndex = match.index + matched.length;
    }

    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex) });
    }

    return parts;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-foreground text-background px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/chef/grocery/${menuId}`}
            className="inline-flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to grocery list
          </Link>
          <h1 className="text-base font-semibold">{recipe.name}</h1>
          <p className="text-xs opacity-70">{clientName}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {/* Swap summary banner */}
        {hasSwaps && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Ingredient swaps for {clientName}
            </p>
            <ul className="space-y-1">
              {Array.from(ingredientSwaps.entries()).map(([ingId, sub]) => {
                const ing = recipe.ingredients.find((i) => i.id === ingId)!;
                return (
                  <li key={ingId} className="text-xs text-amber-900">
                    Replace <span className="font-medium line-through">{ing.name}</span> with{' '}
                    <span className="font-semibold">{sub}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Description */}
        {recipe.description && (
          <p className="text-sm text-muted-foreground">{recipe.description}</p>
        )}

        {/* Ingredients */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Ingredients</h2>
          <ul className="space-y-1.5">
            {recipe.ingredients.map((ing) => {
              const substitute = ingredientSwaps.get(ing.id);
              const qty = [ing.quantity, ing.unit].filter(Boolean).join(' ');

              return (
                <li key={ing.id} className="flex items-baseline gap-2 text-sm">
                  <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
                    {qty || '—'}
                  </span>
                  {substitute ? (
                    <span>
                      <span className="line-through text-muted-foreground/60">{ing.name}</span>
                      {' '}
                      <span className="font-semibold text-amber-700">{substitute}</span>
                      <span className="ml-1.5 text-xs px-1 py-0.5 bg-amber-100 text-amber-700 rounded">
                        swap
                      </span>
                    </span>
                  ) : (
                    <span>{ing.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Instructions */}
        {recipe.instructions && (
          <div>
            <h2 className="text-sm font-semibold mb-3">Instructions</h2>
            <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
              {hasSwaps
                ? highlightSwaps(recipe.instructions).map((part, i) =>
                    part.swap ? (
                      <span key={i} className="inline-block align-baseline">
                        <span className="line-through text-muted-foreground/60">{part.text}</span>
                        {' '}
                        <span className="font-semibold text-amber-700">{part.swap.substitute}</span>
                        <span className="ml-1 text-xs px-1 py-0.5 bg-amber-100 text-amber-700 rounded align-middle">
                          swap
                        </span>
                        {' '}
                      </span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )
                : recipe.instructions}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
