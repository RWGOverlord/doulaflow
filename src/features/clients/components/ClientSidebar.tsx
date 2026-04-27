// src/features/clients/components/ClientSidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Phone, Mail, Baby, Calendar, MapPin } from 'lucide-react';
import type { ClientProfile } from '../hooks/useClientProfile';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivePackage = {
  name: string;
  price: number | null;
  tags: string[];
  appt_count: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Onboarding: { bg: 'bg-sky-50',      text: 'text-sky-700',     dot: 'bg-sky-500' },
  Active:     { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'On Call':  { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
  'In Labor': { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },
  Postpartum: { bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500' },
  Completed:  { bg: 'bg-neutral-100', text: 'text-neutral-500', dot: 'bg-neutral-400' },
  Inactive:   { bg: 'bg-neutral-100', text: 'text-neutral-400', dot: 'bg-neutral-300' },
};
const DEFAULT_STATUS = { bg: 'bg-neutral-100', text: 'text-neutral-500', dot: 'bg-neutral-400' };

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function gestAge(dueISO?: string | null) {
  if (!dueISO) return null;
  const ms  = 86_400_000;
  const t0  = new Date(); const due = new Date(dueISO);
  const a   = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()).getTime();
  const b   = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const until = Math.floor((b - a) / ms);
  if (until >= 0) {
    const days = Math.min(280, Math.max(0, 280 - until));
    return { label: `${Math.floor(days / 7)}w ${days % 7}d`, pastDue: false };
  }
  return { label: `40w +${Math.abs(until)}d`, pastDue: true };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientSidebar({ client }: { client: ClientProfile }) {
  const pill   = STATUS_STYLES[client.status] ?? DEFAULT_STATUS;
  const ga     = gestAge(client.due_date);
  const [activePkg, setActivePkg] = useState<ActivePackage | null>(null);

  useEffect(() => {
    supabase
      .from('client_packages')
      .select(`
        packages (
          name, price, tags,
          package_appointment_types ( id )
        )
      `)
      .eq('client_id', client.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }: any) => {
        const pkg = data?.packages;
        if (!pkg) return;
        setActivePkg({
          name:       pkg.name,
          price:      pkg.price,
          tags:       pkg.tags ?? [],
          appt_count: (pkg.package_appointment_types ?? []).length,
        });
      });
  }, [client.id]);

  return (
    <div className="space-y-5">

      {/* Avatar + name */}
      <div className="flex flex-col items-center text-center pt-2">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
          <span className="text-base font-semibold text-foreground/70">{initials(client.name)}</span>
        </div>
        <h2 className="font-semibold text-base leading-tight">{client.name}</h2>
        {client.partner_name && (
          <p className="text-xs text-muted-foreground mt-0.5">& {client.partner_name}</p>
        )}
        <div className="mt-2">
          <span className={clsx(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            pill.bg, pill.text
          )}>
            <span className={clsx('h-1.5 w-1.5 rounded-full', pill.dot)} />
            {client.status || 'Onboarding'}
          </span>
        </div>
      </div>

      {/* Pregnancy info */}
      {client.due_date && (
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1.5 text-sm">
          {ga && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Gestational age</span>
              <span className="font-semibold">{ga.label}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Due date</span>
            <span className="font-medium text-xs">{fmtDate(client.due_date)}</span>
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="space-y-2 text-sm">
        {client.phone && (
          <a href={`tel:${client.phone}`}
            className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.phone}</span>
          </a>
        )}
        {client.invited_email && (
          <a href={`mailto:${client.invited_email}`}
            className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.invited_email}</span>
          </a>
        )}
        {client.address_city && (
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{client.address_city}</span>
          </div>
        )}
      </div>

      {/* Active package */}
      {activePkg && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Package</p>
          <div className="rounded-lg border bg-background px-3 py-2.5">
            <div className="font-medium text-sm">{activePkg.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {activePkg.price != null && `$${activePkg.price.toLocaleString()} · `}
              {activePkg.appt_count} appt types
            </div>
            {activePkg.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activePkg.tags.map(t => (
                  <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Service types */}
      {(client.service_types ?? []).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Services</p>
          <div className="flex flex-wrap gap-1">
            {client.service_types!.map(t => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Edit link */}
      <div className="pt-1">
        <Link
          href={`/clients/${client.id}/edit`}
          className="block w-full text-center rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Edit Client
        </Link>
      </div>
    </div>
  );
}
