export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { mergeGroceryItems } from '@/lib/queries/grocery';
import { groceryMergeSchema } from '@/lib/validations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const body = await request.json();
  const parsed = groceryMergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { keepId, deleteId, name, quantity, unit, notes } = parsed.data;
  const item = await mergeGroceryItems(keepId, deleteId, {
    name,
    quantity: quantity ?? null,
    unit: unit ?? null,
    notes: notes ?? null,
  });
  if (!item) {
    return NextResponse.json({ error: 'Merge failed' }, { status: 500 });
  }
  return NextResponse.json(item);
}
