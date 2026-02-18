import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getAllRecipes } from '@/lib/queries/recipes';
import { RecipeTable } from '@/components/recipes/recipe-table';

export const dynamic = 'force-dynamic';

export default async function RecipesPage() {
  const recipes = await getAllRecipes();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Recipes</h1>
        <Link
          href="/recipes/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Recipe
        </Link>
      </div>
      <RecipeTable recipes={recipes} />
    </div>
  );
}
