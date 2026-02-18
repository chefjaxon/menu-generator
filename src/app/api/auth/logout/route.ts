export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('menu-gen-session')?.value;

  if (token) {
    await destroySession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('menu-gen-session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Delete cookie
  });

  return response;
}
