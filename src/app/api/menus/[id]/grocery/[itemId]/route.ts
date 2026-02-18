export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { updateGroceryItem, deleteGroceryItem } from '@/lib/queries/grocery';
import { groceryItemUpdateSchema } from '@/lib/validations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  const body = await request.json();
  const parsed = groceryItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const item = await updateGroceryItem(itemId, parsed.data);
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;
  const ok = await deleteGroceryItem(itemId);
  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
