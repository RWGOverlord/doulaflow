// src/features/packages/components/PackageCard.tsx
'use client';

import Link from 'next/link';
import { useDeletePackage } from '../hooks/usePackages';
import type { PackageSummary } from '../api/packages.api';
import clsx from 'clsx';
import { Trash2, Pencil, Clock } from 'lucide-react';

// ─── Tag styles ───────────────────────────────────────────────────────────────

const TAG_STYLES: Record<string, string> = {
  'Birth Doula':  'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Postpartum':   'bg-rose-50 text-rose-700 border-rose-100',
  'Lactation':    'bg-blue-50 text-blue-700 border-blue-100',
  'Education':    'bg-amber-50 text-amber-700 border-amber-100',
  'Newborn Care': 'bg-purple-50 text-purple-700 border-purple-100',
  'Bereavement':  'bg-neutral-100 text-neutral-600 border-neutral-200',
};
const DEFAULT_TAG = 'bg-muted text-muted-foreground border-border';

function TagPill({ tag }: { tag: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      TAG_STYLES[tag] ?? DEFAULT_TAG
    )}>
      {tag}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PackageCard({ pkg }: { pkg: PackageSummary }) {
  const del = useDeletePackage();

  function handleDelete() {
    if (!confirm(`Delete "${pkg.name}"? This cannot be undone.`)) return;
    del.mutate(pkg.id);
  }

  const apptTypes = pkg.appointment_types ?? [];
  const totalAppts = apptTypes.reduce((sum, at) => sum + at.quantity, 0);

  return (
    <div className="rounded-xl border bg-background overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base leading-tight">{pkg.name}</h3>
            {pkg.description && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{pkg.description}</p>
            )}
          </div>
          {pkg.price != null && (
            <span className="text-xl font-semibold text-primary shrink-0">
              ${pkg.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2.5">
          {(pkg.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pkg.tags.map(t => <TagPill key={t} tag={t} />)}
            </div>
          )}
          {totalAppts > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto shrink-0">
              <Clock className="h-3 w-3" />
              {totalAppts} appt{totalAppts !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Appointment type rows */}
      {apptTypes.length > 0 && (
        <div className="divide-y">
          {apptTypes.map((at, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-foreground truncate">{at.name}</span>
                {at.mode && (
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    · {at.mode === 'in_person' ? 'In-person' : at.mode === 'virtual' ? 'Virtual' : 'Either'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs text-muted-foreground">{at.duration_minutes}m</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  ×{at.quantity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {apptTypes.length === 0 && (
        <div className="px-5 py-4 text-xs text-muted-foreground italic">
          No appointment types added yet —{' '}
          <Link href={`/packages/${pkg.id}`} className="underline underline-offset-2 hover:text-foreground">
            edit package
          </Link>{' '}
          to add some.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/20">
        <Link
          href={`/packages/${pkg.id}`}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
        <button
          onClick={handleDelete}
          disabled={del.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

    </div>
  );
}
