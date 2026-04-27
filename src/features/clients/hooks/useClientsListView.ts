// src/features/clients/hooks/useClientsListView.ts
import { useQuery } from '@tanstack/react-query';
import { listClientsForListView, type ClientListRow } from '../api/clients.api';

export function useClientsListView() {
  return useQuery<ClientListRow[]>({
    queryKey: ['clients:listview'],
    queryFn: listClientsForListView,
  });
}
