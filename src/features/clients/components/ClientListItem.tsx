// src/features/clients/components/ClientListItem.tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal } from 'lucide-react';
import { useUpdateClient } from '../hooks/useClient';
import type { ClientListRow } from '../api/clients.api';
import { SERVICE_TYPE_LABELS, CLIENT_STATUSES } from '../types';

type ClientWithOptional = ClientListRow & {
  next_appointment?: string | null;
  photo_url?: string | null;
};

// ─── Status pill styles ───────────────────────────────────────────────────────

const STATUS_PILL: Record<string, { bg: string; text: string; dot: string }> = {
  Active:     { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'On Call':  { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
  'In Labor': { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },
  Onboarding: { bg: 'bg-sky-50',      text: 'text-sky-700',     dot: 'bg-sky-500' },
  Postpartum: { bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500' },
  Completed:  { bg: 'bg-neutral-100', text: 'text-neutral-500', dot: 'bg-neutral-400' },
  Inactive:   { bg: 'bg-neutral-100', text: 'text-neutral-400', dot: 'bg-neutral-300' },
};
const DEFAULT_PILL = { bg: 'bg-neutral-100', text: 'text-neutral-500', dot: 'bg-neutral-400' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

function calcGestationalAge(dueISO?: string | null) {
  if (!dueISO) return null;
  const msPerDay = 86_400_000;
  const today = new Date();
  const due = new Date(dueISO);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const d0 = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const daysUntilDue = Math.floor((d0 - t0) / msPerDay);
  if (daysUntilDue >= 0) {
    const daysPreg = Math.min(280, Math.max(0, 280 - daysUntilDue));
    return { weeks: Math.floor(daysPreg / 7), days: daysPreg % 7, pastDue: false, pastDays: 0 };
  }
  return { weeks: 40, days: 0, pastDue: true, pastDays: Math.abs(daysUntilDue) };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientListItem({ client }: { client: ClientWithOptional }) {
  const pill = STATUS_PILL[client.status] ?? DEFAULT_PILL;
  const [status, setStatus] = useState(client.status ?? 'Active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const updateClient = useUpdateClient();

  const handleStatusSave = () => {
    updateClient.mutate(
      { id: client.id, updates: { status } },
      { onSuccess: () => setDialogOpen(false) }
    );
  };

  const ga = calcGestationalAge(client.due_date);
  const gaLabel = ga
    ? ga.pastDue ? `40w +${ga.pastDays}d` : `${ga.weeks}w ${ga.days}d`
    : null;

  // Merge service_types labels + package tags, deduplicated
  const allTags = useMemo(() => {
    const serviceLabels = (client.service_types ?? []).map(
      (t) => SERVICE_TYPE_LABELS[t as keyof typeof SERVICE_TYPE_LABELS] ?? t
    );
    return [...new Set([...serviceLabels, ...(client.package_tags ?? [])])];
  }, [client.service_types, client.package_tags]);

  return (
    <div className={clsx(
      'grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_auto] gap-4 items-center px-4 py-3',
      'hover:bg-muted/40 transition-colors',
      client.status === 'Inactive' && 'opacity-60'
    )}>

      {/* Client name + avatar */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          {client.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.photo_url} alt={client.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-foreground/70">{initials(client.name)}</span>
          )}
        </div>
        <div className="min-w-0">
          <Link
            href={`/clients/${client.id}`}
            className="text-sm font-medium hover:underline truncate block"
          >
            {client.name}
          </Link>
          {gaLabel && (
            <span className="text-xs text-muted-foreground">{gaLabel}</span>
          )}
        </div>
      </div>

      {/* Due date */}
      <div className="text-sm text-muted-foreground">
        {formatDate(client.due_date)}
      </div>

      {/* Next appointment */}
      <div className="text-sm text-muted-foreground">
        {formatDate(client.next_appointment)}
      </div>

      {/* Service tags */}
      <div className="flex flex-wrap gap-1">
        {allTags.length > 0 ? allTags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {t}
          </span>
        )) : <span className="text-sm text-muted-foreground">—</span>}
      </div>

      {/* Status pill */}
      <div>
        <span className={clsx(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          pill.bg, pill.text
        )}>
          <span className={clsx('h-1.5 w-1.5 rounded-full', pill.dot)} />
          {client.status || 'Inactive'}
        </span>
      </div>

      {/* Actions */}
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/clients/${client.id}`}>View</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/clients/${client.id}/edit`}>Edit</Link>
            </DropdownMenuItem>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDialogOpen(true); }}>
                  Set Status
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Status — {client.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleStatusSave} disabled={updateClient.isPending}>
                    {updateClient.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );
}
