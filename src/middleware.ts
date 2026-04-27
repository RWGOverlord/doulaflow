// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/login';

  // Check for Supabase session cookie
  // Supabase stores the session in a cookie that starts with 'sb-'
  const hasSbCookie = request.cookies.getAll().some(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  );

  // Also check the legacy cookie format
  const hasSession = hasSbCookie ||
    request.cookies.has('supabase-auth-token') ||
    request.cookies.getAll().some(c => c.name.includes('auth-token'));

  // Not logged in and not on login page → redirect to login
  if (!hasSession && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Already logged in and on login page → redirect to clients
  if (hasSession && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/clients';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};