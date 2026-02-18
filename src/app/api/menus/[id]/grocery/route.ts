export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getGroceryItemsForMenu, createGroceryItem } from '@/lib/queries/grocery';
import { groceryItemCreateSchema } from '@/lib/validations';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = await getGroceryItemsForMenu(id);
  return NextResponse.json(items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = groceryItemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const item = await createGroceryItem({ menuId: id, ...parsed.data });
  return NextResponse.json(item, { status: 201 });
}
