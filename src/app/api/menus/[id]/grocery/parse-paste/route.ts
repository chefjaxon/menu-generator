export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { parsePastedText } from '@/lib/grocery-utils';
import { parsePasteSchema } from '@/lib/validations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const body = await request.json();
  const parsed = parsePasteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const lines = parsePastedText(parsed.data.text);
  return NextResponse.json(lines);
}
