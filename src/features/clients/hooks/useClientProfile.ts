// src/features/clients/hooks/useClientProfile.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Client } from '../api/clients.api';

export type ClientProfile = Client & {
  package_tags: string[];
};

export function useClientProfile(id: string) {
  return useQuery<ClientProfile>({
    queryKey: ['client:profile', id],
    queryFn: async () => {
      // Single query: client + active package tags in one round trip
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_packages!left (
            is_active,
            packages (
              name,
              tags
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Client not found');

      // Find active package tags
      const activeCP = (data.client_packages ?? []).find((cp: any) => cp.is_active);
      const packageTags: string[] = activeCP?.packages?.tags ?? [];

      return {
        ...(data as unknown as Client),
        package_tags: packageTags,
      };
    },
    enabled: !!id,
  });
}
