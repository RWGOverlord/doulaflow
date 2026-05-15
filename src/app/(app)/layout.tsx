// src/app/(app)/layout.tsx
'use client';

import { Component, Suspense, useEffect } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarNav } from '@/components/SidebarNav';
import { useAuth } from '@/lib/auth-context';

// ─── Inline ErrorBoundary ─────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, profileError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect when auth is fully resolved, there is no user, AND the
    // absence of a user is not due to a profile load error. A profileError means
    // a valid Supabase session exists but the DB profile failed — redirecting to
    // /login in that state creates a silent lockout loop.
    if (!loading && !user && !profileError) {
      router.replace('/login');
    }
  }, [user, loading, profileError, router]);

  // Show skeleton while session is rehydrating
  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="w-56 border-r bg-background shrink-0" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Profile loaded but DB row missing or errored — show message, don't redirect
  if (profileError) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <h2 className="text-lg font-semibold">Unable to load account</h2>
          <p className="text-sm text-muted-foreground">{profileError}</p>
        </div>
      </div>
    );
  }

  // No user after loading done — redirect fires via useEffect
  if (!user) return null;

  const errorFallback = (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        This page crashed. Use the sidebar to navigate elsewhere.
      </p>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary fallback={errorFallback}>
            <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
