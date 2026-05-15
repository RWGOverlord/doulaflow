// src/features/clients/components/NewClientWizard.tsx
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { listPackages, type PackageSummary } from '@/features/packages/api/packages.api';
import { listAddOns, type AddOn } from '@/features/add-ons/api/add_ons.api';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth-context';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../types';
import clsx from 'clsx';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  firstName:     z.string().min(1, 'Required'),
  lastName:      z.string().min(1, 'Required'),
  email:         z.string().email().optional().or(z.literal('')),
  phone:         z.string().optional().or(z.literal('')),
  dueDate:       z.string().optional().or(z.literal('')),
  lmp:           z.string().optional().or(z.literal('')),
  serviceTypes:  z.array(z.string()).default([]),
  packageId:     z.string().optional(),
  notes:         z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  const items = ['Client Info', 'Package', 'Review'];
  return (
    <ol className="flex items-center gap-2 mb-8">
      {items.map((label, idx) => {
        const n = idx + 1;
        const done = n < step;
        const active = n === step;
        return (
          <React.Fragment key={label}>
            <li className="flex items-center gap-2">
              <span className={clsx(
                'h-6 w-6 grid place-items-center rounded-full text-xs font-semibold transition-colors',
                done   && 'bg-foreground text-background',
                active && 'bg-primary text-primary-foreground',
                !done && !active && 'bg-muted text-muted-foreground'
              )}>
                {done ? '✓' : n}
              </span>
              <span className={clsx(
                'text-sm',
                active ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}>
                {label}
              </span>
            </li>
            {idx < items.length - 1 && (
              <span className="flex-1 h-px bg-border mx-1" />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NewClientWizard() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = React.useState(1);
  const [packages, setPackages] = React.useState<PackageSummary[]>([]);
  const [addOns, setAddOns] = React.useState<AddOn[]>([]);
  const [selectedAddOns, setSelectedAddOns] = React.useState<{ addOnId: number; quantity: number }[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '', lastName: '', email: '', phone: '',
      dueDate: '', lmp: '', serviceTypes: [], packageId: undefined, notes: '',
    },
    mode: 'onChange',
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue } = form;

  React.useEffect(() => {
    listPackages().then(setPackages).catch(console.error);
    listAddOns().then(setAddOns).catch(console.error);
  }, []);

  const watchedServiceTypes = watch('serviceTypes');
  const watchedPackageId    = watch('packageId');
  const selectedPkg         = packages.find((p) => p.id === watchedPackageId);
  const fullName            = `${watch('firstName')} ${watch('lastName')}`.trim();

  function toggleServiceType(type: string) {
    const current = watch('serviceTypes') ?? [];
    setValue(
      'serviceTypes',
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
      { shouldDirty: true }
    );
  }

  function toggleAddOn(addOnId: number) {
    setSelectedAddOns(prev =>
      prev.some(a => a.addOnId === addOnId)
        ? prev.filter(a => a.addOnId !== addOnId)
        : [...prev, { addOnId, quantity: 1 }]
    );
  }

  function updateAddOnQty(addOnId: number, quantity: number) {
    setSelectedAddOns(prev =>
      prev.map(a => a.addOnId === addOnId ? { ...a, quantity: Math.max(1, quantity) } : a)
    );
  }

  const next = () => setStep((s) => Math.min(3, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    setError(null);

    try {
      const orgId   = user?.orgId ?? '';
      const doulaId = user?.id    ?? '';

      if (!orgId || !doulaId) {
        setError('Could not resolve your user ID. Please refresh and try again.');
        return;
      }

      // Merge service_types: selected types + any tags from chosen package
      const pkgTags = selectedPkg?.tags ?? [];
      const mergedTypes = [
        ...new Set([...values.serviceTypes, ...pkgTags]),
      ];

      // 1) Insert client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          name:          `${values.firstName} ${values.lastName}`.trim(),
          invited_email: values.email    || null,
          phone:         values.phone    || null,
          due_date:      values.dueDate  || null,
          lmp:           values.lmp      || null,
          notes:         values.notes    || null,
          service_types: mergedTypes,
          status:        values.packageId ? 'Active' : 'Onboarding',
          org_id:        orgId,
          doula_id:      doulaId,
          created_by:    doulaId,
        })
        .select('*')
        .single();

      if (clientError || !client) {
        logger.error('clients', 'create', clientError?.message ?? 'Insert returned no data', {
          code: clientError?.code,
          details: clientError?.details,
        });
        setError(clientError?.message ?? 'Failed to create client.');
        return;
      }

      // 2) If package selected, create client_packages row
      if (values.packageId) {
        const { error: cpError } = await supabase
          .from('client_packages')           // ← correct table name
          .insert({
            client_id:  client.id,
            package_id: values.packageId,
            doula_id:   doulaId,
            is_active:  true,
            status:     'active',
            started_at: new Date().toISOString().split('T')[0],
          });

        if (cpError) {
          logger.error('clients', 'assignPackage', cpError.message, {
            code: cpError.code,
            clientId: client.id,
            packageId: values.packageId,
          });
          setError('Client created, but failed to assign package: ' + cpError.message);
          return;
        }
      }

      // 3) Save any selected add-ons
      if (selectedAddOns.length > 0) {
        const { error: aoError } = await supabase
          .from('client_add_ons')
          .insert(
            selectedAddOns.map(a => ({
              client_id: client.id,
              add_on_id: a.addOnId,
              quantity:  a.quantity,
              org_id:    orgId,
            }))
          );
        if (aoError) {
          logger.error('clients', 'assignAddOns', aoError.message, { clientId: client.id });
        }
      }

      // Success — go to the new client's case page
      router.push(`/clients/${client.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Stepper step={step} />

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── STEP 1: CLIENT INFO ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">First name</label>
              <Input {...register('firstName')} placeholder="Jane" />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Last name</label>
              <Input {...register('lastName')} placeholder="Doe" />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input {...register('email')} type="email" placeholder="jane@email.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone</label>
              <Input {...register('phone')} placeholder="(615) 555-0100" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Estimated Due Date</label>
              <Input {...register('dueDate')} type="date" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Last Menstrual Period (LMP)</label>
              <Input {...register('lmp')} type="date" />
            </div>
          </div>

          {/* Service types multi-select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Service Types</label>
            <p className="text-xs text-muted-foreground">Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map((type) => {
                const selected = watchedServiceTypes?.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleServiceType(type)}
                    className={clsx(
                      'rounded-full px-3 py-1.5 text-sm font-medium border transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-foreground'
                    )}
                  >
                    {SERVICE_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Textarea {...register('notes')} placeholder="Initial notes about this client..." rows={3} />
          </div>
        </div>
      )}

      {/* ── STEP 2: PACKAGE ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assign a package (optional)</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              {...register('packageId')}
              defaultValue=""
            >
              <option value="">— No package —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {selectedPkg && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-start justify-between">
                <h4 className="font-medium">{selectedPkg.name}</h4>
                {selectedPkg.price != null && (
                  <span className="text-sm font-semibold">${selectedPkg.price}</span>
                )}
              </div>
              {selectedPkg.description && (
                <p className="text-sm text-muted-foreground">{selectedPkg.description}</p>
              )}
              {(selectedPkg.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedPkg.tags!.map((t) => (
                    <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add-ons */}
          {addOns.length > 0 && (
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium">Add-ons</label>
                <p className="text-xs text-muted-foreground">Optional individual services outside the package</p>
              </div>
              <div className="rounded-lg border overflow-hidden divide-y">
                {addOns.map(addon => {
                  const sel = selectedAddOns.find(a => a.addOnId === addon.id);
                  return (
                    <div key={addon.id} className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        id={`addon-${addon.id}`}
                        checked={!!sel}
                        onChange={() => toggleAddOn(addon.id)}
                        className="h-4 w-4 rounded border-muted-foreground/30 accent-primary"
                      />
                      <label htmlFor={`addon-${addon.id}`} className="flex-1 cursor-pointer">
                        <div className="text-sm font-medium">{addon.name}</div>
                        {addon.description && (
                          <div className="text-xs text-muted-foreground">{addon.description}</div>
                        )}
                      </label>
                      {addon.price != null && (
                        <span className="text-sm text-muted-foreground shrink-0">${addon.price.toLocaleString()}</span>
                      )}
                      {sel && (
                        <input
                          type="number"
                          min="1"
                          value={sel.quantity}
                          onChange={e => updateAddOnQty(addon.id, parseInt(e.target.value) || 1)}
                          className="w-14 rounded-md border bg-background px-2 py-1 text-sm text-center"
                          onClick={e => e.stopPropagation()}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: REVIEW ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-medium">Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Name: </span>{fullName || '—'}</div>
              <div><span className="text-muted-foreground">Email: </span>{watch('email') || '—'}</div>
              <div><span className="text-muted-foreground">Phone: </span>{watch('phone') || '—'}</div>
              <div><span className="text-muted-foreground">Due Date: </span>{watch('dueDate') || '—'}</div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Services: </span>
                {watchedServiceTypes?.length
                  ? watchedServiceTypes.map(t => SERVICE_TYPE_LABELS[t as keyof typeof SERVICE_TYPE_LABELS] ?? t).join(', ')
                  : '—'}
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Package: </span>
                {selectedPkg?.name || '— None —'}
              </div>
              {selectedAddOns.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Add-ons: </span>
                  {selectedAddOns.map(a => {
                    const ao = addOns.find(x => x.id === a.addOnId);
                    return ao ? `${ao.name} ×${a.quantity}` : null;
                  }).filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            You can schedule appointments, upload documents, and add notes after the client is created.
          </p>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={back}>← Back</Button>
          )}
        </div>
        <div className="flex gap-2">
          {step < 3 && (
            <>
              <Button type="button" variant="outline" onClick={next}>Skip</Button>
              <Button type="button" onClick={next}>Continue →</Button>
            </>
          )}
          {step === 3 && (
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Client'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
