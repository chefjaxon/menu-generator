import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and Next.js internals — always allow
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Client-facing public routes — no auth needed
  if (
    pathname === '/client/login' ||
    pathname.startsWith('/client/menu/') ||
    pathname.startsWith('/client/pantry/') ||
    pathname.startsWith('/api/client/auth/') ||
    pathname.startsWith('/api/client/menu/') ||
    pathname.startsWith('/api/client/pantry/')
  ) {
    return NextResponse.next();
  }

  // Client portal authenticated routes
  if (pathname.startsWith('/client')) {
    const clientToken = request.cookies.get('client-session')?.value;
    if (!clientToken) {
      const loginUrl = new URL('/client/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Admin routes — allow login and auth API
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  // Admin session check
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
