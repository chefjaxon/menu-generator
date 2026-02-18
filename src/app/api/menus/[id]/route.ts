export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getMenuById, deleteMenu } from '@/lib/queries/menus';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const menu = await getMenuById(id);
  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 });
  }
  return NextResponse.json(menu);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteMenu(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
