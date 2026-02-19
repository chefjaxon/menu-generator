export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { parseIngredientLine } from '@/lib/grocery-utils';
import { scrapeRecipeSchema } from '@/lib/validations';

interface ScrapedIngredient {
  name: string;
  quantity: string;
  unit: string;
}

async function generateDescription(
  name: string,
  ingredients: string[],
  instructions: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `Given these ingredients and instructions from a recipe called "${name}", write a 1-2 sentence appetizing description of the dish. Be concise and focus on what makes it appealing.\n\nIngredients:\n${ingredients.slice(0, 20).join('\n')}\n\nInstructions:\n${instructions.slice(0, 500)}`,
          },
        ],
      }),
    });

    clearTimeout(timeout);
    if (!response.ok) return '';

    const data = await response.json();
    const text: string = data?.content?.[0]?.text ?? '';
    return text.trim();
  } catch {
    return '';
  }
}

async function scrapeRecipePage(url: string): Promise<{
  name: string | null;
  rawIngredients: string[];
  instructions: string | null;
  servingSize: number | null;
}> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Failed to fetch page (status ${res.status})`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // --- Title ---
  const name =
    $('[class*="recipe-title"]').first().text().trim() ||
    $('[class*="recipeName"]').first().text().trim() ||
    $('[class*="recipe-name"]').first().text().trim() ||
    $('h1').first().text().trim() ||
    null;

  // --- Ingredients ---
  const rawIngredients: string[] = [];
  const ingredientSelectors = [
    '[class*="ingredient"] li',
    '[id*="ingredient"] li',
    'ul.ingredients li',
    '[class*="Ingredient"] li',
  ];
  for (const sel of ingredientSelectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text) rawIngredients.push(text);
    });
    if (rawIngredients.length > 0) break;
  }

  // --- Instructions ---
  const instructionParts: string[] = [];
  const instructionSelectors = [
    '[class*="instruction"] p',
    '[class*="instruction"] li',
    '[class*="direction"] p',
    '[class*="direction"] li',
    '[class*="Direction"] li',
    '[class*="step"] p',
    '[class*="step"] li',
  ];
  for (const sel of instructionSelectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text) instructionParts.push(text);
    });
    if (instructionParts.length > 0) break;
  }
  const instructions = instructionParts.length > 0 ? instructionParts.join('\n\n') : null;

  // --- Serving size ---
  let servingSize: number | null = null;
  const servingSelectors = ['[class*="serving"]', '[class*="yield"]', '[class*="portion"]'];
  for (const sel of servingSelectors) {
    $(sel).each((_, el) => {
      const text = $(el).text();
      const match = text.match(/(\d+)/);
      if (match) {
        servingSize = parseInt(match[1], 10);
        return false; // break out of each
      }
    });
    if (servingSize !== null) break;
  }

  return { name, rawIngredients, instructions, servingSize };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = scrapeRecipeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const { name, rawIngredients, instructions, servingSize } = await scrapeRecipePage(parsed.data.url);

    const ingredients: ScrapedIngredient[] = rawIngredients
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const parsed = parseIngredientLine(line);
        return {
          name: parsed.name,
          quantity: parsed.quantity ?? '',
          unit: parsed.unit ?? '',
        };
      });

    let description = '';
    if (name && ingredients.length > 0 && instructions) {
      description = await generateDescription(name, rawIngredients, instructions);
    }

    return NextResponse.json({
      name,
      description,
      instructions,
      servingSize,
      ingredients,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch recipe page';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
