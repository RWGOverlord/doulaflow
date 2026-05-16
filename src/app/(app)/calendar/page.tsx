// src/app/calendar/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// ─── Localizer ────────────────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

// ─── Types ────────────────────────────────────────────────────────────────────

type CalEvent = {
  id:      string;
  title:   string;
  start:   Date;
  end:     Date;
  allDay?: boolean;
  resource: {
    kind:       'appointment' | 'due_date';
    clientId:   string;
    clientName: string;
    status:     string;
    mode:       string | null;
    location:   string | null;
    typeName:   string;
    isAdhoc:    boolean;
  };
};

type ViewType = 'month' | 'week' | 'day' | 'agenda';

// ─── Colors ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  scheduled: { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
  completed: { bg: '#f3f4f6', border: '#9ca3af', text: '#4b5563' },
  cancelled: { bg: '#fef2f2', border: '#f87171', text: '#991b1b' },
  no_show:   { bg: '#fffbeb', border: '#fbbf24', text: '#92400e' },
};
const DEFAULT_COLOR  = { bg: '#ecfdf5', border: '#10b981', text: '#065f46' };
const DUE_DATE_COLOR = { bg: '#fff1f2', border: '#f43f5e', text: '#9f1239' };
const ADHOC_COLOR    = { bg: '#eff6ff', border: '#60a5fa', text: '#1d4ed8' };

// ─── Event style ─────────────────────────────────────────────────────────────

function eventStyleGetter(event: CalEvent) {
  const color = event.resource.kind === 'due_date'
    ? DUE_DATE_COLOR
    : event.resource.isAdhoc && event.resource.status === 'scheduled'
      ? ADHOC_COLOR
      : (STATUS_COLORS[event.resource.status] ?? DEFAULT_COLOR);

  return {
    style: {
      backgroundColor: color.bg,
      borderLeft:      `3px solid ${color.border}`,
      color:           color.text,
      borderRadius:    '6px',
      fontSize:        '12px',
      fontWeight:      '500',
      padding:         '2px 6px',
      border:          'none',
      boxShadow:       '0 1px 2px rgba(0,0,0,0.06)',
    },
  };
}

// ─── Event detail popup ───────────────────────────────────────────────────────

function EventPopup({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const isDueDate = event.resource.kind === 'due_date';
  const color = isDueDate
    ? DUE_DATE_COLOR
    : event.resource.isAdhoc && event.resource.status === 'scheduled'
      ? ADHOC_COLOR
      : (STATUS_COLORS[event.resource.status] ?? DEFAULT_COLOR);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl border shadow-xl w-80 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Color bar */}
        <div className="h-1" style={{ backgroundColor: color.border }} />

        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-semibold text-sm">
                  {isDueDate ? 'Due Date' : event.resource.typeName}
                </div>
                {!isDueDate && event.resource.isAdhoc && (
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                    External
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{event.resource.clientName}</div>
            </div>
            {!isDueDate && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize shrink-0"
                style={{ backgroundColor: color.bg, color: color.text }}
              >
                {event.resource.status.replace('_', ' ')}
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="12" height="11" rx="2"/><path d="M5 2v2M11 2v2M2 7h12"/>
              </svg>
              {format(event.start, 'EEEE, MMMM d, yyyy')}
            </div>
            {!isDueDate && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/>
                </svg>
                {format(event.start, 'h:mm a')} – {format(event.end, 'h:mm a')}
              </div>
            )}
            {!isDueDate && event.resource.mode && (
              <div className="flex items-center gap-2 text-muted-foreground capitalize">
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3z"/>
                </svg>
                {event.resource.mode.replace('_', '-')}
              </div>
            )}
            {!isDueDate && event.resource.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2a4 4 0 00-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 00-4-4z"/><circle cx="8" cy="6" r="1.5"/>
                </svg>
                {event.resource.location}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Link
              href={`/clients/${event.resource.clientId}`}
              onClick={onClose}
              className="text-xs font-medium text-primary hover:underline"
            >
              View client →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function CalendarToolbar({
  date,
  view,
  onNavigate,
  onViewChange,
}: {
  date:          Date;
  view:          ViewType;
  onNavigate:    (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  onViewChange:  (v: ViewType) => void;
}) {
  const label = useMemo(() => {
    if (view === 'month')  return format(date, 'MMMM yyyy');
    if (view === 'week')   return `Week of ${format(startOfWeek(date, { weekStartsOn: 0 }), 'MMM d, yyyy')}`;
    if (view === 'day')    return format(date, 'EEEE, MMMM d yyyy');
    return format(date, 'MMMM yyyy');
  }, [date, view]);

  const views: { key: ViewType; label: string }[] = [
    { key: 'month',  label: 'Month' },
    { key: 'week',   label: 'Week' },
    { key: 'day',    label: 'Day' },
    { key: 'agenda', label: 'Agenda' },
  ];

  return (
    <div className="flex items-center justify-between px-1 pb-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onNavigate('TODAY')}>
          Today
        </Button>
        <button
          onClick={() => onNavigate('PREV')}
          className="flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onNavigate('NEXT')}
          className="flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold ml-1">{label}</h2>
      </div>

      <div className="flex rounded-lg border overflow-hidden">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => onViewChange(v.key)}
            className={clsx(
              'px-3 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0',
              view === v.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user } = useAuth();
  const [events,   setEvents]   = useState<CalEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [date,     setDate]     = useState(new Date());
  const [view,     setView]     = useState<ViewType>('month');
  const [selected, setSelected] = useState<CalEvent | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [{ data: apptData, error: apptErr }, { data: clientData, error: clientErr }] =
          await Promise.all([
            supabase
              .from('appointments')
              .select(`
                id, title, appointment_type_id, starts_at, ends_at, status, location,
                appointment_types ( name, mode ),
                clients ( id, name )
              `)
              .eq('doula_id', user.id)
              .order('starts_at', { ascending: true }),
            supabase
              .from('clients')
              .select('id, name, due_date')
              .eq('doula_id', user.id)
              .not('due_date', 'is', null),
          ]);

        if (!mounted) return;
        if (apptErr) console.error(apptErr);
        if (clientErr) console.error(clientErr);

        const apptEvents: CalEvent[] = (apptData ?? []).map((a: any) => ({
          id:    a.id,
          title: a.appointment_types?.name ?? a.title ?? 'Appointment',
          start: new Date(a.starts_at),
          end:   new Date(a.ends_at),
          resource: {
            kind:       'appointment' as const,
            clientId:   a.clients?.id   ?? '',
            clientName: a.clients?.name ?? '—',
            status:     a.status,
            mode:       a.appointment_types?.mode ?? null,
            location:   a.location,
            typeName:   a.appointment_types?.name ?? a.title ?? 'Appointment',
            isAdhoc:    !a.appointment_type_id,
          },
        }));

        const dueDateEvents: CalEvent[] = (clientData ?? []).map((c: any) => {
          const d = new Date(`${c.due_date}T12:00:00`);
          return {
            id:    `due-${c.id}`,
            title: `${c.name} — Due Date`,
            start: d,
            end:   d,
            allDay: true,
            resource: {
              kind:       'due_date' as const,
              clientId:   c.id,
              clientName: c.name,
              status:     '',
              mode:       null,
              location:   null,
              typeName:   'Due Date',
              isAdhoc:    false,
            },
          };
        });

        setEvents([...apptEvents, ...dueDateEvents]);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [user]);

  const apptCount    = events.filter(e => e.resource.kind === 'appointment').length;
  const dueDateCount = events.filter(e => e.resource.kind === 'due_date').length;

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {apptCount} appointment{apptCount !== 1 ? 's' : ''}
              {dueDateCount > 0 && ` · ${dueDateCount} due date${dueDateCount !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Loading appointments…
          </div>
        ) : (
          <>
            <CalendarToolbar
              date={date}
              view={view}
              onNavigate={(action) => {
                const d = new Date(date);
                if (action === 'TODAY') { setDate(new Date()); return; }
                if (view === 'month') {
                  d.setMonth(d.getMonth() + (action === 'NEXT' ? 1 : -1));
                } else if (view === 'week') {
                  d.setDate(d.getDate() + (action === 'NEXT' ? 7 : -7));
                } else if (view === 'day') {
                  d.setDate(d.getDate() + (action === 'NEXT' ? 1 : -1));
                } else {
                  d.setMonth(d.getMonth() + (action === 'NEXT' ? 1 : -1));
                }
                setDate(new Date(d));
              }}
              onViewChange={setView}
            />

            <style>{`
              /* react-big-calendar theme overrides — using direct colors to avoid OKLCH var issues */
              .rbc-calendar { font-family: inherit; background: #ffffff; color: #1a1a1a; }
              .rbc-header { padding: 8px 4px; font-size: 11px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; background: #ffffff; }
              .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #ffffff; }
              .rbc-day-bg { background: #ffffff; }
              .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #e5e7eb; }
              .rbc-month-row + .rbc-month-row { border-top: 1px solid #e5e7eb; }
              .rbc-off-range-bg { background: #f9fafb; }
              .rbc-off-range .rbc-button-link { color: #d1d5db; }
              .rbc-today { background: #f0fdf4; }
              .rbc-date-cell { padding: 4px 8px; font-size: 12px; color: #6b7280; background: transparent; }
              .rbc-date-cell .rbc-button-link { color: #6b7280; }
              .rbc-date-cell.rbc-now .rbc-button-link { font-weight: 600; color: #7c3aed; }
              .rbc-event { border-radius: 5px !important; padding: 1px 5px !important; font-size: 12px !important; }
              .rbc-event:focus, .rbc-event.rbc-selected { outline: none; opacity: 0.9; }
              .rbc-show-more { font-size: 11px; color: #7c3aed; font-weight: 500; padding: 0 4px; background: transparent; }
              .rbc-time-header { background: #ffffff; }
              .rbc-time-header-content { border-left: 1px solid #e5e7eb; background: #ffffff; }
              .rbc-time-content { border-top: 1px solid #e5e7eb; background: #ffffff; }
              .rbc-timeslot-group { border-bottom: 1px solid #f3f4f6; background: #ffffff; }
              .rbc-time-slot { font-size: 11px; color: #9ca3af; background: #ffffff; }
              .rbc-time-gutter .rbc-timeslot-group { border-bottom: 1px solid #f3f4f6; }
              .rbc-current-time-indicator { background-color: #7c3aed; height: 2px; }
              .rbc-agenda-view { background: #ffffff; }
              .rbc-agenda-table { font-size: 13px; color: #1a1a1a; background: #ffffff; }
              .rbc-agenda-table thead tr { background: #f9fafb; }
              .rbc-agenda-table thead th { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
              .rbc-agenda-table tbody td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; background: #ffffff; color: #1a1a1a; }
              .rbc-agenda-empty { padding: 24px; text-align: center; color: #6b7280; font-size: 13px; background: #ffffff; }
              .rbc-row-content { background: transparent; }
              .rbc-row-bg { background: transparent; }
              .rbc-toolbar { display: none; }
            `}</style>

            <div style={{ height: 'calc(100vh - 260px)' }}>
              <Calendar
                localizer={localizer}
                events={events}
                date={date}
                view={view}
                onNavigate={setDate}
                onView={(v) => setView(v as ViewType)}
                eventPropGetter={eventStyleGetter}
                onSelectEvent={(event) => setSelected(event as CalEvent)}
                tooltipAccessor={null}
                popup
                style={{ height: '100%' }}
                formats={{
                  timeGutterFormat: (d) => format(d, 'h a'),
                  eventTimeRangeFormat: ({ start, end }) =>
                    `${format(start, 'h:mm')}–${format(end, 'h:mm a')}`,
                  agendaDateFormat: (d) => format(d, 'EEE MMM d'),
                  agendaTimeFormat: (d) => format(d, 'h:mm a'),
                  agendaTimeRangeFormat: ({ start, end }) =>
                    `${format(start, 'h:mm')}–${format(end, 'h:mm a')}`,
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Event detail popup */}
      {selected && (
        <EventPopup event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
