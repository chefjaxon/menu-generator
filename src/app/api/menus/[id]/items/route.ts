export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { setMenuItemSelected } from '@/lib/queries/menus';
import { toggleClientSelectedSchema } from '@/lib/validations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const body = await request.json();
  const parsed = toggleClientSelectedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const ok = await setMenuItemSelected(parsed.data.menuItemId, parsed.data.selected);
  if (!ok) {
    return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
