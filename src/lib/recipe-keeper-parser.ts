import * as cheerio from 'cheerio';
import { parseIngredientLine } from './grocery-utils';

/**
 * Parse a Recipe Keeper HTML export and extract all unique raw ingredient names.
 *
 * Recipe Keeper HTML exports use one of two structures:
 *  1. Schema.org microdata — elements with itemprop="recipeIngredient"
 *  2. Plain HTML — <li> elements under a section/heading containing "Ingredients"
 *
 * Returns a sorted, deduplicated array of ingredient name strings with
 * quantities and units stripped (using the existing parseIngredientLine parser).
 */
export function parseRecipeKeeperHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const rawLines: string[] = [];

  // Strategy 1: Schema.org microdata (most reliable)
  $('[itemprop="recipeIngredient"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text) rawLines.push(text);
  });

  // Strategy 2: Plain <li> elements — look for sections with "ingredient" in the heading
  if (rawLines.length === 0) {
    // Find any heading (h1-h6, strong, or div with class containing "ingredient")
    const ingredientSectionHeadings = $('h1, h2, h3, h4, h5, h6, strong, .ingredient, [class*="ingredient"], [id*="ingredient"]').filter(
      (_, el) => {
        const text = $(el).text().trim().toLowerCase();
        return text.includes('ingredient');
      }
    );

    ingredientSectionHeadings.each((_, heading) => {
      // Walk forward siblings or parent's next siblings to find the <ul>/<ol>
      let container = $(heading).next();
      // Check siblings up to 3 levels
      for (let i = 0; i < 3 && container.length; i++) {
        if (container.is('ul, ol')) {
          container.find('li').each((_, li) => {
            const text = $(li).text().trim();
            if (text) rawLines.push(text);
          });
          break;
        }
        container = container.next();
      }

      // Also check if the heading's parent has a following ul/ol sibling
      if (rawLines.length === 0) {
        $(heading).parent().nextAll('ul, ol').first().find('li').each((_, li) => {
          const text = $(li).text().trim();
          if (text) rawLines.push(text);
        });
      }
    });
  }

  // Strategy 3: Broadest fallback — all <li> elements that look like ingredients
  // (contain at least one word and optionally a number or unit)
  if (rawLines.length === 0) {
    $('li').each((_, el) => {
      const text = $(el).text().trim();
      // Heuristic: ingredient lines are typically 2-100 chars and don't start with http
      if (text.length >= 2 && text.length <= 200 && !text.startsWith('http')) {
        rawLines.push(text);
      }
    });
  }

  // Extract just the ingredient NAME from each line (strip quantity + unit)
  const names: string[] = [];
  for (const line of rawLines) {
    const parsed = parseIngredientLine(line);
    if (parsed.name && parsed.name.length >= 2) {
      names.push(parsed.name.trim());
    }
  }

  // Deduplicate (case-insensitive) and sort
  const seen = new Map<string, string>();
  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, name);
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}
