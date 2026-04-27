// src/middleware.ts
// Minimal middleware - auth is handled client-side via AuthProvider
import { NextResponse } from 'next/server';

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};