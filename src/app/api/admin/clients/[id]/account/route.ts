import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { createClientAccount } from '@/lib/client-auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;
  const { email, password } = await request.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: 'Email and password (min 8 chars) required' },
      { status: 400 }
    );
  }

  // Check if account already exists
  const existing = await prisma.clientAccount.findUnique({
    where: { clientId },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Client account already exists' },
      { status: 409 }
    );
  }

  try {
    await createClientAccount(clientId, email, password);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;

  try {
    await prisma.clientAccount.delete({ where: { clientId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }
}
