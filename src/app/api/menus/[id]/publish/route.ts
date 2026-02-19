import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { publishMenu } from '@/lib/queries/menus';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await publishMenu(id);

  if (!result) {
    return NextResponse.json({ error: 'Failed to publish menu' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, clientToken: result.clientToken });
}
