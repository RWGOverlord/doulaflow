// src/features/clients/components/ClientList.tsx
import { ClientListItem } from './ClientListItem';
import type { ClientListRow } from '../api/clients.api';

export function ClientList({ clients }: { clients: (ClientListRow & any)[] }) {
  if (!clients?.length) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">No clients yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Click "New Client" to add your first client
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_auto] gap-4 px-4 py-2.5 border-b bg-muted/40">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Appt</span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services</span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
        <span className="w-8" />
      </div>

      {/* Rows */}
      <div className="divide-y">
        {clients.map((c) => (
          <ClientListItem key={c.id} client={c as any} />
        ))}
      </div>
    </div>
  );
}
