import { notFound } from 'next/navigation';
import { getRecipeById } from '@/lib/queries/recipes';
import { RecipeForm } from '@/components/recipes/recipe-form';

export const dynamic = 'force-dynamic';

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Recipe</h1>
      <RecipeForm recipe={recipe} />
    </div>
  );
}
