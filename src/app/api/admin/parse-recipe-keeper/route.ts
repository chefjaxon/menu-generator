export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { parseRecipeKeeperHtml } from '@/lib/recipe-keeper-parser';
import { generateIngredientClusters } from '@/lib/alias-generator';

/**
 * POST /api/admin/parse-recipe-keeper
 *
 * Accepts a Recipe Keeper HTML export as multipart/form-data with a file field named "html".
 * Parses all ingredient names, runs Claude grouping analysis, and returns proposed clusters.
 *
 * Response: { ingredientCount: number, clusters: IngredientCluster[] }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('html');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No HTML file provided. Use field name "html".' }, { status: 400 });
    }

    const html = await (file as Blob).text();

    if (!html.trim()) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
    }

    // Step 1: Extract ingredient names from the HTML
    const ingredientNames = parseRecipeKeeperHtml(html);

    if (ingredientNames.length === 0) {
      return NextResponse.json({
        error: 'No ingredient names could be extracted from the HTML. Make sure this is a valid Recipe Keeper export.',
      }, { status: 422 });
    }

    // Step 2: Run Claude clustering analysis
    const clusters = await generateIngredientClusters(ingredientNames);

    return NextResponse.json({
      ingredientCount: ingredientNames.length,
      clusters,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
