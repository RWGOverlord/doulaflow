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
import { generateIntakeToken, getClientIntakeForm, upsertClientIntakeForm, type ClientIntakeForm } from '@/features/intake/api/intake.api';
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
  appointment_type_id: number | null;
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
  const pill    = APPT_STATUS[appt.status] ?? APPT_STATUS.scheduled;
  const isAdhoc = appt.appointment_type_id === null;
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-medium text-sm">{appt.appointment_types?.name ?? appt.title ?? 'Appointment'}</div>
          {isAdhoc && (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              External
            </span>
          )}
        </div>
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
  title:    string;
  duration: string;
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
    defaultValues: { date: '', time: '10:00', status: 'scheduled', location: '', notes: '', title: '', duration: '60' },
  });

  const watchDate     = watch('date');
  const watchTime     = watch('time');
  const watchDuration = watch('duration');

  useEffect(() => {
    if (!appt) return;
    const d = new Date(appt.starts_at);
    const computedDuration = Math.round(
      (new Date(appt.ends_at).getTime() - d.getTime()) / 60_000
    );
    reset({
      date:     d.toLocaleDateString('en-CA'),
      time:     `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
      status:   appt.status,
      location: appt.location ?? '',
      notes:    appt.notes ?? '',
      title:    appt.title ?? '',
      duration: String(computedDuration || 60),
    });
    setError(null);
  }, [appt, reset]);

  const isAdhoc      = appt?.appointment_type_id === null;
  const durationMins = isAdhoc
    ? (Number(watchDuration) || 60)
    : (appt?.appointment_types?.duration_minutes ?? 60);

  const endPreview = watchDate && watchTime
    ? new Date(new Date(`${watchDate}T${watchTime}:00`).getTime() + durationMins * 60_000)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  async function onSubmit(values: EditApptFormValues) {
    if (!appt) return;
    setSaving(true); setError(null);
    const startsAt = new Date(`${values.date}T${values.time}:00`).toISOString();
    const endsAt   = new Date(new Date(startsAt).getTime() + durationMins * 60_000).toISOString();
    const update: Record<string, any> = {
      starts_at: startsAt, ends_at: endsAt,
      status:    values.status,
      location:  values.location || null,
      notes:     values.notes    || null,
    };
    if (isAdhoc) update.title = values.title || null;
    const { data, error: err } = await supabase
      .from('appointments')
      .update(update)
      .eq('id', appt.id)
      .select('id, title, appointment_type_id, starts_at, ends_at, status, location, notes, appointment_types(name, duration_minutes, mode)')
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
            {isAdhoc ? (
              <div className="space-y-1.5">
                <Label>Appointment Title</Label>
                <div className="flex items-center gap-2">
                  <Input {...register('title')} className="flex-1" />
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 shrink-0">
                    External
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm font-medium">
                {appt.appointment_types?.name ?? appt.title ?? 'Appointment'}
              </div>
            )}

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

            {isAdhoc && (
              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input type="number" min="1" {...register('duration')} />
              </div>
            )}

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
      .select(`id, title, appointment_type_id, starts_at, ends_at, status, location, notes,
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

// ─── Intake Form Tab ──────────────────────────────────────────────────────────

type IntakeFormValues = {
  preferred_contact_method: string;
  emergency_contact: string;
  provider_name: string;
  birth_location: string;
  chose_provider_specifically: string;
  comfortable_with_provider: string;
  due_date: string;
  expecting_multiples: string;
  baby_gender: string;
  baby_name: string;
  pregnancy_experience: string;
  current_health_conditions: string;
  pregnancy_number: string;
  previous_births: string;
  birth_experiences: string[];
  previous_labor_length: string;
  past_pregnancy_conditions: string;
  medical_history: string;
  birth_preparation: string;
  birth_vision: string;
  has_birth_plan: string;
  shared_preferences_with_provider: string;
  provider_knows_doula: string;
  early_labor_contact: string;
  post_dates_protocols: string;
  partner_role: string;
  additional_birth_attendees: string;
  unwanted_attendees: string;
  fears_concerns: string;
  religious_cultural_beliefs: string;
  comforting_in_pain: string;
  doula_support_vision: string;
  nursing_experience: string;
  feeding_concerns: string;
  postpartum_support: string;
  additional_questions: string;
};

const BIRTH_EXPERIENCE_OPTIONS = [
  'This will be my first birth',
  'Vaginal',
  'Cesarean',
  'VBAC',
  'Elective induction',
  'Induction for medical reasons',
  'Home birth',
  'Hospital birth',
  'Birth center birth',
  'Water birth',
  'Breech birth',
];

function buildIntakeFormValues(form: ClientIntakeForm | null): IntakeFormValues {
  return {
    preferred_contact_method:        form?.preferred_contact_method       ?? '',
    emergency_contact:               form?.emergency_contact              ?? '',
    provider_name:                   form?.provider_name                  ?? '',
    birth_location:                  form?.birth_location                 ?? '',
    chose_provider_specifically:     form?.chose_provider_specifically    ?? '',
    comfortable_with_provider:       form?.comfortable_with_provider      ?? '',
    due_date:                        form?.due_date?.substring(0, 10)     ?? '',
    expecting_multiples:             form?.expecting_multiples != null ? String(form.expecting_multiples) : '',
    baby_gender:                     form?.baby_gender                    ?? '',
    baby_name:                       form?.baby_name                      ?? '',
    pregnancy_experience:            form?.pregnancy_experience           ?? '',
    current_health_conditions:       form?.current_health_conditions      ?? '',
    pregnancy_number:                form?.pregnancy_number               ?? '',
    previous_births:                 form?.previous_births                ?? '',
    birth_experiences:               form?.birth_experiences
                                       ? form.birth_experiences.split(',').map(s => s.trim()).filter(Boolean)
                                       : [],
    previous_labor_length:           form?.previous_labor_length          ?? '',
    past_pregnancy_conditions:       form?.past_pregnancy_conditions      ?? '',
    medical_history:                 form?.medical_history                ?? '',
    birth_preparation:               form?.birth_preparation              ?? '',
    birth_vision:                    form?.birth_vision                   ?? '',
    has_birth_plan:                  form?.has_birth_plan                 ?? '',
    shared_preferences_with_provider: form?.shared_preferences_with_provider ?? '',
    provider_knows_doula:            form?.provider_knows_doula           ?? '',
    early_labor_contact:             form?.early_labor_contact            ?? '',
    post_dates_protocols:            form?.post_dates_protocols           ?? '',
    partner_role:                    form?.partner_role                   ?? '',
    additional_birth_attendees:      form?.additional_birth_attendees     ?? '',
    unwanted_attendees:              form?.unwanted_attendees             ?? '',
    fears_concerns:                  form?.fears_concerns                 ?? '',
    religious_cultural_beliefs:      form?.religious_cultural_beliefs     ?? '',
    comforting_in_pain:              form?.comforting_in_pain             ?? '',
    doula_support_vision:            form?.doula_support_vision           ?? '',
    nursing_experience:              form?.nursing_experience             ?? '',
    feeding_concerns:                form?.feeding_concerns               ?? '',
    postpartum_support:              form?.postpartum_support             ?? '',
    additional_questions:            form?.additional_questions           ?? '',
  };
}

function IntakeField({ label, value }: { label?: string; value?: string | null }) {
  if (!label) return <div className="text-sm leading-relaxed whitespace-pre-wrap">{value || '—'}</div>;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{value || '—'}</div>
    </div>
  );
}

function IntakePills({ value }: { value?: string | null }) {
  const items = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!items.length) return <span className="text-sm">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <span key={item} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

function IntakeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="px-5 py-3 border-b">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

function IntakeFormEditModal({
  open, clientId, orgId, form, onClose, onSaved,
}: {
  open:     boolean;
  clientId: string;
  orgId:    string;
  form:     ClientIntakeForm | null;
  onClose:  () => void;
  onSaved:  (updated: ClientIntakeForm) => void;
}) {
  const [vals, setVals]   = useState<IntakeFormValues>(() => buildIntakeFormValues(form));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setVals(buildIntakeFormValues(form));
      setError(null);
    }
  }, [open, form]);

  function set(key: keyof IntakeFormValues, value: string) {
    setVals(prev => ({ ...prev, [key]: value }));
  }

  function toggleBirthExp(option: string) {
    setVals(prev => {
      const updated = prev.birth_experiences.includes(option)
        ? prev.birth_experiences.filter(x => x !== option)
        : [...prev.birth_experiences, option];
      return { ...prev, birth_experiences: updated };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<ClientIntakeForm> = {
        preferred_contact_method:         vals.preferred_contact_method         || null,
        emergency_contact:                vals.emergency_contact                || null,
        provider_name:                    vals.provider_name                    || null,
        birth_location:                   vals.birth_location                   || null,
        chose_provider_specifically:      vals.chose_provider_specifically      || null,
        comfortable_with_provider:        vals.comfortable_with_provider        || null,
        due_date:                         vals.due_date                         || null,
        expecting_multiples:              vals.expecting_multiples ? parseInt(vals.expecting_multiples) : null,
        baby_gender:                      vals.baby_gender                      || null,
        baby_name:                        vals.baby_name                        || null,
        pregnancy_experience:             vals.pregnancy_experience             || null,
        current_health_conditions:        vals.current_health_conditions        || null,
        pregnancy_number:                 vals.pregnancy_number                 || null,
        previous_births:                  vals.previous_births                  || null,
        birth_experiences:                vals.birth_experiences.length > 0 ? vals.birth_experiences.join(', ') : null,
        previous_labor_length:            vals.previous_labor_length            || null,
        past_pregnancy_conditions:        vals.past_pregnancy_conditions        || null,
        medical_history:                  vals.medical_history                  || null,
        birth_preparation:                vals.birth_preparation                || null,
        birth_vision:                     vals.birth_vision                     || null,
        has_birth_plan:                   vals.has_birth_plan                   || null,
        shared_preferences_with_provider: vals.shared_preferences_with_provider || null,
        provider_knows_doula:             vals.provider_knows_doula             || null,
        early_labor_contact:              vals.early_labor_contact              || null,
        post_dates_protocols:             vals.post_dates_protocols             || null,
        partner_role:                     vals.partner_role                     || null,
        additional_birth_attendees:       vals.additional_birth_attendees       || null,
        unwanted_attendees:               vals.unwanted_attendees               || null,
        fears_concerns:                   vals.fears_concerns                   || null,
        religious_cultural_beliefs:       vals.religious_cultural_beliefs       || null,
        comforting_in_pain:               vals.comforting_in_pain               || null,
        doula_support_vision:             vals.doula_support_vision             || null,
        nursing_experience:               vals.nursing_experience               || null,
        feeding_concerns:                 vals.feeding_concerns                 || null,
        postpartum_support:               vals.postpartum_support               || null,
        additional_questions:             vals.additional_questions             || null,
      };
      const result = await upsertClientIntakeForm(clientId, orgId, payload);
      onSaved(result);
    } catch (err: any) {
      setError(err?.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const ta = (key: keyof IntakeFormValues, rows: number) => (
    <textarea
      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
      rows={rows}
      value={vals[key] as string}
      onChange={e => set(key, e.target.value)}
    />
  );

  const sel = (key: keyof IntakeFormValues, options: { value: string; label: string }[]) => (
    <select
      className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
      value={vals[key] as string}
      onChange={e => set(key, e.target.value)}
    >
      <option value="">—</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Edit Intake Form</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="space-y-7">

            {/* Contact Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4 pb-2 border-b">Contact Details</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Preferred contact method</Label>
                  {sel('preferred_contact_method', [
                    { value: 'Phone', label: 'Phone' },
                    { value: 'Email', label: 'Email' },
                    { value: 'Text',  label: 'Text'  },
                    { value: 'Any',   label: 'Any'   },
                  ])}
                </div>
                <div className="space-y-1.5">
                  <Label>Emergency contact</Label>
                  <Input value={vals.emergency_contact} onChange={e => set('emergency_contact', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Care Team */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4 pb-2 border-b">Care Team</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Midwife / OBGYN name</Label>
                  <Input value={vals.provider_name} onChange={e => set('provider_name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery location</Label>
                  <Input value={vals.birth_location} onChange={e => set('birth_location', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Did you specifically choose your provider?</Label>
                  {sel('chose_provider_specifically', [
                    { value: 'Yes',    label: 'Yes'    },
                    { value: 'No',     label: 'No'     },
                    { value: 'Unsure', label: 'Unsure' },
                  ])}
                </div>
                <div className="space-y-1.5">
                  <Label>Are you comfortable with your provider?</Label>
                  {sel('comfortable_with_provider', [
                    { value: 'Yes',    label: 'Yes'    },
                    { value: 'No',     label: 'No'     },
                    { value: 'Unsure', label: 'Unsure' },
                  ])}
                </div>
              </div>
            </div>

            {/* Pregnancy Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4 pb-2 border-b">Pregnancy Details</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Estimated due date</Label>
                  <Input type="date" value={vals.due_date} onChange={e => set('due_date', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>If expecting multiples, how many?</Label>
                  <Input type="number" min="2" placeholder="e.g. 2" value={vals.expecting_multiples} onChange={e => set('expecting_multiples', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Baby&apos;s gender</Label>
                  {sel('baby_gender', [
                    { value: 'Male',     label: 'Male'     },
                    { value: 'Female',   label: 'Female'   },
                    { value: 'Unknown',  label: 'Unknown'  },
                    { value: 'Surprise', label: 'Surprise' },
                    { value: 'Multiple', label: 'Multiple' },
                  ])}
                </div>
                <div className="space-y-1.5">
                  <Label>Have you chosen a name?</Label>
                  <Input value={vals.baby_name} onChange={e => set('baby_name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Overall, how has your pregnancy been?</Label>
                  {ta('pregnancy_experience', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>Current pregnancy-related health conditions</Label>
                  {ta('current_health_conditions', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>Pregnancy number</Label>
                  <Input value={vals.pregnancy_number} onChange={e => set('pregnancy_number', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Number of previous births</Label>
                  <Input value={vals.previous_births} onChange={e => set('previous_births', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Birth experiences</Label>
                  <div className="space-y-2 pt-0.5">
                    {BIRTH_EXPERIENCE_OPTIONS.map(opt => (
                      <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-muted-foreground/40"
                          checked={vals.birth_experiences.includes(opt)}
                          onChange={() => toggleBirthExp(opt)}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>How long was your previous labor(s)?</Label>
                  <Input value={vals.previous_labor_length} onChange={e => set('previous_labor_length', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Past pregnancy-related health conditions</Label>
                  {ta('past_pregnancy_conditions', 3)}
                </div>
              </div>
            </div>

            {/* Medical History */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4 pb-2 border-b">Medical History</h3>
              {ta('medical_history', 4)}
            </div>

            {/* Birth Preferences */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4 pb-2 border-b">Birth Preferences</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>What have you done to prepare for birth?</Label>
                  {ta('birth_preparation', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>What is your birth vision?</Label>
                  {ta('birth_vision', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>Do you have a birth plan?</Label>
                  {sel('has_birth_plan', [
                    { value: 'Yes',                       label: 'Yes'                       },
                    { value: 'No',                        label: 'No'                        },
                    { value: 'We will create one together', label: 'We will create one together' },
                  ])}
                </div>
                <div className="space-y-1.5">
                  <Label>Shared birth preferences with provider?</Label>
                  {sel('shared_preferences_with_provider', [
                    { value: 'Yes',     label: 'Yes'     },
                    { value: 'No',      label: 'No'      },
                    { value: 'Not yet', label: 'Not yet' },
                  ])}
                </div>
                <div className="space-y-1.5">
                  <Label>Does your provider know a doula will be present?</Label>
                  {sel('provider_knows_doula', [
                    { value: 'Yes',     label: 'Yes'     },
                    { value: 'No',      label: 'No'      },
                    { value: 'Not yet', label: 'Not yet' },
                  ])}
                </div>
                <div className="space-y-1.5">
                  <Label>When does your provider want to be contacted in early labor?</Label>
                  <Input value={vals.early_labor_contact} onChange={e => set('early_labor_contact', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Post-dates protocols discussed with provider?</Label>
                  {ta('post_dates_protocols', 2)}
                </div>
                <div className="space-y-1.5">
                  <Label>Partner&apos;s role at birth</Label>
                  {ta('partner_role', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>Additional birth attendees</Label>
                  {ta('additional_birth_attendees', 2)}
                </div>
                <div className="space-y-1.5">
                  <Label>Anyone not wanted at birth</Label>
                  {ta('unwanted_attendees', 2)}
                </div>
              </div>
            </div>

            {/* Support & Concerns */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4 pb-2 border-b">Support & Concerns</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Fears or concerns about this birth</Label>
                  {ta('fears_concerns', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>Religious or cultural beliefs</Label>
                  {ta('religious_cultural_beliefs', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>What has been comforting in painful situations?</Label>
                  {ta('comforting_in_pain', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>How do you envision doula support being most helpful?</Label>
                  {ta('doula_support_vision', 3)}
                </div>
              </div>
            </div>

            {/* Postpartum */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4 pb-2 border-b">Postpartum</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Experience with nursing</Label>
                  {ta('nursing_experience', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>Concerns about feeding</Label>
                  {ta('feeding_concerns', 3)}
                </div>
                <div className="space-y-1.5">
                  <Label>Postpartum support available</Label>
                  {ta('postpartum_support', 3)}
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4 pb-2 border-b">Additional Notes</h3>
              <div className="space-y-1.5">
                <Label>Additional questions or notes</Label>
                {ta('additional_questions', 4)}
              </div>
            </div>

          </div>
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IntakeFormTab({ clientId, orgId }: { clientId: string; orgId: string }) {
  const [form, setForm]     = useState<ClientIntakeForm | null | undefined>(undefined);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    getClientIntakeForm(clientId)
      .then(d => setForm(d))
      .catch(() => setForm(null));
  }, [clientId]);

  if (form === undefined) return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;

  if (!form) {
    return (
      <>
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">No intake form data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Send the client an intake form link or fill it in manually</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditOpen(true)}>
            Fill in manually
          </Button>
        </div>
        <IntakeFormEditModal
          open={editOpen}
          clientId={clientId}
          orgId={orgId}
          form={null}
          onClose={() => setEditOpen(false)}
          onSaved={updated => { setForm(updated); setEditOpen(false); }}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>

        <IntakeSection title="Contact Details">
          <IntakeField label="Preferred contact method" value={form.preferred_contact_method} />
          <IntakeField label="Emergency contact" value={form.emergency_contact} />
        </IntakeSection>

        <IntakeSection title="Care Team">
          <IntakeField label="Midwife / OBGYN name" value={form.provider_name} />
          <IntakeField label="Delivery location" value={form.birth_location} />
          <IntakeField label="Did you specifically choose your provider?" value={form.chose_provider_specifically} />
          <IntakeField label="Are you comfortable with your provider?" value={form.comfortable_with_provider} />
        </IntakeSection>

        <IntakeSection title="Pregnancy Details">
          <IntakeField label="Estimated due date" value={form.due_date ? fmtDate(form.due_date) : null} />
          <IntakeField label="If expecting multiples, how many?" value={form.expecting_multiples != null ? String(form.expecting_multiples) : null} />
          <IntakeField label="Baby's gender" value={form.baby_gender} />
          <IntakeField label="Have you chosen a name?" value={form.baby_name} />
          <IntakeField label="Overall, how has your pregnancy been?" value={form.pregnancy_experience} />
          <IntakeField label="Current pregnancy-related health conditions" value={form.current_health_conditions} />
          <IntakeField label="Pregnancy number" value={form.pregnancy_number} />
          <IntakeField label="Number of previous births" value={form.previous_births} />
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Birth experiences</div>
            <IntakePills value={form.birth_experiences} />
          </div>
          <IntakeField label="How long was your previous labor(s)?" value={form.previous_labor_length} />
          <IntakeField label="Past pregnancy-related health conditions" value={form.past_pregnancy_conditions} />
        </IntakeSection>

        <IntakeSection title="Medical History">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{form.medical_history || '—'}</div>
        </IntakeSection>

        <IntakeSection title="Birth Preferences">
          <IntakeField label="What have you done to prepare for birth?" value={form.birth_preparation} />
          <IntakeField label="What is your birth vision?" value={form.birth_vision} />
          <IntakeField label="Do you have a birth plan?" value={form.has_birth_plan} />
          <IntakeField label="Shared birth preferences with provider?" value={form.shared_preferences_with_provider} />
          <IntakeField label="Does your provider know a doula will be present?" value={form.provider_knows_doula} />
          <IntakeField label="When does your provider want to be contacted in early labor?" value={form.early_labor_contact} />
          <IntakeField label="Post-dates protocols discussed with provider?" value={form.post_dates_protocols} />
          <IntakeField label="Partner's role at birth" value={form.partner_role} />
          <IntakeField label="Additional birth attendees" value={form.additional_birth_attendees} />
          <IntakeField label="Anyone not wanted at birth" value={form.unwanted_attendees} />
        </IntakeSection>

        <IntakeSection title="Support & Concerns">
          <IntakeField label="Fears or concerns about this birth" value={form.fears_concerns} />
          <IntakeField label="Religious or cultural beliefs" value={form.religious_cultural_beliefs} />
          <IntakeField label="What has been comforting in painful situations?" value={form.comforting_in_pain} />
          <IntakeField label="How do you envision doula support being most helpful?" value={form.doula_support_vision} />
        </IntakeSection>

        <IntakeSection title="Postpartum">
          <IntakeField label="Experience with nursing" value={form.nursing_experience} />
          <IntakeField label="Concerns about feeding" value={form.feeding_concerns} />
          <IntakeField label="Postpartum support available" value={form.postpartum_support} />
        </IntakeSection>

        <IntakeSection title="Additional Notes">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{form.additional_questions || '—'}</div>
        </IntakeSection>
      </div>

      <IntakeFormEditModal
        open={editOpen}
        clientId={clientId}
        orgId={orgId}
        form={form}
        onClose={() => setEditOpen(false)}
        onSaved={updated => { setForm(updated); setEditOpen(false); }}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ['appointments', 'intake', 'notes', 'documents', 'packages', 'add-ons', 'tasks', 'birth'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  appointments: 'Appointments',
  intake:       'Intake Form',
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
            {activeTab === 'intake'       && <IntakeFormTab clientId={id} orgId={user?.orgId ?? ''} />}
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
