// src/app/(app)/layout.tsx
import { Suspense } from "react";
import { SidebarNav } from "@/components/SidebarNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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