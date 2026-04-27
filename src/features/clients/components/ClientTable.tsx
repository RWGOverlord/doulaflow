// src/features/clients/components/ClientTable.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClientRow } from './ClientRow';
import { Client } from '../api/clients.api';

interface ClientTableProps {
  clients: Client[];
}

export function ClientTable({ clients }: ClientTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead> {/* Changed from Next Appointment to match schema */}
          <TableHead className="w-[50px]"></TableHead> {/* Menu column */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <ClientRow key={client.id} client={client} />
        ))}
      </TableBody>
    </Table>
  );
}