export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { restoreRemovedItem } from '@/lib/queries/grocery';
import { z } from 'zod';

const restoreSchema = z.object({
  itemId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // ensure dynamic params are resolved
  const body = await request.json();
  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const item = await restoreRemovedItem(parsed.data.itemId);
  if (!item) {
    return NextResponse.json({ error: 'Not found or already restored' }, { status: 404 });
  }
  return NextResponse.json(item);
}
