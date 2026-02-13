export type Protein = 'chicken' | 'steak' | 'pork' | 'seafood' | 'tofu' | 'vegetarian' | 'egg';
export type CuisineType = 'mexican' | 'italian' | 'asian' | 'mediterranean' | 'american' | 'indian' | 'other';
export type ItemType = 'meal' | 'sweet-snack' | 'savory-snack';

export const PROTEINS: Protein[] = ['chicken', 'steak', 'pork', 'seafood', 'tofu', 'vegetarian', 'egg'];
export const CUISINE_TYPES: CuisineType[] = ['mexican', 'italian', 'asian', 'mediterranean', 'american', 'indian', 'other'];
export const ITEM_TYPES: ItemType[] = ['meal', 'sweet-snack', 'savory-snack'];

// Common exclusion suggestions for the free-text restriction input
export const COMMON_EXCLUSIONS: string[] = [
  'dairy', 'gluten', 'nuts', 'soy', 'eggs', 'beef', 'pork', 'shellfish',
  'cilantro', 'mushrooms', 'olives', 'eggplant', 'spinach', 'beets',
  'artichokes', 'cherries', 'coffee', 'corn', 'cornstarch',
  'white sugar', 'honey', 'maple syrup', 'agave',
  'fermented foods', 'processed ingredients', 'white flour', 'white rice',
  'cod', 'salmon', 'shrimp',
];

export interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  sortOrder: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  cuisineType: CuisineType;
  itemType: ItemType;
  servingSize: number;
  createdAt: string;
  updatedAt: string;
  ingredients: Ingredient[];
  proteinSwaps: Protein[];
  tags: string[];
}

export interface CuisinePreference {
  cuisineType: CuisineType;
  weight: number;
}

export interface MenuComposition {
  category: string;
  count: number;
}

export interface Client {
  id: string;
  name: string;
  itemsPerMenu: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  proteins: Protein[];
  restrictions: string[];
  cuisinePreferences: CuisinePreference[];
  menuComposition: MenuComposition[];
}

export interface MenuItem {
  id: string;
  menuId: string;
  recipeId: string;
  selectedProtein: Protein | null;
  sortOrder: number;
  recipe?: Recipe;
}

export interface Menu {
  id: string;
  clientId: string;
  clientName?: string;
  createdAt: string;
  finalized: boolean;
  weekLabel: string | null;
  items: MenuItem[];
}

export interface SwapSuggestion {
  recipe: Recipe;
  score: number;
  availableProteins: Protein[];
}

export interface GenerateResult {
  menu: Menu;
  warnings: string[];
}
