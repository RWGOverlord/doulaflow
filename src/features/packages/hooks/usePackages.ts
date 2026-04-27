// src/features/packages/hooks/usePackages.ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPackages, deletePackage } from '../api/packages.api';

export function usePackages() {
  return useQuery({ queryKey: ['packages'], queryFn: listPackages });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePackage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}
