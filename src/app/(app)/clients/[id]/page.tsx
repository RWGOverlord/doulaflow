// src/app/clients/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClientSidebar } from '@/features/clients/components/ClientSidebar';
import { useClientProfile } from '@/features/clients/hooks/useClientProfile';
import { ScheduleAppointmentModal } from '@/features/appointments/components/ScheduleAppointmentModal';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Upload, Download, Trash2, Users, Clock, Pencil, Link2, Copy, CheckCheck, Loader2, Mail } from 'lucide-react';
import { generateIntakeToken } from '@/features/intake/api/intake.api';
import { useForm } from 'react-hook-form';
import {
  listDocuments, uploadDocument, deleteDocument, getDownloadUrl,
  DOCUMENT_CATEGORIES, VISIBILITY_OPTIONS,
  formatFileSize, fileIcon,
  type Document as DocType, type DocumentCategory, type DocumentVisibility,
} from '@/features/documents/api/documents.api';
import { useAuth } from '@/lib/auth-context';
import { BirthDetailsTab } from '@/features/clients/components/BirthDetailsTab';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import clsx from 'clsx';

type Appointment = {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  location: string | null;
  notes: string | null;
  appointment_types: { name: string; duration_minutes: number; mode: string | null } | null;
};

type Note = {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
};

type ClientPackage = {
  id: number;
  status: string;
  started_at: string | null;
  packages: {
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    tags: string[];
    package_appointment_types: {
      quantity: number;
      appointment_types: { name: string } | null;
    }[];
  } | null;
};

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(d?: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isPast(d: string) {
  return new Date(d) < new Date();
}

const APPT_STATUS: Record<string, { bg: string; text: string; dot: string }> = {
  scheduled: { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed: { bg: 'bg-neutral-100', text: 'text-neutral-500', dot: 'bg-neutral-400' },
  cancelled: { bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-400' },
  no_show:   { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400' },
};

function ApptCard({ appt, onEdit }: { appt: Appointment; onEdit?: () => void }) {
  const pill  = APPT_STATUS[appt.status] ?? APPT_STATUS.scheduled;
  const d     = new Date(appt.starts_at);
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day   = d.getDate();

  return (
    <div className="group flex items-center gap-4 rounded-xl border bg-background px-4 py-3">
      <div className="text-center min-w-[36px]">
        <div className="text-[10px] font-medium text-muted-foreground tracking-wide">{month}</div>
        <div className="text-xl font-semibold leading-tight text-primary">{day}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{appt.appointment_types?.name ?? appt.title ?? 'Appointment'}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {fmtTime(appt.starts_at)}
          {appt.appointment_types?.duration_minutes && ` · ${appt.appointment_types.duration_minutes} min`}
          {appt.appointment_types?.mode && ` · ${appt.appointment_types.mode.replace('_', '-')}`}
          {appt.location && ` · ${appt.location}`}
        </div>
      </div>
      <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', pill.bg, pill.text)}>
        <span className={clsx('h-1.5 w-1.5 rounded-full', pill.dot)} />
        {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
      </span>
      {onEdit && (
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}


// ─── Package Usage Card ───────────────────────────────────────────────────────

type UsageRow = {
  appointment_type_id: number;
  name:               string;
  included_quantity:  number;
  used_quantity:      number;
  remaining_quantity: number;
};

function PackageUsageCard({ clientId, refreshKey }: { clientId: string; refreshKey: number }) {
  const [rows, setRows]       = useState<UsageRow[]>([]);
  const [pkgName, setPkgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: cp } = await supabase
        .from('client_packages')
        .select('packages ( name )')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle();
      setPkgName((cp as any)?.packages?.name ?? null);

      const { data } = await supabase
        .rpc('get_available_appointment_types_for_client', { p_client_id: clientId });
      setRows((data as UsageRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, [clientId, refreshKey]);

  if (loading || !rows.length) return null;

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="px-4 py-3 border-b">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Package Usage</p>
        {pkgName && <p className="text-sm font-medium mt-0.5">{pkgName}</p>}
      </div>
      <div className="px-4 py-3 space-y-3">
        {rows.map(row => {
          const included  = Number(row.included_quantity);
          const used      = Number(row.used_quantity);
          const pct       = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0;
          const exhausted = used >= included;
          return (
            <div key={row.appointment_type_id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className={exhausted ? 'text-muted-foreground line-through' : ''}>{row.name}</span>
                <span className="text-xs text-muted-foreground">{used} of {included} used</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    exhausted ? 'bg-neutral-400' : pct >= 75 ? 'bg-amber-500' : 'bg-primary'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type EditApptFormValues = {
  date:     string;
  time:     string;
  status:   string;
  location: string;
  notes:    string;
};

function EditAppointmentModal({
  open, appt, onClose, onSaved, onDeleted,
}: {
  open:      boolean;
  appt:      Appointment | null;
  onClose:   () => void;
  onSaved:   (updated: Appointment) => void;
  onDeleted: (id: string) => void;
}) {
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const { register, handleSubmit, reset, watch } = useForm<EditApptFormValues>({
    defaultValues: { date: '', time: '10:00', status: 'scheduled', location: '', notes: '' },
  });

  const watchDate = watch('date');
  const watchTime = watch('time');

  useEffect(() => {
    if (!appt) return;
    const d = new Date(appt.starts_at);
    reset({
      date:     d.toLocaleDateString('en-CA'),         // YYYY-MM-DD in local tz
      time:     `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
      status:   appt.status,
      location: appt.location ?? '',
      notes:    appt.notes ?? '',
    });
    setError(null);
  }, [appt, reset]);

  const durationMins = appt?.appointment_types?.duration_minutes ?? 60;

  const endPreview = watchDate && watchTime
    ? new Date(new Date(`${watchDate}T${watchTime}:00`).getTime() + durationMins * 60_000)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  async function onSubmit(values: EditApptFormValues) {
    if (!appt) return;
    setSaving(true); setError(null);
    const startsAt = new Date(`${values.date}T${values.time}:00`).toISOString();
    const endsAt   = new Date(new Date(startsAt).getTime() + durationMins * 60_000).toISOString();
    const { data, error: err } = await supabase
      .from('appointments')
      .update({ starts_at: startsAt, ends_at: endsAt, status: values.status, location: values.location || null, notes: values.notes || null })
      .eq('id', appt.id)
      .select('id, title, starts_at, ends_at, status, location, notes, appointment_types(name, duration_minutes, mode)')
      .single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved(data as unknown as Appointment);
    onClose();
  }

  async function handleDelete() {
    if (!appt) return;
    if (!confirm('Delete this appointment? The slot will be freed and can be rescheduled.')) return;
    setDeleting(true);
    await supabase.from('appointments').delete().eq('id', appt.id);
    setDeleting(false);
    onDeleted(appt.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Appointment</DialogTitle>
        </DialogHeader>
        {appt && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm font-medium">
              {appt.appointment_types?.name ?? appt.title ?? 'Appointment'}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register('date', { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" {...register('time', { required: true })} />
              </div>
            </div>

            {endPreview && (
              <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Ends at <strong className="text-foreground ml-1">{endPreview}</strong>
                <span className="ml-1">({durationMins} min)</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9" {...register('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="Address or video link" {...register('location')} />
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={3}
                {...register('notes')}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                type="button" variant="outline" size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete} disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete Appointment'}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AppointmentsTab({ clientId, refreshKey }: { clientId: string; refreshKey: number }) {
  const [appts, setAppts]         = useState<Appointment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [pkgRefreshKey, setPkgRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('appointments')
      .select(`id, title, starts_at, ends_at, status, location, notes,
        appointment_types ( name, duration_minutes, mode )`)
      .eq('client_id', clientId)
      .order('starts_at', { ascending: true })
      .then(({ data }) => { setAppts((data as any) ?? []); setLoading(false); });
  }, [clientId, refreshKey]);

  function handleSaved(updated: Appointment) {
    setAppts(prev => prev.map(a => a.id === updated.id ? updated : a));
    setPkgRefreshKey(k => k + 1);
  }

  function handleDeleted(id: string) {
    setAppts(prev => prev.filter(a => a.id !== id));
    setPkgRefreshKey(k => k + 1);
  }

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  const upcoming = appts.filter(a => a.status === 'scheduled' && !isPast(a.starts_at));
  const past     = appts.filter(a => a.status !== 'scheduled' || isPast(a.starts_at));

  const combinedRefresh = refreshKey + pkgRefreshKey;

  return (
    <>
      {!appts.length ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed p-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">No appointments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Schedule Appt" to add one</p>
          </div>
          <PackageUsageCard clientId={clientId} refreshKey={combinedRefresh} />
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Upcoming</p>
              <div className="space-y-2">
                {upcoming.map(a => <ApptCard key={a.id} appt={a} onEdit={() => setEditingAppt(a)} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Past</p>
              <div className="space-y-2 opacity-70">
                {past.map(a => <ApptCard key={a.id} appt={a} onEdit={() => setEditingAppt(a)} />)}
              </div>
            </div>
          )}
          <PackageUsageCard clientId={clientId} refreshKey={combinedRefresh} />
        </div>
      )}

      <EditAppointmentModal
        open={!!editingAppt}
        appt={editingAppt}
        onClose={() => setEditingAppt(null)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </>
  );
}

function NotesTab({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [notes, setNotes]       = useState<Note[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle]       = useState('');
  const [body, setBody]         = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    supabase.from('notes').select('id, title, body, created_at')
      .eq('client_id', clientId).order('created_at', { ascending: false })
      .then(({ data }) => { setNotes((data as any) ?? []); setLoading(false); });
  }, [clientId]);

  function openNew() {
    setEditingId(null);
    setTitle('');
    setBody('');
    setShowForm(true);
  }

  function openEdit(n: Note) {
    setEditingId(n.id);
    setTitle(n.title ?? '');
    setBody(n.body);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setBody('');
  }

  async function saveNote() {
    if (!body.trim()) return;
    setSaving(true);
    if (editingId) {
      const { data } = await supabase.from('notes')
        .update({ title: title || null, body, updated_at: new Date().toISOString() })
        .eq('id', editingId)
        .select('id, title, body, created_at').single();
      if (data) setNotes(prev => prev.map(n => n.id === editingId ? data as Note : n));
    } else {
      const { data } = await supabase.from('notes').insert({
        client_id:  clientId,
        org_id:     user?.orgId ?? '',
        created_by: user?.id    ?? '',
        title:      title || null,
        body,
      }).select('id, title, body, created_at').single();
      if (data) setNotes(prev => [data as Note, ...prev]);
    }
    cancelForm();
    setSaving(false);
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return;
    await supabase.from('notes').delete().eq('id', id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Always show Add Note button at top */}
      {!showForm && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Note
          </Button>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            {editingId ? 'Edit Note' : 'New Note'}
          </div>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
            placeholder="Note title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={4}
            placeholder="Write your note…"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelForm}>Cancel</Button>
            <Button size="sm" onClick={saveNote} disabled={saving || !body.trim()}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Note'}
            </Button>
          </div>
        </div>
      )}

      {!notes.length && !showForm ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">No notes yet</p>
          <p className="text-xs text-muted-foreground mt-1">Click "New Note" to add one</p>
        </div>
      ) : (
        notes.map(n => (
          <div key={n.id} className="rounded-xl border bg-background p-4 group">
            {n.title && <div className="font-medium text-sm mb-1">{n.title}</div>}
            <div className="text-sm text-muted-foreground leading-relaxed">{n.body}</div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-muted-foreground/60">{fmtDate(n.created_at)}</div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(n)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PackagesTab({ clientId }: { clientId: string }) {
  const [pkgs, setPkgs]       = useState<ClientPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('client_packages')
      .select(`id, status, started_at,
        packages ( id, name, description, price, tags,
          package_appointment_types ( quantity, appointment_types ( name ) )
        )`)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPkgs((data as any) ?? []); setLoading(false); });
  }, [clientId]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  if (!pkgs.length) return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <p className="text-sm font-medium text-muted-foreground">No package assigned</p>
      <p className="text-xs text-muted-foreground mt-1">Edit the client to assign a package</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {pkgs.map(cp => {
        const pkg = cp.packages;
        if (!pkg) return null;
        return (
          <div key={cp.id} className="rounded-xl border bg-background overflow-hidden">
            <div className="px-5 py-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">{pkg.name}</h3>
                    {cp.status === 'active' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active
                      </span>
                    )}
                  </div>
                  {cp.started_at && <p className="text-xs text-muted-foreground mt-0.5">Since {fmtDate(cp.started_at)}</p>}
                </div>
                {pkg.price != null && (
                  <span className="text-xl font-semibold text-primary">${pkg.price.toLocaleString()}</span>
                )}
              </div>
              {(pkg.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {pkg.tags.map(t => (
                    <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}
            </div>
            {(pkg.package_appointment_types ?? []).length > 0 && (
              <div className="divide-y">
                {pkg.package_appointment_types.map((pat, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>{pat.appointment_types?.name ?? '—'}</span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">×{pat.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Add-ons Tab ──────────────────────────────────────────────────────────────

type ClientAddOn = {
  id:       number;
  quantity: number;
  add_ons:  { name: string; description: string | null; price: number | null } | null;
};

function AddOnsTab({ clientId }: { clientId: string }) {
  const [addOns, setAddOns]   = useState<ClientAddOn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('client_add_ons')
      .select('id, quantity, add_ons ( name, description, price )')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setAddOns((data as any) ?? []); setLoading(false); });
  }, [clientId]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  if (!addOns.length) return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <p className="text-sm font-medium text-muted-foreground">No add-ons assigned</p>
      <p className="text-xs text-muted-foreground mt-1">Edit the client to add individual services</p>
    </div>
  );

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="divide-y">
        {addOns.map(cao => (
          <div key={cao.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium">{cao.add_ons?.name ?? '—'}</div>
              {cao.add_ons?.description && (
                <div className="text-xs text-muted-foreground mt-0.5">{cao.add_ons.description}</div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {cao.add_ons?.price != null && (
                <span className="text-sm text-muted-foreground">${cao.add_ons.price.toLocaleString()}</span>
              )}
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">×{cao.quantity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { user } = useAuth();
  const [docs, setDocs]           = useState<DocType[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [title, setTitle]         = useState('');
  const [category, setCategory]   = useState<DocumentCategory>('General');
  const [visibility, setVisibility] = useState<DocumentVisibility>('doula');
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    listDocuments({ orgId: user.orgId, clientId })
      .then(setDocs).catch(console.error).finally(() => setLoading(false));
  }, [clientId, user]);

  function handleFile(f: File) {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !user) return;
    setUploading(true); setError(null);
    try {
      const doc = await uploadDocument({
        file, title: title.trim() || file.name, category, visibility,
        clientId, orgId: user.orgId, userId: user.id,
      });
      setDocs(prev => [doc, ...prev]);
      setUploadOpen(false);
      setFile(null); setTitle('');
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: DocType) {
    try { const url = await getDownloadUrl(doc.storage_path); window.open(url, '_blank'); }
    catch (err) { console.error(err); }
  }

  async function handleDelete(doc: DocType) {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    try { await deleteDocument(doc); setDocs(prev => prev.filter(d => d.id !== doc.id)); }
    catch (err) { console.error(err); }
  }

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Upload Document
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">No documents yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload contracts, birth plans, and more</p>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setUploadOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Upload Document
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-background overflow-hidden divide-y">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
              <span className="text-xl shrink-0">{fileIcon(doc.file_type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{doc.category}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                </div>
              </div>
              <span className={clsx('text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0',
                doc.visibility === 'both' ? 'bg-emerald-50 text-emerald-700' :
                doc.visibility === 'client' ? 'bg-blue-50 text-blue-700' :
                'bg-muted text-muted-foreground')}>
                {VISIBILITY_OPTIONS.find(v => v.value === doc.visibility)?.label}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleDownload(doc)}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(doc)}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={o => { if (!o) { setUploadOpen(false); setFile(null); setTitle(''); setError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Document for {clientName}</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 pt-1">
            {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">{fileIcon(file.type)}</span>
                  <div className="text-left">
                    <div className="text-sm font-medium truncate max-w-[200px]">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); setTitle(''); }}
                    className="ml-2 text-muted-foreground hover:text-destructive">
                    <Plus className="h-4 w-4 rotate-45" />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to browse or drop a file</p>
                </div>
              )}
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={title}
                onChange={e => setTitle(e.target.value)} placeholder="Document title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
                  value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
                  {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
                  value={visibility} onChange={e => setVisibility(e.target.value as DocumentVisibility)}>
                  {VISIBILITY_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={uploading || !file}>{uploading ? 'Uploading...' : 'Upload'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'done';
  deadline: string | null;
  created_at: string;
};

function TasksTab({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline]   = useState('');
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    supabase.from('tasks').select('id, title, description, status, deadline, created_at')
      .eq('client_id', clientId).order('created_at', { ascending: false })
      .then(({ data }) => { setTasks((data as any) ?? []); setLoading(false); });
  }, [clientId]);

  function openNew() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setShowForm(true);
  }

  function openEdit(t: Task) {
    setEditingId(t.id);
    setTitle(t.title);
    setDescription(t.description ?? '');
    setDeadline(t.deadline ?? '');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDeadline('');
  }

  async function saveTask() {
    if (!title.trim()) return;
    setSaving(true);
    if (editingId) {
      const { data } = await supabase.from('tasks')
        .update({ title: title.trim(), description: description.trim() || null, deadline: deadline || null })
        .eq('id', editingId)
        .select('id, title, description, status, deadline, created_at').single();
      if (data) setTasks(prev => prev.map(t => t.id === editingId ? data as Task : t));
    } else {
      const { data } = await supabase.from('tasks').insert({
        client_id:   clientId,
        org_id:      user?.orgId ?? '',
        title:       title.trim(),
        description: description.trim() || null,
        deadline:    deadline || null,
        status:      'todo',
      }).select('id, title, description, status, deadline, created_at').single();
      if (data) setTasks(prev => [data as Task, ...prev]);
    }
    cancelForm();
    setSaving(false);
  }

  async function toggleStatus(task: Task) {
    const next = task.status === 'todo' ? 'done' : 'todo';
    const { data } = await supabase.from('tasks')
      .update({ status: next })
      .eq('id', task.id)
      .select('id, title, description, status, created_at').single();
    if (data) setTasks(prev => prev.map(t => t.id === task.id ? data as Task : t));
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  const todo = tasks.filter(t => t.status === 'todo');
  const done = tasks.filter(t => t.status === 'done');

  return (
    <div className="space-y-4">
      {!showForm && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Task
          </Button>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            {editingId ? 'Edit Task' : 'New Task'}
          </div>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
            placeholder="Task title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={2}
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Deadline</label>
            <input
              type="date"
              className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelForm}>Cancel</Button>
            <Button size="sm" onClick={saveTask} disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Task'}
            </Button>
          </div>
        </div>
      )}

      {!tasks.length && !showForm ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">No tasks yet</p>
          <p className="text-xs text-muted-foreground mt-1">Click "New Task" to add one</p>
        </div>
      ) : (
        <div className="space-y-6">
          {todo.length > 0 && (
            <div className="space-y-2">
              {todo.map(t => (
                <TaskRow key={t.id} task={t} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteTask} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Completed</p>
              <div className="space-y-2 opacity-60">
                {done.map(t => (
                  <TaskRow key={t.id} task={t} onToggle={toggleStatus} onEdit={openEdit} onDelete={deleteTask} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background px-4 py-3 group">
      <button
        onClick={() => onToggle(task)}
        className={clsx(
          'mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors',
          task.status === 'done'
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 hover:border-primary'
        )}
      >
        {task.status === 'done' && (
          <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className={clsx('text-sm font-medium', task.status === 'done' && 'line-through text-muted-foreground')}>
          {task.title}
        </div>
        {task.description && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</div>
        )}
        <div className="flex items-center gap-3 mt-1">
          {task.deadline && (
            <span className="text-xs font-medium text-amber-600">
              Due {new Date(task.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          <span className="text-xs text-muted-foreground/60">{fmtDate(task.created_at)}</span>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onEdit(task)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Intake Link Modal ────────────────────────────────────────────────────────

const INTAKE_BASE_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/intake`
  : 'https://app.laquintanadoulacare.com/intake';

function IntakeLinkModal({
  open,
  token,
  generating,
  onClose,
}: {
  open:       boolean;
  token:      string | null;
  generating: boolean;
  onClose:    () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = token ? `${INTAKE_BASE_URL}/${token}` : '';

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Intake Form Link</DialogTitle>
        </DialogHeader>

        {generating ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating link…
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-muted/50 border px-3 py-3">
              <p className="text-xs font-mono text-muted-foreground break-all leading-relaxed select-all">
                {url}
              </p>
            </div>

            <Button className="w-full gap-2" onClick={copyLink}>
              {copied
                ? <><CheckCheck className="h-4 w-4" /> Copied!</>
                : <><Copy className="h-4 w-4" /> Copy Link</>}
            </Button>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              This link expires in 7 days. Share it with your client via text or email.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['appointments', 'notes', 'documents', 'packages', 'add-ons', 'tasks', 'birth'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  appointments: 'Appointments',
  notes:        'Notes',
  documents:    'Documents',
  packages:     'Packages',
  'add-ons':    'Add-ons',
  tasks:        'Tasks',
  birth:        'Birth Details',
};

export default function ClientCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router  = useRouter();
  const { user } = useAuth();
  const { data: client, isLoading, error } = useClientProfile(id);
  const [activeTab,       setActiveTab]       = useState<Tab>('appointments');
  const [modalOpen,       setModalOpen]       = useState(false);
  const [apptRefreshKey,  setApptRefreshKey]  = useState(0);

  // Intake form
  const [intakeModalOpen,  setIntakeModalOpen]  = useState(false);
  const [intakeToken,      setIntakeToken]      = useState<string | null>(null);
  const [intakeGenerating, setIntakeGenerating] = useState(false);
  const [intakeStatus,     setIntakeStatus]     = useState<'sent' | 'completed' | null>(null);

  // Load the most recent token status for this client
  useEffect(() => {
    let mounted = true;
    supabase
      .from('intake_tokens')
      .select('expires_at, completed_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted || !data) return;
        if (data.completed_at) {
          setIntakeStatus('completed');
        } else if (new Date(data.expires_at) > new Date()) {
          setIntakeStatus('sent');
        }
      });
    return () => { mounted = false; };
  }, [id]);

  async function handleSendIntake() {
    setIntakeGenerating(true);
    setIntakeModalOpen(true);
    try {
      const token = await generateIntakeToken(id);
      setIntakeToken(token);
      setIntakeStatus(prev => prev === 'completed' ? 'completed' : 'sent');
    } catch (err) {
      console.error('[intake] failed to generate token', err);
      setIntakeModalOpen(false);
    } finally {
      setIntakeGenerating(false);
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading…</div>
  );
  if (error || !client) return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Client not found.</div>
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b bg-background">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/clients')}
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
              {intakeStatus === 'completed' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <CheckCheck className="h-3 w-3" /> Intake completed
                </span>
              )}
              {intakeStatus === 'sent' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                  <Mail className="h-3 w-3" /> Intake form sent
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Client since {new Date(client.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSendIntake} className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Send Intake Form
          </Button>
          <Link href={`/clients/${id}/edit`}>
            <Button variant="outline" size="sm">Edit</Button>
          </Link>
          <Button size="sm" onClick={() => setModalOpen(true)}>Schedule Appt</Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-72 shrink-0 border-r overflow-y-auto p-5">
          <ClientSidebar client={client} />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex border-b px-6 bg-background overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={clsx(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}>
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'appointments' && <AppointmentsTab clientId={id} refreshKey={apptRefreshKey} />}
            {activeTab === 'notes'        && <NotesTab clientId={id} />}
            {activeTab === 'documents'    && <DocumentsTab clientId={id} clientName={client.name} />}
            {activeTab === 'packages'     && <PackagesTab clientId={id} />}
            {activeTab === 'add-ons'      && <AddOnsTab clientId={id} />}
            {activeTab === 'tasks'        && <TasksTab clientId={id} />}
            {activeTab === 'birth'        && (
              <BirthDetailsTab
                clientId={id}
                doulaId={user?.id    ?? ''}
                orgId={user?.orgId   ?? ''}
              />
            )}
          </div>
        </div>
      </div>

      {/* Intake Link Modal */}
      <IntakeLinkModal
        open={intakeModalOpen}
        token={intakeToken}
        generating={intakeGenerating}
        onClose={() => { setIntakeModalOpen(false); setIntakeToken(null); }}
      />

      {/* Schedule Modal */}
      <ScheduleAppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clientId={id}
        onSaved={() => {
          setApptRefreshKey(k => k + 1);
          setActiveTab('appointments');
        }}
      />

    </div>
  );
}
