// src/app/packages/page.tsx
'use client';

import Link from 'next/link';
import { usePackages } from '@/features/packages/hooks/usePackages';
import PackageCard from '@/features/packages/components/PackageCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function PackagesPage() {
  const { data = [], isLoading } = usePackages();

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.length} {data.length === 1 ? 'package' : 'packages'}
            </p>
          )}
        </div>
        <Link href="/packages/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Package
          </Button>
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center max-w-lg mx-auto mt-8">
            <div className="text-3xl mb-3">📦</div>
            <p className="font-medium text-muted-foreground">No packages yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Create reusable service packages to assign to clients
            </p>
            <Link href="/packages/new">
              <Button variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create your first package
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {data.map((p) => <PackageCard key={p.id} pkg={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
