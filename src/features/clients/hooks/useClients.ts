// src/features/clients/hooks/useClients.ts
import { useQuery } from '@tanstack/react-query';
import { fetchClients } from '../api/clients.api';

export const useClients = () =>
  useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });
