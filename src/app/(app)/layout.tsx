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
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

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
