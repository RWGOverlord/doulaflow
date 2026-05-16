// src/features/clients/api/birthDetails.api.ts
import { supabase } from '@/lib/supabaseClient';

export type BirthDetails = {
  id: string;
  org_id: string;
  client_id: string;
  doula_id: string;
  baby_gender: 'male' | 'female' | 'unknown' | 'surprise' | 'multiple' | null;
  baby_count: number;
  is_twins: boolean;
  birth_date: string | null;
  birth_time: string | null;
  labor_started_at: string | null;
  birth_occurred_at: string | null;
  labor_length_minutes: number | null;
  birth_location_type: 'home' | 'birth_center' | 'hospital' | 'other' | null;
  birth_location_name: string | null;
  birth_city: string | null;
  delivery_type: 'vaginal' | 'cesarean' | 'vbac' | 'assisted' | 'unknown' | null;
  induction_used: boolean | null;
  epidural_used: boolean | null;
  transfer_occurred: boolean;
  transfer_from: string | null;
  transfer_to: string | null;
  gestational_weeks: number | null;
  gestational_days: number | null;
  baby_weight_oz: number | null;
  baby_length_in: number | null;
  breastfeeding_started: boolean | null;
  skin_to_skin: boolean | null;
  doula_arrived_at: string | null;
  doula_left_at: string | null;
  doula_support_minutes: number | null;
  birth_notes: string | null;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function getBirthDetails(clientId: string): Promise<BirthDetails | null> {
  const { data, error } = await supabase
    .from('client_birth_details')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertBirthDetails(
  clientId: string,
  orgId: string,
  doulaId: string,
  data: Partial<BirthDetails>
): Promise<BirthDetails> {
  const { data: result, error } = await supabase
    .from('client_birth_details')
    .upsert(
      { ...data, client_id: clientId, org_id: orgId, doula_id: doulaId },
      { onConflict: 'client_id' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return result!;
}

export async function deleteBirthDetails(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('client_birth_details')
    .delete()
    .eq('client_id', clientId);
  if (error) throw error;
}
