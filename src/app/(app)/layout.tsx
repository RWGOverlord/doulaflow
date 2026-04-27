// src/app/(app)/layout.tsx
'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarNav } from '@/components/SidebarNav';
import { useAuth } from '@/lib/auth-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
