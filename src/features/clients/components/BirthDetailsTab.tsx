// src/features/clients/components/BirthDetailsTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Baby, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  getBirthDetails,
  upsertBirthDetails,
  type BirthDetails,
} from '@/features/clients/api/birthDetails.api';

// ─── Display helpers ──────────────────────────────────────────────────────────

function fmtBool(v: boolean | null | undefined): string {
  if (v == null) return '—';
  return v ? 'Yes' : 'No';
}

function fmtMinutes(m: number | null | undefined): string {
  if (m == null) return '—';
  const h   = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0)   return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function fmtOz(oz: number | null | undefined): string {
  if (oz == null) return '—';
  const lbs = Math.floor(oz / 16);
  const rem = oz % 16;
  return `${lbs} lbs ${rem} oz`;
}

function fmtGestational(weeks: number | null | undefined, days: number | null | undefined): string {
  if (weeks == null && days == null) return '—';
  const parts: string[] = [];
  if (weeks != null) parts.push(`${weeks} weeks`);
  if (days  != null) parts.push(`${days} days`);
  return parts.join(' ') || '—';
}

function fmtDateLocal(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTimeLocal(t: string | null | undefined): string {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const dt = new Date();
  dt.setHours(parseInt(h), parseInt(m), 0);
  return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-') + 'T' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':');
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Male', female: 'Female', unknown: 'Unknown',
  surprise: 'Surprise', multiple: 'Multiple',
};
const LOCATION_LABELS: Record<string, string> = {
  home: 'Home', birth_center: 'Birth Center', hospital: 'Hospital', other: 'Other',
};
const DELIVERY_LABELS: Record<string, string> = {
  vaginal: 'Vaginal', cesarean: 'Cesarean', vbac: 'VBAC',
  assisted: 'Assisted', unknown: 'Unknown',
};

// ─── Display sub-components ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-muted/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value || '—'}</div>
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  baby_gender: string;
  baby_count: string;
  is_twins: boolean;
  birth_date: string;
  birth_time: string;
  labor_started_at: string;
  birth_occurred_at: string;
  labor_length_minutes: string;
  birth_location_type: string;
  birth_location_name: string;
  birth_city: string;
  delivery_type: string;
  induction_used: boolean;
  epidural_used: boolean;
  transfer_occurred: boolean;
  transfer_from: string;
  transfer_to: string;
  gestational_weeks: string;
  gestational_days: string;
  baby_weight_oz: string;
  baby_length_in: string;
  breastfeeding_started: boolean;
  skin_to_skin: boolean;
  doula_arrived_at: string;
  doula_left_at: string;
  doula_support_minutes: string;
  birth_notes: string;
  outcome_notes: string;
};

const emptyForm: FormState = {
  baby_gender: '', baby_count: '1', is_twins: false,
  birth_date: '', birth_time: '',
  labor_started_at: '', birth_occurred_at: '', labor_length_minutes: '',
  birth_location_type: '', birth_location_name: '', birth_city: '',
  delivery_type: '',
  induction_used: false, epidural_used: false,
  transfer_occurred: false, transfer_from: '', transfer_to: '',
  gestational_weeks: '', gestational_days: '',
  baby_weight_oz: '', baby_length_in: '',
  breastfeeding_started: false, skin_to_skin: false,
  doula_arrived_at: '', doula_left_at: '', doula_support_minutes: '',
  birth_notes: '', outcome_notes: '',
};

function detailsToForm(d: BirthDetails): FormState {
  return {
    baby_gender:           d.baby_gender           ?? '',
    baby_count:            String(d.baby_count      ?? 1),
    is_twins:              d.is_twins               ?? false,
    birth_date:            d.birth_date             ?? '',
    birth_time:            d.birth_time             ?? '',
    labor_started_at:      toDatetimeLocal(d.labor_started_at),
    birth_occurred_at:     toDatetimeLocal(d.birth_occurred_at),
    labor_length_minutes:  d.labor_length_minutes   != null ? String(d.labor_length_minutes)  : '',
    birth_location_type:   d.birth_location_type    ?? '',
    birth_location_name:   d.birth_location_name    ?? '',
    birth_city:            d.birth_city             ?? '',
    delivery_type:         d.delivery_type          ?? '',
    induction_used:        d.induction_used         ?? false,
    epidural_used:         d.epidural_used          ?? false,
    transfer_occurred:     d.transfer_occurred      ?? false,
    transfer_from:         d.transfer_from          ?? '',
    transfer_to:           d.transfer_to            ?? '',
    gestational_weeks:     d.gestational_weeks      != null ? String(d.gestational_weeks)      : '',
    gestational_days:      d.gestational_days       != null ? String(d.gestational_days)       : '',
    baby_weight_oz:        d.baby_weight_oz         != null ? String(d.baby_weight_oz)         : '',
    baby_length_in:        d.baby_length_in         != null ? String(d.baby_length_in)         : '',
    breastfeeding_started: d.breastfeeding_started  ?? false,
    skin_to_skin:          d.skin_to_skin           ?? false,
    doula_arrived_at:      toDatetimeLocal(d.doula_arrived_at),
    doula_left_at:         toDatetimeLocal(d.doula_left_at),
    doula_support_minutes: d.doula_support_minutes  != null ? String(d.doula_support_minutes)  : '',
    birth_notes:           d.birth_notes            ?? '',
    outcome_notes:         d.outcome_notes          ?? '',
  };
}

// ─── Form section divider ─────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
          {title}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BirthDetailsTab({
  clientId,
  doulaId,
  orgId,
}: {
  clientId: string;
  doulaId:  string;
  orgId:    string;
}) {
  const [details, setDetails] = useState<BirthDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm]         = useState<FormState>(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    getBirthDetails(clientId)
      .then(setDetails)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId]);

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit() {
    setForm(details ? detailsToForm(details) : emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Auto-calculate labor_length_minutes from timestamps if blank
      let laborMins = form.labor_length_minutes ? parseInt(form.labor_length_minutes) : null;
      if (!laborMins && form.labor_started_at && form.birth_occurred_at) {
        laborMins = Math.round(
          (new Date(form.birth_occurred_at).getTime() - new Date(form.labor_started_at).getTime()) / 60000
        );
      }
      // Auto-calculate doula_support_minutes from timestamps if blank
      let doulaSupport = form.doula_support_minutes ? parseInt(form.doula_support_minutes) : null;
      if (!doulaSupport && form.doula_arrived_at && form.doula_left_at) {
        doulaSupport = Math.round(
          (new Date(form.doula_left_at).getTime() - new Date(form.doula_arrived_at).getTime()) / 60000
        );
      }

      const payload: Partial<BirthDetails> = {
        baby_gender:           (form.baby_gender          || null) as BirthDetails['baby_gender'],
        baby_count:            parseInt(form.baby_count)  || 1,
        is_twins:              form.is_twins,
        birth_date:            form.birth_date            || null,
        birth_time:            form.birth_time            || null,
        labor_started_at:      form.labor_started_at      ? new Date(form.labor_started_at).toISOString()   : null,
        birth_occurred_at:     form.birth_occurred_at     ? new Date(form.birth_occurred_at).toISOString()  : null,
        labor_length_minutes:  laborMins,
        birth_location_type:   (form.birth_location_type  || null) as BirthDetails['birth_location_type'],
        birth_location_name:   form.birth_location_name   || null,
        birth_city:            form.birth_city            || null,
        delivery_type:         (form.delivery_type        || null) as BirthDetails['delivery_type'],
        induction_used:        form.induction_used,
        epidural_used:         form.epidural_used,
        transfer_occurred:     form.transfer_occurred,
        transfer_from:         form.transfer_occurred ? (form.transfer_from || null) : null,
        transfer_to:           form.transfer_occurred ? (form.transfer_to   || null) : null,
        gestational_weeks:     form.gestational_weeks  ? parseInt(form.gestational_weeks)  : null,
        gestational_days:      form.gestational_days   ? parseInt(form.gestational_days)   : null,
        baby_weight_oz:        form.baby_weight_oz     ? parseFloat(form.baby_weight_oz)   : null,
        baby_length_in:        form.baby_length_in     ? parseFloat(form.baby_length_in)   : null,
        breastfeeding_started: form.breastfeeding_started,
        skin_to_skin:          form.skin_to_skin,
        doula_arrived_at:      form.doula_arrived_at   ? new Date(form.doula_arrived_at).toISOString()  : null,
        doula_left_at:         form.doula_left_at      ? new Date(form.doula_left_at).toISOString()     : null,
        doula_support_minutes: doulaSupport,
        birth_notes:           form.birth_notes        || null,
        outcome_notes:         form.outcome_notes      || null,
      };

      const saved = await upsertBirthDetails(clientId, orgId, doulaId, payload);
      setDetails(saved);
      setFormOpen(false);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save birth details.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
  );

  return (
    <>
      {!details ? (
        /* ── Empty state ── */
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Baby className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No birth details recorded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Record the details after your client gives birth
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
            Record Birth Details
          </Button>
        </div>
      ) : (
        /* ── Filled state ── */
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit Birth Details
            </Button>
          </div>

          {/* Baby */}
          <Section title="Baby">
            <Row label="Gender"
              value={details.baby_gender ? (GENDER_LABELS[details.baby_gender] ?? details.baby_gender) : '—'} />
            <Row label="Baby Count" value={String(details.baby_count)} />
            <Row label="Twins" value={fmtBool(details.is_twins)} />
            <Row label="Birth Date" value={fmtDateLocal(details.birth_date)} />
            <Row label="Birth Time" value={fmtTimeLocal(details.birth_time)} />
            <Row label="Gestational Age"
              value={fmtGestational(details.gestational_weeks, details.gestational_days)} />
          </Section>

          {/* Birth Story */}
          <Section title="Birth Story">
            <Row label="Labor Started"    value={fmtDateTime(details.labor_started_at)} />
            <Row label="Birth Occurred"   value={fmtDateTime(details.birth_occurred_at)} />
            <Row label="Labor Length"     value={fmtMinutes(details.labor_length_minutes)} />
            <Row label="Location Type"
              value={details.birth_location_type
                ? (LOCATION_LABELS[details.birth_location_type] ?? details.birth_location_type)
                : '—'} />
            <Row label="Location Name"   value={details.birth_location_name ?? '—'} />
            <Row label="City"            value={details.birth_city ?? '—'} />
            <Row label="Delivery Type"
              value={details.delivery_type
                ? (DELIVERY_LABELS[details.delivery_type] ?? details.delivery_type)
                : '—'} />
          </Section>

          {/* Interventions */}
          <Section title="Interventions">
            <Row label="Induction Used"     value={fmtBool(details.induction_used)} />
            <Row label="Epidural Used"      value={fmtBool(details.epidural_used)} />
            <Row label="Transfer Occurred"  value={fmtBool(details.transfer_occurred)} />
            {details.transfer_occurred && (
              <>
                <Row label="Transfer From" value={details.transfer_from ?? '—'} />
                <Row label="Transfer To"   value={details.transfer_to   ?? '—'} />
              </>
            )}
          </Section>

          {/* Measurements */}
          <Section title="Measurements">
            <Row label="Baby Weight" value={fmtOz(details.baby_weight_oz)} />
            <Row label="Baby Length"
              value={details.baby_length_in != null ? `${details.baby_length_in} in` : '—'} />
          </Section>

          {/* Postpartum */}
          <Section title="Postpartum">
            <Row label="Breastfeeding Started" value={fmtBool(details.breastfeeding_started)} />
            <Row label="Skin to Skin"          value={fmtBool(details.skin_to_skin)} />
          </Section>

          {/* Doula Support */}
          <Section title="Doula Support">
            <Row label="Arrived At"        value={fmtDateTime(details.doula_arrived_at)} />
            <Row label="Left At"           value={fmtDateTime(details.doula_left_at)} />
            <Row label="Total Support Time" value={fmtMinutes(details.doula_support_minutes)} />
          </Section>

          {/* Notes */}
          <div className="rounded-xl border bg-background overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
            </div>
            <div className="px-4 py-3 space-y-4">
              {details.birth_notes ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Birth Notes</div>
                  <div className="text-sm leading-relaxed whitespace-pre-line">{details.birth_notes}</div>
                </div>
              ) : null}
              {details.outcome_notes ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Outcome Notes</div>
                  <div className="text-sm leading-relaxed whitespace-pre-line">{details.outcome_notes}</div>
                </div>
              ) : null}
              {!details.birth_notes && !details.outcome_notes && (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Form dialog ── */}
      <Dialog open={formOpen} onOpenChange={o => { if (!o) setFormOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{details ? 'Edit Birth Details' : 'Record Birth Details'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-1">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Baby */}
            <FormSection title="Baby">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
                    value={form.baby_gender} onChange={e => set('baby_gender', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="unknown">Unknown</option>
                    <option value="surprise">Surprise</option>
                    <option value="multiple">Multiple</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Baby Count</Label>
                  <Input type="number" min="1"
                    value={form.baby_count} onChange={e => set('baby_count', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Birth Date</Label>
                  <Input type="date"
                    value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Birth Time</Label>
                  <Input type="time"
                    value={form.birth_time} onChange={e => set('birth_time', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gestational Weeks</Label>
                  <Input type="number" min="20" max="45" placeholder="38"
                    value={form.gestational_weeks} onChange={e => set('gestational_weeks', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gestational Days</Label>
                  <Input type="number" min="0" max="6" placeholder="0"
                    value={form.gestational_days} onChange={e => set('gestational_days', e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_twins" checked={form.is_twins}
                    onChange={e => set('is_twins', e.target.checked)}
                    className="h-4 w-4 rounded border-muted-foreground/30 accent-primary" />
                  <label htmlFor="is_twins" className="text-sm">Twins</label>
                </div>
              </div>
            </FormSection>

            {/* Birth Story */}
            <FormSection title="Birth Story">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Labor Started</Label>
                  <Input type="datetime-local"
                    value={form.labor_started_at} onChange={e => set('labor_started_at', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Birth Occurred</Label>
                  <Input type="datetime-local"
                    value={form.birth_occurred_at} onChange={e => set('birth_occurred_at', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Labor Length (minutes)</Label>
                  <Input type="number" placeholder="Auto-calculated if blank"
                    value={form.labor_length_minutes}
                    onChange={e => set('labor_length_minutes', e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to auto-calculate from timestamps
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Location Type</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
                    value={form.birth_location_type}
                    onChange={e => set('birth_location_type', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="home">Home</option>
                    <option value="birth_center">Birth Center</option>
                    <option value="hospital">Hospital</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Location Name</Label>
                  <Input placeholder="e.g. St. Mary's Hospital"
                    value={form.birth_location_name}
                    onChange={e => set('birth_location_name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input placeholder="Nashville"
                    value={form.birth_city} onChange={e => set('birth_city', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery Type</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
                    value={form.delivery_type} onChange={e => set('delivery_type', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="vaginal">Vaginal</option>
                    <option value="cesarean">Cesarean</option>
                    <option value="vbac">VBAC</option>
                    <option value="assisted">Assisted</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
            </FormSection>

            {/* Interventions */}
            <FormSection title="Interventions">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="induction_used" checked={form.induction_used}
                    onChange={e => set('induction_used', e.target.checked)}
                    className="h-4 w-4 rounded border-muted-foreground/30 accent-primary" />
                  <label htmlFor="induction_used" className="text-sm">Induction Used</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="epidural_used" checked={form.epidural_used}
                    onChange={e => set('epidural_used', e.target.checked)}
                    className="h-4 w-4 rounded border-muted-foreground/30 accent-primary" />
                  <label htmlFor="epidural_used" className="text-sm">Epidural Used</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="transfer_occurred" checked={form.transfer_occurred}
                    onChange={e => set('transfer_occurred', e.target.checked)}
                    className="h-4 w-4 rounded border-muted-foreground/30 accent-primary" />
                  <label htmlFor="transfer_occurred" className="text-sm">Transfer Occurred</label>
                </div>
                {form.transfer_occurred && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Transfer From</Label>
                      <Input placeholder="e.g. Home"
                        value={form.transfer_from} onChange={e => set('transfer_from', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Transfer To</Label>
                      <Input placeholder="e.g. St. Mary's Hospital"
                        value={form.transfer_to} onChange={e => set('transfer_to', e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </FormSection>

            {/* Measurements */}
            <FormSection title="Measurements">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Baby Weight (total ounces)</Label>
                  <Input type="number" placeholder="e.g. 116"
                    value={form.baby_weight_oz} onChange={e => set('baby_weight_oz', e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Enter total ounces (e.g. 116 for 7 lbs 4 oz)
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Baby Length (inches)</Label>
                  <Input type="number" step="0.1" placeholder="e.g. 20.5"
                    value={form.baby_length_in} onChange={e => set('baby_length_in', e.target.value)} />
                </div>
              </div>
            </FormSection>

            {/* Postpartum */}
            <FormSection title="Postpartum">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="breastfeeding_started" checked={form.breastfeeding_started}
                    onChange={e => set('breastfeeding_started', e.target.checked)}
                    className="h-4 w-4 rounded border-muted-foreground/30 accent-primary" />
                  <label htmlFor="breastfeeding_started" className="text-sm">Breastfeeding Started</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="skin_to_skin" checked={form.skin_to_skin}
                    onChange={e => set('skin_to_skin', e.target.checked)}
                    className="h-4 w-4 rounded border-muted-foreground/30 accent-primary" />
                  <label htmlFor="skin_to_skin" className="text-sm">Skin to Skin</label>
                </div>
              </div>
            </FormSection>

            {/* Doula Support */}
            <FormSection title="Doula Support">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Doula Arrived At</Label>
                  <Input type="datetime-local"
                    value={form.doula_arrived_at} onChange={e => set('doula_arrived_at', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Doula Left At</Label>
                  <Input type="datetime-local"
                    value={form.doula_left_at} onChange={e => set('doula_left_at', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Support Duration (minutes)</Label>
                  <Input type="number" placeholder="Auto-calculated if blank"
                    value={form.doula_support_minutes}
                    onChange={e => set('doula_support_minutes', e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to auto-calculate from timestamps
                  </p>
                </div>
              </div>
            </FormSection>

            {/* Notes */}
            <FormSection title="Notes">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Birth Notes</Label>
                  <Textarea rows={4} placeholder="Notes about the birth experience…"
                    value={form.birth_notes} onChange={e => set('birth_notes', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Outcome Notes</Label>
                  <Textarea rows={4} placeholder="Notes about outcomes…"
                    value={form.outcome_notes} onChange={e => set('outcome_notes', e.target.value)} />
                </div>
              </div>
            </FormSection>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Birth Details'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
