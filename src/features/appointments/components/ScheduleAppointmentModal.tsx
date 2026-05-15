// src/features/appointments/components/ScheduleAppointmentModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabaseClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, MapPin, Monitor, AlertCircle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type AvailableType = {
  appointment_type_id: number;
  name:                string;
  duration_minutes:    number;
  mode:                string | null;
  description:         string | null;
  included_quantity:   number;
  used_quantity:       number;
  remaining_quantity:  number;
};

type FormValues = {
  date:     string;
  time:     string;
  location: string;
  notes:    string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODE_LABEL: Record<string, string> = {
  in_person: 'In-person',
  virtual:   'Virtual',
  either:    'Either',
};

function addMinutes(dateStr: string, timeStr: string, minutes: number): string {
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  dt.setMinutes(dt.getMinutes() + minutes);
  return dt.toISOString();
}

function toISODateTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open:      boolean;
  onClose:   () => void;
  clientId:  string;
  onSaved?:  () => void;
}

export function ScheduleAppointmentModal({ open, onClose, clientId, onSaved }: Props) {
  const { user } = useAuth();
  const [availableTypes, setAvailableTypes] = useState<AvailableType[]>([]);
  const [selectedType,   setSelectedType]   = useState<AvailableType | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { date: '', time: '10:00', location: '', notes: '' },
  });

  const watchDate = watch('date');
  const watchTime = watch('time');

  // Load available appointment types from client's package
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedType(null);
    setError(null);
    setSuccess(false);
    reset({ date: '', time: '10:00', location: '', notes: '' });

    supabase
      .rpc('get_available_appointment_types_for_client', { p_client_id: clientId })
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          setError('Could not load appointment types: ' + rpcError.message);
        } else {
          setAvailableTypes((data as AvailableType[]) ?? []);
        }
        setLoading(false);
      });
  }, [open, clientId, reset]);

  async function onSubmit(values: FormValues) {
    if (!selectedType) { setError('Please select an appointment type.'); return; }
    if (!values.date)  { setError('Please select a date.'); return; }

    setSaving(true);
    setError(null);

    const doulaId = user?.id    ?? '';
    const orgId   = user?.orgId ?? '';
    const startsAt = toISODateTime(values.date, values.time);
    const endsAt   = addMinutes(values.date, values.time, selectedType.duration_minutes);

    const { error: insertError } = await supabase
      .from('appointments')
      .insert({
        org_id:              orgId,
        client_id:           clientId,
        doula_id:            doulaId,
        appointment_type_id: selectedType.appointment_type_id,
        title:               selectedType.name,
        starts_at:           startsAt,
        ends_at:             endsAt,
        location:            values.location || null,
        notes:               values.notes    || null,
        status:              'scheduled',
      });

    setSaving(false);

    if (insertError) {
      // Overlap constraint gives a specific error code
      if (insertError.message.includes('no_overlap_per_doula') || insertError.code === '23P01') {
        setError('This time overlaps with another scheduled appointment. Please choose a different time.');
      } else {
        setError(insertError.message);
      }
      return;
    }

    setSuccess(true);
    // Refresh available types count
    const { data } = await supabase
      .rpc('get_available_appointment_types_for_client', { p_client_id: clientId });
    if (data) setAvailableTypes(data as AvailableType[]);

    setTimeout(() => {
      onSaved?.();
      onClose();
    }, 1200);
  }

  // Computed end time preview
  const endTimePreview = selectedType && watchDate && watchTime
    ? new Date(addMinutes(watchDate, watchTime, selectedType.duration_minutes))
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-1">

          {/* Error / Success */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Appointment scheduled!
            </div>
          )}

          {/* Step 1 — Select appointment type */}
          <div className="space-y-2">
            <Label>Appointment Type</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
            ) : availableTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No appointment types available. Assign a package to this client first.
              </div>
            ) : (
              <div className="space-y-2">
                {availableTypes.map(t => {
                  const remaining  = Number(t.remaining_quantity);
                  const included   = Number(t.included_quantity);
                  const used       = Number(t.used_quantity);
                  const exhausted  = remaining <= 0;
                  const isSelected = selectedType?.appointment_type_id === t.appointment_type_id;

                  return (
                    <button
                      key={t.appointment_type_id}
                      type="button"
                      disabled={exhausted}
                      onClick={() => !exhausted && setSelectedType(t)}
                      className={clsx(
                        'w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                        isSelected  && 'border-primary bg-primary/5',
                        !isSelected && !exhausted && 'hover:border-foreground/30 hover:bg-muted/40',
                        exhausted   && 'opacity-50 cursor-not-allowed bg-muted/20'
                      )}
                    >
                      {/* Type info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {t.duration_minutes} min
                          </span>
                          {t.mode && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              {t.mode === 'virtual' ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                              {MODE_LABEL[t.mode] ?? t.mode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Usage badge */}
                      <div className="shrink-0 text-right">
                        <span className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                          exhausted          ? 'bg-neutral-100 text-neutral-500' :
                          remaining === 1    ? 'bg-amber-50 text-amber-700' :
                                              'bg-emerald-50 text-emerald-700'
                        )}>
                          {exhausted ? 'Used up' : `${remaining} remaining`}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {used} of {included} used
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2 — Date & time (only shown once type selected) */}
          {selectedType && (
            <div className="space-y-4 pt-1 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    {...register('date', { required: 'Date is required' })}
                  />
                  {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    {...register('time', { required: true })}
                  />
                </div>
              </div>

              {/* End time preview */}
              {endTimePreview && (
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Ends at <strong className="text-foreground ml-1">{endTimePreview}</strong>
                  <span className="ml-1">({selectedType.duration_minutes} min)</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder={selectedType.mode === 'virtual' ? 'Video link or platform' : 'Address or clinic name'}
                  {...register('location')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <textarea
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
                  rows={3}
                  placeholder="Any notes for this appointment…"
                  {...register('notes')}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={saving || !selectedType || success}
            >
              {saving ? 'Scheduling…' : 'Schedule Appointment'}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
