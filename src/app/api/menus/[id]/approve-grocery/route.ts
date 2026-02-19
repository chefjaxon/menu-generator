import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { approveGroceryList } from '@/lib/queries/menus';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await approveGroceryList(id);

  if (!result) {
    return NextResponse.json({ error: 'Failed to approve grocery list' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pantryToken: result.pantryToken });
}
