import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { z } from 'zod';

const importUrlSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

// ── Ingredient parsing ─────────────────────────────────────────────────────

const UNITS = [
  'tsp', 'tsps', 'teaspoon', 'teaspoons',
  'tbsp', 'tbsps', 'tablespoon', 'tablespoons',
  'cup', 'cups',
  'oz', 'ounce', 'ounces',
  'fl oz', 'fluid ounce', 'fluid ounces',
  'lb', 'lbs', 'pound', 'pounds',
  'g', 'gram', 'grams',
  'kg', 'kilogram', 'kilograms',
  'ml', 'milliliter', 'milliliters',
  'l', 'liter', 'liters',
  'pinch', 'pinches',
  'dash', 'dashes',
  'clove', 'cloves',
  'can', 'cans',
  'package', 'packages', 'pkg',
  'bunch', 'bunches',
  'slice', 'slices',
  'piece', 'pieces',
  'whole',
  'large', 'medium', 'small',
  'head', 'heads',
  'sprig', 'sprigs',
  'stalk', 'stalks',
  'handful', 'handfuls',
  'jar', 'jars',
  'bag', 'bags',
  'box', 'boxes',
  'bottle', 'bottles',
  'stick', 'sticks',
  'quart', 'quarts', 'qt',
  'pint', 'pints', 'pt',
  'gallon', 'gallons', 'gal',
];

function parseIngredientString(raw: string): { name: string; quantity: string; unit: string } {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { name: '', quantity: '', unit: '' };

  // Sort units by length (longest first) to match "fluid ounces" before "ounces"
  const sortedUnits = [...UNITS].sort((a, b) => b.length - a.length);
  const unitPattern = sortedUnits.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  // Pattern: optional quantity (numbers, fractions, unicode fractions, ranges) then optional unit then name
  const regex = new RegExp(
    `^([\\d¼½¾⅓⅔⅛⅜⅝⅞\\s./\\-–]+)?\\s*(${unitPattern})\\.?\\s+(.+)$`,
    'i'
  );

  const match = trimmed.match(regex);
  if (match) {
    return {
      quantity: (match[1] || '').trim(),
      unit: match[2].trim().toLowerCase(),
      name: match[3].trim(),
    };
  }

  // Simpler pattern: just a number/fraction followed by name (no unit)
  const simpleMatch = trimmed.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\s./\-–]+)\s+(.+)$/);
  if (simpleMatch && simpleMatch[1].trim()) {
    return {
      quantity: simpleMatch[1].trim(),
      unit: '',
      name: simpleMatch[2].trim(),
    };
  }

  // No quantity/unit detected — entire string is the ingredient name
  return { quantity: '', unit: '', name: trimmed };
}

// ── Protein guessing ────────────────────────────────────────────────────────

const PROTEIN_KEYWORDS: Record<string, string[]> = {
  chicken: ['chicken', 'poultry', 'drumstick', 'thigh', 'breast', 'wing'],
  steak: ['beef', 'steak', 'ground beef', 'sirloin', 'ribeye', 'filet', 'brisket', 'chuck'],
  pork: ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'sausage', 'chorizo'],
  seafood: ['shrimp', 'salmon', 'fish', 'tuna', 'crab', 'lobster', 'scallop', 'cod', 'tilapia', 'halibut', 'mahi', 'prawn', 'clam', 'mussel', 'oyster', 'squid', 'calamari', 'anchov'],
  tofu: ['tofu', 'tempeh', 'seitan'],
  egg: ['egg', 'eggs'],
};

function guessProteins(name: string, ingredients: string[]): string[] {
  const allText = [name, ...ingredients].join(' ').toLowerCase();
  const found: string[] = [];

  for (const [protein, keywords] of Object.entries(PROTEIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        if (!found.includes(protein)) found.push(protein);
        break;
      }
    }
  }

  return found;
}

// ── Cuisine guessing ────────────────────────────────────────────────────────

const CUISINE_KEYWORDS: Record<string, string[]> = {
  mexican: ['taco', 'burrito', 'enchilada', 'quesadilla', 'salsa', 'guacamole', 'jalapeño', 'chipotle', 'tortilla', 'fajita', 'mexican', 'tex-mex', 'cilantro lime'],
  italian: ['pasta', 'spaghetti', 'lasagna', 'risotto', 'parmesan', 'pesto', 'marinara', 'bruschetta', 'italian', 'bolognese', 'carbonara', 'alfredo', 'gnocchi', 'prosciutto'],
  asian: ['stir fry', 'stir-fry', 'teriyaki', 'soy sauce', 'ginger', 'sesame', 'wok', 'noodle', 'dumpling', 'fried rice', 'pad thai', 'ramen', 'pho', 'bibimbap', 'kimchi', 'miso', 'wasabi', 'szechuan', 'kung pao', 'lo mein', 'chow mein', 'thai', 'chinese', 'japanese', 'korean', 'vietnamese'],
  mediterranean: ['hummus', 'falafel', 'tahini', 'pita', 'olive oil', 'feta', 'tzatziki', 'shawarma', 'kebab', 'greek', 'mediterranean', 'couscous', 'harissa'],
  indian: ['curry', 'tikka', 'masala', 'naan', 'tandoori', 'biryani', 'samosa', 'chutney', 'turmeric', 'garam', 'dal', 'paneer', 'vindaloo', 'korma', 'indian'],
  american: ['burger', 'bbq', 'barbecue', 'mac and cheese', 'fried chicken', 'cornbread', 'biscuit', 'gravy', 'meatloaf', 'pot roast', 'pulled pork', 'coleslaw', 'american'],
};

function guessCuisine(name: string, ingredients: string[]): string {
  const allText = [name, ...ingredients].join(' ').toLowerCase();

  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) return cuisine;
    }
  }

  return 'other';
}

// ── Tag inference ───────────────────────────────────────────────────────────

const TAG_KEYWORDS: Record<string, string[]> = {
  dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'sour cream', 'whey', 'cheddar', 'mozzarella', 'parmesan', 'ricotta', 'feta', 'brie', 'gouda', 'ghee', 'half-and-half', 'heavy cream', 'whipped cream', 'cottage cheese', 'cream cheese'],
  gluten: ['flour', 'bread', 'pasta', 'spaghetti', 'noodle', 'tortilla', 'cracker', 'breadcrumb', 'panko', 'wheat', 'barley', 'rye', 'couscous', 'orzo', 'pita', 'naan', 'biscuit', 'croissant', 'pie crust', 'pizza dough', 'soy sauce'],
  nuts: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'peanut', 'hazelnut', 'macadamia', 'pine nut', 'chestnut'],
  soy: ['soy sauce', 'soy', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari'],
  eggs: ['egg', 'eggs', 'mayonnaise', 'mayo'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop', 'crawfish', 'crayfish'],
  pork: ['bacon', 'ham', 'prosciutto', 'pancetta', 'pork', 'sausage', 'chorizo', 'lard'],
  beef: ['beef', 'steak', 'ground beef', 'sirloin', 'ribeye', 'brisket'],
};

function guessTags(ingredients: string[]): string[] {
  const allText = ingredients.join(' ').toLowerCase();
  const tags: string[] = [];

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        if (!tags.includes(tag)) tags.push(tag);
        break;
      }
    }
  }

  return tags;
}

// ── Item type guessing ──────────────────────────────────────────────────────

const SWEET_SNACK_KEYWORDS = ['cookie', 'cake', 'muffin', 'brownie', 'dessert', 'sweet', 'chocolate', 'ice cream', 'pudding', 'pie', 'tart', 'candy', 'fudge', 'pastry', 'donut', 'doughnut', 'cupcake', 'scone', 'crisp', 'crumble', 'parfait', 'energy bite', 'energy ball', 'truffle'];
const SAVORY_SNACK_KEYWORDS = ['dip', 'hummus', 'guacamole', 'crackers', 'chips', 'popcorn', 'pretzel', 'trail mix', 'granola bar', 'protein bar', 'cheese ball', 'deviled egg', 'bruschetta', 'flatbread'];

function guessItemType(name: string, category: string): string {
  const allText = [name, category].join(' ').toLowerCase();

  for (const keyword of SWEET_SNACK_KEYWORDS) {
    if (allText.includes(keyword)) return 'sweet-snack';
  }
  for (const keyword of SAVORY_SNACK_KEYWORDS) {
    if (allText.includes(keyword)) return 'savory-snack';
  }

  if (allText.includes('snack') || allText.includes('appetizer') || allText.includes('side')) {
    return 'savory-snack';
  }

  return 'meal';
}

// ── JSON-LD extraction ──────────────────────────────────────────────────────

interface ImportedRecipe {
  name: string;
  description: string;
  instructions: string;
  cuisineType: string;
  itemType: string;
  servingSize: number;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  proteinSwaps: string[];
  tags: string[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractFromJsonLd($: cheerio.CheerioAPI): ImportedRecipe | null {
  const scripts = $('script[type="application/ld+json"]');
  let recipeData: any = null;

  scripts.each((_, el) => {
    if (recipeData) return; // already found
    try {
      const json = JSON.parse($(el).text());

      // Could be a single object or an array or a @graph
      const candidates = Array.isArray(json)
        ? json
        : json['@graph']
          ? json['@graph']
          : [json];

      for (const item of candidates) {
        const type = item['@type'];
        if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
          recipeData = item;
          break;
        }
      }
    } catch {
      // ignore invalid JSON
    }
  });

  if (!recipeData) return null;

  // Parse name
  const name = (recipeData.name || '').trim();

  // Parse description
  const description = (recipeData.description || '').trim();

  // Parse instructions
  let instructions = '';
  if (Array.isArray(recipeData.recipeInstructions)) {
    instructions = recipeData.recipeInstructions
      .map((step: any, i: number) => {
        if (typeof step === 'string') return `${i + 1}. ${step.trim()}`;
        if (step.text) return `${i + 1}. ${step.text.trim()}`;
        if (step.name) return `${i + 1}. ${step.name.trim()}`;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  } else if (typeof recipeData.recipeInstructions === 'string') {
    instructions = recipeData.recipeInstructions.trim();
  }

  // Parse ingredients
  const rawIngredients: string[] = Array.isArray(recipeData.recipeIngredient)
    ? recipeData.recipeIngredient
    : [];
  const ingredients = rawIngredients.map(parseIngredientString).filter((i) => i.name);

  // Parse serving size
  let servingSize = 1;
  const yieldStr = recipeData.recipeYield;
  if (yieldStr) {
    const yieldVal = Array.isArray(yieldStr) ? yieldStr[0] : yieldStr;
    const parsed = parseInt(String(yieldVal), 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) servingSize = parsed;
  }

  // Parse category / cuisine
  const recipeCuisine = (recipeData.recipeCuisine || '').toLowerCase();
  const recipeCategory = (
    Array.isArray(recipeData.recipeCategory)
      ? recipeData.recipeCategory.join(' ')
      : recipeData.recipeCategory || ''
  ).toLowerCase();

  const ingredientNames = rawIngredients.map((s) => s.toLowerCase());
  const cuisineType = recipeCuisine
    ? guessCuisine(recipeCuisine, [])
    : guessCuisine(name, ingredientNames);

  const itemType = guessItemType(name, recipeCategory);

  // Guess proteins and tags
  const proteinSwaps = guessProteins(name, ingredientNames);
  const tags = guessTags(rawIngredients);

  return {
    name,
    description,
    instructions,
    cuisineType,
    itemType,
    servingSize,
    ingredients,
    proteinSwaps,
    tags,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── HTML fallback extraction ────────────────────────────────────────────────

function extractFromHtml($: cheerio.CheerioAPI): ImportedRecipe | null {
  // Try microdata first, then common selectors
  let name =
    $('[itemprop="name"]').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    '';

  if (!name) return null;

  const description =
    $('[itemprop="description"]').first().text().trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    '';

  // Instructions
  let instructions = '';
  const instructionEls = $('[itemprop="recipeInstructions"]');
  if (instructionEls.length > 0) {
    const steps: string[] = [];
    instructionEls.each((i, el) => {
      const text = $(el).text().trim();
      if (text) steps.push(`${i + 1}. ${text}`);
    });
    instructions = steps.join('\n');
  }

  // Ingredients
  const ingredientEls = $('[itemprop="recipeIngredient"], [itemprop="ingredients"]');
  const rawIngredients: string[] = [];
  ingredientEls.each((_, el) => {
    const text = $(el).text().trim();
    if (text) rawIngredients.push(text);
  });

  // If no microdata ingredients, try common class names
  if (rawIngredients.length === 0) {
    $('li[class*="ingredient"], .ingredient, .recipe-ingredient').each((_, el) => {
      const text = $(el).text().trim();
      if (text) rawIngredients.push(text);
    });
  }

  const ingredients = rawIngredients.map(parseIngredientString).filter((i) => i.name);

  // Serving size
  let servingSize = 1;
  const yieldText = $('[itemprop="recipeYield"]').first().text().trim();
  if (yieldText) {
    const parsed = parseInt(yieldText, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) servingSize = parsed;
  }

  const ingredientNames = rawIngredients.map((s) => s.toLowerCase());
  const cuisineType = guessCuisine(name, ingredientNames);
  const itemType = guessItemType(name, '');
  const proteinSwaps = guessProteins(name, ingredientNames);
  const tags = guessTags(rawIngredients);

  return {
    name,
    description,
    instructions,
    cuisineType,
    itemType,
    servingSize,
    ingredients,
    proteinSwaps,
    tags,
  };
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = importUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please provide a valid URL' },
        { status: 400 }
      );
    }

    // Fetch the page HTML with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(parsed.data.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MenuGenerator/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timeout);
    } catch {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: 'Could not reach the URL. Check the link and try again.' },
        { status: 422 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Page returned error ${response.status}. Check the link and try again.` },
        { status: 422 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try JSON-LD first, then HTML fallback
    let recipeData = extractFromJsonLd($);
    if (!recipeData) {
      recipeData = extractFromHtml($);
    }

    if (!recipeData || !recipeData.name) {
      return NextResponse.json(
        { error: 'No recipe data found on this page. You may need to enter it manually.' },
        { status: 422 }
      );
    }

    return NextResponse.json(recipeData);
  } catch {
    return NextResponse.json(
      { error: 'Failed to import recipe. Please try again.' },
      { status: 500 }
    );
  }
}
