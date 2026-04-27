// src/app/layout.tsx
import "./globals.css";
import { Suspense } from "react";
import { Providers } from "./providers";
import { SidebarNav } from "@/components/SidebarNav";

export const metadata = {
  title: "DoulaFlow",
  description: "Doula practice management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            {/* Left Sidebar */}
            <SidebarNav />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <main className="flex-1 overflow-y-auto">
                <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
                  {children}
                </Suspense>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
