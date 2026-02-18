export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';

const saveSchema = z.object({
  entries: z.array(
    z.object({
      canonical: z.string().min(1).max(200),
      variants: z.array(z.string().min(1).max(200)).min(1),
    })
  ).min(1),
});

/**
 * POST /api/admin/save-aliases
 *
 * Accepts confirmed ingredient alias clusters and appends them to
 * src/lib/ingredient-aliases.ts under an "Imported from Recipe Keeper" section.
 *
 * Request body: { entries: Array<{ canonical: string, variants: string[] }> }
 * Response: { added: number, skipped: number }
 *
 * Existing entries are never modified; duplicates are skipped.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const aliasFilePath = resolve(process.cwd(), 'src/lib/ingredient-aliases.ts');
    const currentContent = readFileSync(aliasFilePath, 'utf-8');

    // Extract existing keys to avoid duplicates
    const existingKeys = new Set<string>();
    const keyMatches = currentContent.matchAll(/\[['"](.+?)['"]\s*,/g);
    for (const match of keyMatches) {
      existingKeys.add(match[1].toLowerCase().trim());
    }

    // Build new entries — skip any variant already in the table
    const newLines: string[] = [];
    let added = 0;
    let skipped = 0;

    for (const cluster of parsed.data.entries) {
      const clusterLines: string[] = [];
      for (const variant of cluster.variants) {
        const key = variant.toLowerCase().trim();
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }
        // Escape single quotes in the strings
        const escapedVariant = variant.replace(/'/g, "\\'");
        const escapedCanonical = cluster.canonical.replace(/'/g, "\\'");
        clusterLines.push(`  ['${escapedVariant}', '${escapedCanonical}'],`);
        existingKeys.add(key); // prevent duplicates within this batch too
        added++;
      }
      if (clusterLines.length > 0) {
        newLines.push(...clusterLines);
      }
    }

    if (newLines.length === 0) {
      return NextResponse.json({ added: 0, skipped, message: 'All entries already exist in the alias table.' });
    }

    // Insert new entries before the closing `]);` of the Map
    const insertionPoint = '\n]);';
    const importedSection = [
      '',
      '  // ── Imported from Recipe Keeper ─────────────────────────────────────────',
      ...newLines,
    ].join('\n');

    const updatedContent = currentContent.replace(
      /\n\]\);(\s*)$/,
      `${importedSection}\n]);$1`
    );

    if (updatedContent === currentContent) {
      // Fallback: couldn't find insertion point (unexpected file structure)
      return NextResponse.json(
        { error: 'Could not find insertion point in ingredient-aliases.ts. File may have been modified unexpectedly.' },
        { status: 500 }
      );
    }

    writeFileSync(aliasFilePath, updatedContent, 'utf-8');

    return NextResponse.json({
      added,
      skipped,
      message: `Successfully added ${added} new alias entries. ${skipped} were already present and skipped.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
