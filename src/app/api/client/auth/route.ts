import { NextRequest, NextResponse } from 'next/server';
import { loginClientByEmail } from '@/lib/client-auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const result = await loginClientByEmail(email, password);

  if (!result) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, clientId: result.clientId });
  response.cookies.set('client-session', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return response;
}

export async function DELETE(request: NextRequest) {
  const { destroyClientSession } = await import('@/lib/client-auth');
  const token = request.cookies.get('client-session')?.value;
  if (token) await destroyClientSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete('client-session');
  return response;
}
