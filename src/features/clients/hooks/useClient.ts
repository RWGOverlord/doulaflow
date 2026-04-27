// src/features/clients/hooks/useClient.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchClient, updateClient, Client } from '../api/clients.api';

export const useClient = (id: string) => {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id),
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Client> }) =>
      updateClient(id, updates),
    onSuccess: (data) => {
      // Invalidate all client-related queries
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients:listview'] });
      queryClient.invalidateQueries({ queryKey: ['client:profile', data.id] });
      queryClient.setQueryData(['client', data.id], data);
    },
  });
};