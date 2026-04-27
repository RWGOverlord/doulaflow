// src/features/clients/hooks/useClient.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'; // eslint-disable-line
import { fetchClient, updateClient, Client } from '../api/clients.api'; // Added Client import

export const useClient = (id: string) => {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id),
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Client> }) => updateClient(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.setQueryData(['client', data.id], data);
    },
  });
};