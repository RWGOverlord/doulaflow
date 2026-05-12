'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Users, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusCount = { status: string; count: number };

type UpcomingAppt = {
  id: string;
  starts_at: string;
  clients: { name: string } | null;
  appointment_types: { name: string } | null;
};

type PackageRow = {
  status: string;
  packages: { price: number | null } | null;
};

type InsightsData = {
  totalClients: number;
  clientsByStatus: StatusCount[];
  upcomingAppts: UpcomingAppt[];
  activeRevenue: number;
  totalRevenue: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekBounds() {
  const now   = new Date();
  const day   = now.getDay(); // 0 = Sun
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-US');
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  Active:     'bg-emerald-500',
  Onboarding: 'bg-sky-500',
  'On Call':  'bg-amber-500',
  'In Labor': 'bg-red-500',
  Postpartum: 'bg-purple-500',
  Completed:  'bg-neutral-400',
  Inactive:   'bg-neutral-300',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-5 flex items-start gap-4">
      <div className={clsx('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [data, setData]       = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const orgId        = process.env.NEXT_PUBLIC_ORG_ID!;
      const { start, end } = weekBounds();

      const [clientsRes, apptsRes, packagesRes] = await Promise.all([
        supabase.from('clients').select('status').eq('org_id', orgId),
        supabase
          .from('appointments')
          .select('id, starts_at, clients(name), appointment_types(name)')
          .eq('status', 'scheduled')
          .gte('starts_at', start)
          .lte('starts_at', end)
          .order('starts_at', { ascending: true }),
        supabase
          .from('client_packages')
          .select('status, packages(price)'),
      ]);

      // Clients by status
      const clients = clientsRes.data ?? [];
      const statusMap: Record<string, number> = {};
      for (const c of clients) {
        statusMap[c.status] = (statusMap[c.status] ?? 0) + 1;
      }
      const clientsByStatus = Object.entries(statusMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      // Revenue
      const pkgs = (packagesRes.data ?? []) as PackageRow[];
      const activeRevenue = pkgs
        .filter(p => p.status === 'active')
        .reduce((sum, p) => sum + (p.packages?.price ?? 0), 0);
      const totalRevenue = pkgs
        .reduce((sum, p) => sum + (p.packages?.price ?? 0), 0);

      setData({
        totalClients:    clients.length,
        clientsByStatus,
        upcomingAppts:   (apptsRes.data ?? []) as UpcomingAppt[],
        activeRevenue,
        totalRevenue,
      });
      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-8 py-6 border-b bg-background">
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground mt-0.5">A snapshot of your practice</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Total Clients"
                value={data.totalClients}
                color="bg-sky-500"
              />
              <StatCard
                icon={Calendar}
                label="Appointments This Week"
                value={data.upcomingAppts.length}
                sub={data.upcomingAppts.length === 1 ? '1 scheduled' : `${data.upcomingAppts.length} scheduled`}
                color="bg-violet-500"
              />
              <StatCard
                icon={DollarSign}
                label="Active Package Revenue"
                value={fmtCurrency(data.activeRevenue)}
                sub={`${data.clientsByStatus.find(s => s.status === 'Active')?.count ?? 0} active clients`}
                color="bg-emerald-500"
              />
              <StatCard
                icon={TrendingUp}
                label="Total Package Revenue"
                value={fmtCurrency(data.totalRevenue)}
                sub="all packages combined"
                color="bg-amber-500"
              />
            </div>

            {/* Lower row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Clients by status */}
              <div className="rounded-xl border bg-background overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h2 className="text-sm font-semibold">Clients by Status</h2>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {data.clientsByStatus.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No clients yet.</p>
                  ) : data.clientsByStatus.map(({ status, count }) => {
                    const pct = Math.round((count / data.totalClients) * 100);
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="font-medium">{status}</span>
                          <span className="text-muted-foreground tabular-nums">{count} · {pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full transition-all', STATUS_COLORS[status] ?? 'bg-primary')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming appointments */}
              <div className="rounded-xl border bg-background overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h2 className="text-sm font-semibold">Appointments This Week</h2>
                </div>
                {data.upcomingAppts.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-muted-foreground">No appointments scheduled this week.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {data.upcomingAppts.map(appt => (
                      <div key={appt.id} className="flex items-center gap-4 px-5 py-3">
                        <div className="text-center min-w-[40px]">
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            {new Date(appt.starts_at).toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="text-lg font-semibold leading-tight text-primary">
                            {new Date(appt.starts_at).getDate()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {appt.clients?.name ?? '—'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {appt.appointment_types?.name ?? 'Appointment'} · {fmtTime(appt.starts_at)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {fmtDay(appt.starts_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
