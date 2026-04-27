// src/app/settings/appointment-types/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  listAppointmentTypes,
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
  type AppointmentTypeSummary,
} from '@/features/appointments/api/appointment_types.api';
import { Plus, Pencil, Trash2, Clock, Monitor, MapPin, Shuffle } from 'lucide-react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type FormValues = {
  name:             string;
  duration_minutes: number;
  mode:             string;
  description:      string;
  price_per_extra:  number | '';
};

const MODE_OPTIONS = [
  { value: 'in_person', label: 'In-person', icon: MapPin },
  { value: 'virtual',   label: 'Virtual',   icon: Monitor },
  { value: 'either',    label: 'Either',    icon: Shuffle },
];

const MODE_LABELS: Record<string, string> = {
  in_person: 'In-person',
  virtual:   'Virtual',
  either:    'Either',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentTypesPage() {
  const [types, setTypes]       = useState<AppointmentTypeSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]   = useState<AppointmentTypeSummary | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      name: '', duration_minutes: 60, mode: 'in_person', description: '', price_per_extra: '',
    },
  });

  useEffect(() => {
    listAppointmentTypes()
      .then(setTypes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    form.reset({ name: '', duration_minutes: 60, mode: 'in_person', description: '', price_per_extra: '' });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(t: AppointmentTypeSummary) {
    setEditing(t);
    form.reset({
      name:             t.name,
      duration_minutes: t.duration_minutes,
      mode:             t.mode ?? 'in_person',
      description:      t.description ?? '',
      price_per_extra:  t.price_per_extra ?? '',
    });
    setError(null);
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      if (editing) {
        const updated = await updateAppointmentType(editing.id, {
          name:             values.name,
          duration_minutes: values.duration_minutes,
          mode:             values.mode || null,
          description:      values.description || null,
          price_per_extra:  values.price_per_extra !== '' ? Number(values.price_per_extra) : null,
        });
        setTypes(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await createAppointmentType({
          name:             values.name,
          duration_minutes: values.duration_minutes,
          mode:             values.mode || null,
          description:      values.description || null,
        });
        setTypes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setDialogOpen(false);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await deleteAppointmentType(id);
      setTypes(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert('Could not delete: ' + (err?.message ?? 'unknown error'));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appointment Types</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reusable templates for scheduling — add these to packages
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Type
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : types.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center max-w-lg mx-auto mt-8">
            <div className="text-3xl mb-3">🗓️</div>
            <p className="font-medium text-muted-foreground">No appointment types yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Create reusable templates like "Prenatal Visit" or "Lactation Consult" — then add them to packages.
            </p>
            <Button onClick={openCreate} variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create your first type
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-background overflow-hidden max-w-3xl">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_100px_80px_72px] gap-4 px-5 py-2.5 border-b bg-muted/40">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mode</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extra $</span>
              <span />
            </div>
            {/* Rows */}
            <div className="divide-y">
              {types.map(t => (
                <div
                  key={t.id}
                  className="grid grid-cols-[1fr_80px_100px_80px_72px] gap-4 items-center px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{t.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {t.duration_minutes}m
                  </div>
                  <div>
                    <span className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      t.mode === 'in_person' ? 'bg-blue-50 text-blue-700' :
                      t.mode === 'virtual'   ? 'bg-purple-50 text-purple-700' :
                                               'bg-muted text-muted-foreground'
                    )}>
                      {MODE_LABELS[t.mode ?? ''] ?? t.mode ?? '—'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t.price_per_extra ? `$${t.price_per_extra}` : '—'}
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => openEdit(t)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Appointment Type' : 'New Appointment Type'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                {...form.register('name', { required: true })}
                placeholder="e.g. Prenatal Visit"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  {...form.register('duration_minutes', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Price per extra (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="pl-7"
                    {...form.register('price_per_extra')}
                  />
                </div>
              </div>
            </div>

            {/* Mode selector */}
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {MODE_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const selected = form.watch('mode') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => form.setValue('mode', value)}
                      className={clsx(
                        'flex flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-medium transition-colors',
                        selected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-foreground/30'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                {...form.register('description')}
                placeholder="Brief description of this appointment type…"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? 'Saving…'
                  : editing ? 'Save Changes' : 'Create Type'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
