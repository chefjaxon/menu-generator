import { NextRequest, NextResponse } from 'next/server';
import { getMenuByClientToken, submitClientSelections } from '@/lib/queries/menus';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { selections } = body as {
    selections: Array<{ menuItemId: string; note?: string }>;
  };

  if (!selections || !Array.isArray(selections)) {
    return NextResponse.json({ error: 'Invalid selections' }, { status: 400 });
  }

  const menu = await getMenuByClientToken(token);
  if (!menu || !menu.publishedAt) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 });
  }

  // Validate that all menuItemIds belong to this menu
  const validItemIds = new Set(menu.items.map((i) => i.id));
  for (const sel of selections) {
    if (!validItemIds.has(sel.menuItemId)) {
      return NextResponse.json({ error: 'Invalid menu item' }, { status: 400 });
    }
  }

  const ok = await submitClientSelections(menu.id, selections);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to save selections' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
