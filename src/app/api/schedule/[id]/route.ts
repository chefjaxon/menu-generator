import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { updateScheduleEntry, deleteScheduleEntry } from '@/lib/queries/schedule';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const entry = await updateScheduleEntry(id, body);

  if (!entry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await deleteScheduleEntry(id);

  return NextResponse.json({ ok: true });
}
