import { NextRequest, NextResponse } from 'next/server';
import { getMenuByPantryToken, submitPantryChecklist } from '@/lib/queries/menus';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { checkedItemIds, clientNotes } = body as {
    checkedItemIds: string[];
    clientNotes?: Record<string, string>;
  };

  if (!Array.isArray(checkedItemIds)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const menu = await getMenuByPantryToken(token);
  if (!menu || !menu.pantryToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (menu.pantrySubmitted) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  const ok = await submitPantryChecklist(menu.id, checkedItemIds, clientNotes);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
