import { RecipeForm } from '@/components/recipes/recipe-form';

export default function NewRecipePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Recipe</h1>
      <RecipeForm />
    </div>
  );
}
