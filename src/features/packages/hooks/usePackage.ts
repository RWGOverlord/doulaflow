// src/features/packages/hooks/usePackage.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { getPackage } from '../api/packages.api';

export function usePackage(id: string) {
  return useQuery({ queryKey: ['packages', id], queryFn: () => getPackage(id), enabled: !!id });
}
