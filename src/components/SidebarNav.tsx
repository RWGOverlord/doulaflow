// src/components/SidebarNav.tsx
"use client";

import { useMemo, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Users, Package, Calendar, FileText,
  BarChart2, Settings, Activity,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const navItems = [
  { href: "/clients",   label: "Clients",   icon: Users },
  { href: "/packages",  label: "Packages",  icon: Package },
  { href: "/calendar",  label: "Calendar",  icon: Calendar },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/invoices",  label: "Invoices",  icon: Activity },
  { href: "/insights",  label: "Insights",  icon: BarChart2 },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function SidebarNav() {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);

  const section = useMemo(() => {
    const seg = pathname?.split("/").filter(Boolean)[0] ?? "";
    return `/${seg}`;
  }, [pathname]);

  useEffect(() => {
    const userId = process.env.NEXT_PUBLIC_USER_ID;
    if (!userId) return;
    supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.name) setUserName(data.name);
      });
  }, []);

  const displayName     = userName ?? 'Doula';
  const displayInitials = initials(displayName);

  return (
    <aside className="w-56 border-r bg-background flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b">
        <span className="text-lg font-semibold tracking-tight text-foreground">
          DoulaFlow
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = section === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            {displayInitials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
            <div className="text-xs text-muted-foreground">Doula</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
