// src/features/appointments/api/appointment_types.api.ts
import { supabase } from '@/lib/supabaseClient';

export type AppointmentTypeSummary = {
  id:               number;
  name:             string;
  duration_minutes: number;
  mode:             string | null;
  description:      string | null;
  price_per_extra:  number | null;
};

export async function listAppointmentTypes(): Promise<AppointmentTypeSummary[]> {
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!;

  const { data, error } = await supabase
    .from('appointment_types')
    .select('id, name, duration_minutes, mode, description, price_per_extra')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createAppointmentType(
  input: Pick<AppointmentTypeSummary, 'name' | 'duration_minutes' | 'mode' | 'description'>
): Promise<AppointmentTypeSummary> {
  const orgId   = process.env.NEXT_PUBLIC_ORG_ID!;
  const doulaId = process.env.NEXT_PUBLIC_USER_ID!;

  const { data, error } = await supabase
    .from('appointment_types')
    .insert({
      name:             input.name,
      duration_minutes: input.duration_minutes ?? 60,
      mode:             input.mode || null,
      description:      input.description || null,
      org_id:           orgId,
      doula_id:         doulaId,
    })
    .select('id, name, duration_minutes, mode, description, price_per_extra')
    .single();

  if (error) throw error;
  return data!;
}

export async function updateAppointmentType(
  id: number,
  input: Partial<Pick<AppointmentTypeSummary, 'name' | 'duration_minutes' | 'mode' | 'description' | 'price_per_extra'>>
): Promise<AppointmentTypeSummary> {
  const { data, error } = await supabase
    .from('appointment_types')
    .update(input)
    .eq('id', id)
    .select('id, name, duration_minutes, mode, description, price_per_extra')
    .single();

  if (error) throw error;
  return data!;
}

export async function deleteAppointmentType(id: number): Promise<void> {
  const { error } = await supabase.from('appointment_types').delete().eq('id', id);
  if (error) throw error;
}