import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

const protectedPaths = ['/', '/calendar'];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/calendar/:path*', '/login'],
};
