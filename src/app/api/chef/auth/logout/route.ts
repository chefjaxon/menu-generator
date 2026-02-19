import { NextRequest, NextResponse } from 'next/server';
import { destroyChefSession } from '@/lib/chef-auth';

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get('chef-session')?.value;
  if (token) {
    await destroyChefSession(token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('chef-session', '', { maxAge: 0, path: '/' });
  return res;
}
