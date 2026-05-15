// src/app/clients/[id]/edit/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { clientSchema, type ClientFormValues, SERVICE_TYPES, SERVICE_TYPE_LABELS, CLIENT_STATUSES } from '@/features/clients/types';
import { listPackages, type PackageSummary } from '@/features/packages/api/packages.api';
import { listAddOns, type AddOn } from '@/features/add-ons/api/add_ons.api';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, User, Baby, Package, FileText } from 'lucide-react';
import clsx from 'clsx';

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [packages, setPackages]                 = useState<PackageSummary[]>([]);
  const [currentPackageId, setCurrentPackageId] = useState<string | null>(null);
  const originalPackageId                       = React.useRef<string | null>(null);
  const [addOns, setAddOns]                     = useState<AddOn[]>([]);
  const [selectedAddOns, setSelectedAddOns]     = useState<{ addOnId: number; quantity: number }[]>([]);
  const [isLoading, setIsLoading]               = useState(true);
  const [isSaving, setIsSaving]                 = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [success, setSuccess]                   = useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '', invited_email: '', partner_name: '',
      phone: '', address_city: '', status: 'Onboarding',
      service_types: [], due_date: '', lmp: '',
      pregnancy_stage: '', risk_notes: '', notes: '',
    },
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue } = form;
  const watchedServiceTypes = watch('service_types') ?? [];
  const clientName = watch('name');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const { data: client, error: clientErr } = await supabase
          .from('clients').select('*').eq('id', id).single();
        if (clientErr) throw clientErr;

        form.reset({
          name:            client.name ?? '',
          invited_email:   client.invited_email ?? '',
          partner_name:    client.partner_name ?? '',
          phone:           client.phone ?? '',
          address_city:    client.address_city ?? '',
          status:          client.status ?? 'Onboarding',
          service_types:   client.service_types ?? [],
          due_date:        client.due_date ?? '',
          lmp:             client.lmp ?? '',
          pregnancy_stage: client.pregnancy_stage ?? '',
          risk_notes:      client.risk_notes ?? '',
          notes:           client.notes ?? '',
        });

        const { data: cp } = await supabase
          .from('client_packages').select('package_id')
          .eq('client_id', id).eq('is_active', true).maybeSingle();
        if (cp?.package_id) {
          setCurrentPackageId(cp.package_id);
          originalPackageId.current = cp.package_id;
        }

        const { data: existingAddOns } = await supabase
          .from('client_add_ons').select('add_on_id, quantity')
          .eq('client_id', id);
        if (existingAddOns?.length) {
          setSelectedAddOns(existingAddOns.map((a: any) => ({ addOnId: a.add_on_id, quantity: a.quantity })));
        }
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load client.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id, form]);

  useEffect(() => {
    listPackages().then(setPackages).catch(console.error);
    listAddOns().then(setAddOns).catch(console.error);
  }, []);

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

  function toggleServiceType(type: string) {
    const current = watch('service_types') ?? [];
    setValue('service_types',
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
      { shouldDirty: true }
    );
  }

  async function onSubmit(data: ClientFormValues) {
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    const doulaId = user?.id ?? '';
    const orgId   = user?.orgId ?? '';

    try {
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          name:            data.name,
          invited_email:   data.invited_email || null,
          partner_name:    data.partner_name || null,
          phone:           data.phone || null,
          address_city:    data.address_city || null,
          status:          data.status,
          service_types:   data.service_types ?? [],
          due_date:        data.due_date || null,
          lmp:             data.lmp || null,
          pregnancy_stage: data.pregnancy_stage || null,
          risk_notes:      data.risk_notes || null,
          notes:           data.notes || null,
        })
        .eq('id', id);
      if (clientError) throw clientError;

      // Only call the RPC if the package actually changed
      if (currentPackageId !== originalPackageId.current) {
        const { error: pkgError } = await supabase.rpc('set_client_package', {
          p_client_id:  id,
          p_package_id: currentPackageId ?? null,
          p_doula_id:   doulaId,
        });
        if (pkgError) throw pkgError;
        originalPackageId.current = currentPackageId;
      }

      // Replace client add-ons: delete existing then insert current selections
      await supabase.from('client_add_ons').delete().eq('client_id', id);
      if (selectedAddOns.length > 0) {
        await supabase.from('client_add_ons').insert(
          selectedAddOns.map(a => ({
            client_id: id,
            add_on_id: a.addOnId,
            quantity:  a.quantity,
            org_id:    orgId,
          }))
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['clients:listview'] }),
        queryClient.invalidateQueries({ queryKey: ['client:profile', id] }),
      ]);

      setSuccess(true);
      setTimeout(() => router.push(`/clients/${id}`), 800);
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err?.message ?? 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>
  );

  const selectedPkg = packages.find((p) => p.id === currentPackageId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-8 py-6 border-b bg-background">
        <button type="button" onClick={() => router.push(`/clients/${id}`)}
          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{clientName || 'Edit Client'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Update client information</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-8">

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
          )}
          {success && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">Saved! Redirecting…</div>
          )}

          <section>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Personal Info</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input {...register('name')} placeholder="Jane Doe" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5"><Label>Partner Name</Label><Input {...register('partner_name')} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" {...register('invited_email')} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input {...register('phone')} /></div>
              <div className="space-y-1.5"><Label>City</Label><Input {...register('address_city')} /></div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" {...register('status')}>
                  {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Baby className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pregnancy Info</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Estimated Due Date</Label><Input type="date" {...register('due_date')} /></div>
              <div className="space-y-1.5"><Label>LMP</Label><Input type="date" {...register('lmp')} /></div>
              <div className="space-y-1.5 md:col-span-2"><Label>Pregnancy Stage</Label><Input {...register('pregnancy_stage')} /></div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Service Types</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map((type) => {
                const selected = watchedServiceTypes.includes(type);
                return (
                  <button key={type} type="button" onClick={() => toggleServiceType(type)}
                    className={clsx('rounded-full px-3 py-1.5 text-sm font-medium border transition-colors',
                      selected ? 'bg-primary text-primary-foreground border-primary'
                               : 'bg-background text-muted-foreground border-border hover:border-foreground/50')}>
                    {SERVICE_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Package</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Assigned Package</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={currentPackageId ?? ''} onChange={(e) => setCurrentPackageId(e.target.value || null)}>
                  <option value="">— No package —</option>
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedPkg && (
                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedPkg.name}</span>
                    {selectedPkg.price != null && <span className="text-muted-foreground">${selectedPkg.price}</span>}
                  </div>
                  {selectedPkg.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedPkg.tags.map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {addOns.length > 0 && (
                <div className="space-y-2 pt-1">
                  <Label>Add-ons</Label>
                  <p className="text-xs text-muted-foreground">Optional individual services outside the package</p>
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
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={4} {...register('notes')} placeholder="General notes…" /></div>
              <div className="space-y-1.5"><Label>Risk Notes</Label><Textarea rows={4} {...register('risk_notes')} placeholder="Medical or risk notes…" /></div>
            </div>
          </section>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.push(`/clients/${id}`)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save Changes'}</Button>
          </div>

        </form>
      </div>
    </div>
  );
}
