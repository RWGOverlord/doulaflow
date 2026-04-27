// src/app/clients/page.tsx
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ClientList } from '@/features/clients/components/ClientList';
import { useClientsListView } from '@/features/clients/hooks/useClientsListView';
import { Plus, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { CLIENT_STATUSES } from '@/features/clients/types';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'due_date' | 'name' | 'next_appointment';

type Filters = {
  statuses:       string[];   // empty = all
  hasNextAppt:    boolean | null; // null = all, true = has appt, false = no appt
};

const EMPTY_FILTERS: Filters = { statuses: [], hasNextAppt: null };

function filtersActive(f: Filters) {
  return f.statuses.length > 0 || f.hasNextAppt !== null;
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  filters,
  onChange,
  onClear,
  onClose,
}: {
  filters:  Filters;
  onChange: (f: Filters) => void;
  onClear:  () => void;
  onClose:  () => void;
}) {
  function toggleStatus(s: string) {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s)
      : [...filters.statuses, s];
    onChange({ ...filters, statuses: next });
  }

  return (
    <div className="absolute top-full right-0 z-20 mt-1 w-80 rounded-xl border bg-background shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <span className="text-sm font-medium">Filters</span>
        <div className="flex items-center gap-2">
          {filtersActive(filters) && (
            <button
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear all
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* Status filter */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            {CLIENT_STATUSES.map(s => {
              const active = filters.statuses.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Next appointment filter */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
            Next Appointment
          </p>
          <div className="flex gap-2">
            {[
              { label: 'Any',          value: null },
              { label: 'Has upcoming', value: true },
              { label: 'None booked',  value: false },
            ].map(opt => {
              const active = filters.hasNextAppt === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => onChange({ ...filters, hasNextAppt: opt.value })}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { data: clients = [], isLoading } = useClientsListView();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy,     setSortBy]     = useState<SortKey>('due_date');
  const [filters,    setFilters]    = useState<Filters>(EMPTY_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    }
    if (showFilter) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showFilter]);

  const filteredClients = useMemo(() => {
    let arr = clients.slice();

    // Search by name
    const q = searchTerm.trim().toLowerCase();
    if (q) arr = arr.filter(c => c.name.toLowerCase().includes(q));

    // Status filter
    if (filters.statuses.length > 0) {
      arr = arr.filter(c => filters.statuses.includes(c.status));
    }

    // Next appointment filter
    if (filters.hasNextAppt === true) {
      arr = arr.filter(c => !!c.next_appointment);
    } else if (filters.hasNextAppt === false) {
      arr = arr.filter(c => !c.next_appointment);
    }

    // Sort
    arr.sort((a, b) => {
      if (sortBy === 'due_date') {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      }
      if (sortBy === 'next_appointment') {
        const ad = a.next_appointment ? new Date(a.next_appointment).getTime() : Infinity;
        const bd = b.next_appointment ? new Date(b.next_appointment).getTime() : Infinity;
        return ad - bd;
      }
      return a.name.localeCompare(b.name);
    });

    return arr;
  }, [clients, searchTerm, sortBy, filters]);

  const activeCount  = clients.filter(c =>
    ['Active', 'On Call', 'In Labor'].includes(c.status)
  ).length;
  const activeFilters = filtersActive(filters);
  const resultCount   = filteredClients.length;
  const isFiltered    = activeFilters || searchTerm.trim() !== '';

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {isFiltered
                ? `${resultCount} of ${clients.length} shown · ${activeCount} active`
                : `${clients.length} total · ${activeCount} active`}
            </p>
          )}
        </div>
        <Link href="/clients/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Client
          </Button>
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-8 py-4 border-b bg-background">
        <Input
          placeholder="Search by name…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-md border bg-background px-3 py-2 text-sm text-foreground h-9"
        >
          <option value="due_date">Sort: Due Date</option>
          <option value="next_appointment">Sort: Next Appt</option>
          <option value="name">Sort: Name</option>
        </select>

        {/* Filter button + panel */}
        <div className="relative ml-auto" ref={filterRef}>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors h-9',
              activeFilters
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {activeFilters && (
              <span className="ml-0.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                {filters.statuses.length + (filters.hasNextAppt !== null ? 1 : 0)}
              </span>
            )}
            <ChevronDown className={clsx('h-3 w-3 transition-transform', showFilter && 'rotate-180')} />
          </button>

          {showFilter && (
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onClear={() => setFilters(EMPTY_FILTERS)}
              onClose={() => setShowFilter(false)}
            />
          )}
        </div>

        {/* Active filter chips */}
        {activeFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.statuses.map(s => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-muted border px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {s}
                <button
                  onClick={() => setFilters(f => ({ ...f, statuses: f.statuses.filter(x => x !== s) }))}
                  className="text-muted-foreground hover:text-foreground ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {filters.hasNextAppt !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted border px-2.5 py-0.5 text-xs font-medium text-foreground">
                {filters.hasNextAppt ? 'Has upcoming appt' : 'No appt booked'}
                <button
                  onClick={() => setFilters(f => ({ ...f, hasNextAppt: null }))}
                  className="text-muted-foreground hover:text-foreground ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            Loading clients…
          </div>
        ) : filteredClients.length === 0 && isFiltered ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">No clients match your filters</p>
            <button
              onClick={() => { setSearchTerm(''); setFilters(EMPTY_FILTERS); }}
              className="text-xs text-muted-foreground underline underline-offset-2 mt-2 hover:text-foreground"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ClientList clients={filteredClients as any} />
        )}
      </div>

    </div>
  );
}