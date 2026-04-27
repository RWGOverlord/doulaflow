// src/features/clients/components/ClientRow.tsx
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useUpdateClient } from '../hooks/useClient';
import { Client } from '../api/clients.api';

interface ClientRowProps {
  client: Client;
}

export function ClientRow({ client }: ClientRowProps) {
  const [status, setStatus] = useState(client.status || '');
  const updateClient = useUpdateClient();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const handleStatusChange = () => {
    updateClient.mutate(
      { id: client.id, updates: { status } },
      {
        onSuccess: () => setStatusDialogOpen(false),
      }
    );
  };

  return (
    <tr className="hover:bg-muted/50">
      <td className="px-4 py-2">{client.name}</td>
      <td className="px-4 py-2">{client.due_date || '-'}</td>
      <td className="px-4 py-2">
        {client.status ? (
          <Badge variant={client.status === 'Active' ? 'default' : 'secondary'}>
            {client.status}
          </Badge>
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Link href={`/clients/${client.id}/edit`}>
              <DropdownMenuItem>Edit</DropdownMenuItem>
            </Link>
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setStatusDialogOpen(true); }}>Set Status</DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Status for {client.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Onboarding">Onboarding</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Call">On Call</SelectItem>
                      <SelectItem value="In Labor">In Labor</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleStatusChange}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}