export type CuisineType = 'mexican' | 'italian' | 'asian' | 'mediterranean' | 'american' | 'indian' | 'other';
export type ItemType = 'meal' | 'sweet-snack' | 'savory-snack';

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

export type IngredientRole = 'core' | 'optional';

export interface IngredientSwap {
  id: string;
  substituteIngredient: string;
  restriction: string;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  role: IngredientRole;
  swaps: IngredientSwap[];
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
  recipeKeeperUrl: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: Ingredient[];
  proteinSwaps: string[];
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
  chefNotes: string | null;
  servingsPerDish: number;
  dishCount: number;
  createdAt: string;
  updatedAt: string;
  proteins: string[];
  restrictions: string[];
  cuisinePreferences: CuisinePreference[];
  menuComposition: MenuComposition[];
}

export interface IngredientSwapCallout {
  original: string;
  substitute: string;
}

export interface MenuItem {
  id: string;
  menuId: string;
  recipeId: string;
  selectedProtein: string | null;
  sortOrder: number;
  clientSelected: boolean;
  omitNotes?: string[];
  clientNote?: string | null;
  recipe?: Recipe;
  applicableSwaps?: IngredientSwapCallout[];
}

export type GrocerySource = 'recipe' | 'manual' | 'removed';

export interface GroceryItem {
  id: string;
  menuId: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  source: GrocerySource;
  recipeItemId: string | null;
  notes: string | null;
  sortOrder: number;
  category: string;
  createdAt: string;
}

export interface RemovedItem {
  id: string;
  menuId: string;
  name: string;
  recipeItemId: string | null;
}

export interface GenerateGroceryResponse {
  items: GroceryItem[];
  removedItems: RemovedItem[];
}

export interface DuplicatePair {
  itemA: GroceryItem;
  itemB: GroceryItem;
  similarity: number;
}

export interface Menu {
  id: string;
  clientId: string;
  clientName?: string;
  createdAt: string;
  finalized: boolean;
  weekLabel: string | null;
  groceryGenerated: boolean;
  publishedAt: string | null;
  clientToken: string | null;
  pantryToken: string | null;
  pantrySubmitted: boolean;
  items: MenuItem[];
  clientRestrictions?: string[];
}

export interface SwapSuggestion {
  recipe: Recipe;
  score: number;
  availableProteins: string[];
  omitNotes: string[];
}

export interface GenerateResult {
  menu: Menu;
  warnings: string[];
  omitNotes: Record<string, string[]>;  // menuItemId -> list of omit instructions
}
