import { NextRequest, NextResponse } from 'next/server';
import { getAllMenus, finalizeMenu } from '@/lib/queries/menus';
import { finalizeMenuSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId') || undefined;
  const menus = getAllMenus(clientId);
  return NextResponse.json(menus);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = finalizeMenuSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const menu = finalizeMenu(parsed.data.menuId, parsed.data.weekLabel);
  if (!menu) {
    return NextResponse.json({ error: 'Menu not found or already finalized' }, { status: 404 });
  }

  return NextResponse.json(menu);
}
