// src/app/packages/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import {
  getPackageWithAppointmentTypes,
  updatePackage,
} from '@/features/packages/api/packages.api';
import {
  listAppointmentTypes,
  createAppointmentType,
  type AppointmentTypeSummary,
} from '@/features/appointments/api/appointment_types.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const PREDEFINED_TAGS = [
  'Birth Doula', 'Postpartum', 'Lactation',
  'Education', 'Newborn Care', 'Bereavement',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageForm = {
  name:        string;
  description: string;
  price:       number | '';
};

type ApptEntry = {
  appointmentTypeId: string;
  quantity:          number;
};

type NewApptTypeForm = {
  name:             string;
  duration_minutes: number;
  mode:             string;
  description:      string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router  = useRouter();
  const qc      = useQueryClient();

  const [selectedTags,   setSelectedTags]   = useState<string[]>([]);
  const [apptEntries,    setApptEntries]     = useState<ApptEntry[]>([]);
  const [apptTypes,      setApptTypes]       = useState<AppointmentTypeSummary[]>([]);
  const [isLoading,      setIsLoading]       = useState(true);
  const [isSaving,       setIsSaving]        = useState(false);
  const [dialogOpen,     setDialogOpen]      = useState(false);
  const [error,          setError]           = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PackageForm>({
    defaultValues: { name: '', description: '', price: '' },
  });

  const apptTypeForm = useForm<NewApptTypeForm>({
    defaultValues: { name: '', duration_minutes: 60, mode: 'in_person', description: '' },
  });

  // Load package + appointment types in parallel
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [pkg, types] = await Promise.all([
          getPackageWithAppointmentTypes(id),
          listAppointmentTypes(),
        ]);

        setApptTypes(types);

        if (!pkg) { router.push('/packages'); return; }

        reset({
          name:        pkg.name,
          description: pkg.description ?? '',
          price:       pkg.price ?? '',
        });

        setSelectedTags(pkg.tags ?? []);
        setApptEntries(
          (pkg.appointment_types ?? []).map(at => ({
            appointmentTypeId: String(at.appointment_type_id),
            quantity:          at.quantity,
          }))
        );
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load package.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id, reset, router]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  function addApptEntry() {
    setApptEntries(prev => [...prev, { appointmentTypeId: '', quantity: 1 }]);
  }

  function updateApptEntry(i: number, field: keyof ApptEntry, value: string | number) {
    setApptEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  function removeApptEntry(i: number) {
    setApptEntries(prev => prev.filter((_, idx) => idx !== i));
  }

  async function createNewApptType(data: NewApptTypeForm) {
    try {
      const newType = await createAppointmentType(data);
      setApptTypes(prev => [...prev, newType].sort((a, b) => a.name.localeCompare(b.name)));
      setDialogOpen(false);
      apptTypeForm.reset();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create appointment type.');
    }
  }

  async function onSubmit(data: PackageForm) {
    setError(null);
    setIsSaving(true);
    try {
      const validEntries = apptEntries.filter(e => e.appointmentTypeId !== '');
      await updatePackage(id, {
        name:             data.name,
        description:      data.description || null,
        price:            data.price !== '' ? Number(data.price) : null,
        tags:             selectedTags,
        appointmentTypes: validEntries,
      });
      qc.invalidateQueries({ queryKey: ['packages'] });
      router.push('/packages');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save package.');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-6 border-b bg-background">
        <button
          type="button"
          onClick={() => router.push('/packages')}
          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Package</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Update package details and included appointment types
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Package Name</Label>
            <Input
              placeholder="e.g. Birth + Postpartum Package"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe what's included…"
              rows={3}
              {...register('description')}
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label>Price (USD)</Label>
            <div className="relative max-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="pl-7"
                {...register('price', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map(tag => {
                const selected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={clsx(
                      'rounded-full px-3 py-1.5 text-sm font-medium border transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-foreground/50'
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Appointment types */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Appointments Included</Label>
              <div className="flex gap-2">
                {/* Create new appointment type */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Create Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New Appointment Type</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={apptTypeForm.handleSubmit(createNewApptType)}
                      className="space-y-4 pt-2"
                    >
                      <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input
                          placeholder="e.g. Prenatal Visit"
                          {...apptTypeForm.register('name', { required: true })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Duration (min)</Label>
                          <Input
                            type="number"
                            min="1"
                            {...apptTypeForm.register('duration_minutes', { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Mode</Label>
                          <select
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
                            {...apptTypeForm.register('mode')}
                          >
                            <option value="in_person">In-person</option>
                            <option value="virtual">Virtual</option>
                            <option value="either">Either</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description (optional)</Label>
                        <Textarea rows={2} {...apptTypeForm.register('description')} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={apptTypeForm.formState.isSubmitting}>
                          Create
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addApptEntry}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Appointment
                </Button>
              </div>
            </div>

            {apptEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No appointments added yet. Click "Add Appointment" to include types in this package.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_36px] gap-3 px-4 py-2 bg-muted/40 border-b">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appointment Type</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Qty</span>
                  <span />
                </div>
                {apptEntries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_36px] gap-3 items-center px-4 py-2.5 border-b last:border-0">
                    <select
                      className="rounded-md border bg-background px-3 py-1.5 text-sm w-full"
                      value={entry.appointmentTypeId}
                      onChange={e => updateApptEntry(i, 'appointmentTypeId', e.target.value)}
                    >
                      <option value="">— Select type —</option>
                      {apptTypes.map(t => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name} ({t.duration_minutes} min)
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={entry.quantity}
                      onChange={e => updateApptEntry(i, 'quantity', parseInt(e.target.value) || 1)}
                      className="text-center"
                    />
                    <button
                      type="button"
                      onClick={() => removeApptEntry(i)}
                      className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.push('/packages')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
