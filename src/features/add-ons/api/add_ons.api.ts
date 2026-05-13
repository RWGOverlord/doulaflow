// src/features/add-ons/api/add_ons.api.ts
import { supabase } from '@/lib/supabaseClient';

export type AddOn = {
  id:          number;
  name:        string;
  description: string | null;
  price:       number | null;
};

export async function listAddOns(): Promise<AddOn[]> {
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!;
  const { data, error } = await supabase
    .from('add_ons')
    .select('id, name, description, price')
    .eq('org_id', orgId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createAddOn(
  input: Pick<AddOn, 'name' | 'description' | 'price'>
): Promise<AddOn> {
  const orgId   = process.env.NEXT_PUBLIC_ORG_ID!;
  const doulaId = process.env.NEXT_PUBLIC_USER_ID!;
  const { data, error } = await supabase
    .from('add_ons')
    .insert({
      name:        input.name,
      description: input.description || null,
      price:       input.price ?? null,
      org_id:      orgId,
      doula_id:    doulaId,
    })
    .select('id, name, description, price')
    .single();
  if (error) throw error;
  return data!;
}

export async function updateAddOn(
  id: number,
  input: Partial<Pick<AddOn, 'name' | 'description' | 'price'>>
): Promise<AddOn> {
  const { data, error } = await supabase
    .from('add_ons')
    .update(input)
    .eq('id', id)
    .select('id, name, description, price')
    .single();
  if (error) throw error;
  return data!;
}

export async function deleteAddOn(id: number): Promise<void> {
  const { error } = await supabase.from('add_ons').delete().eq('id', id);
  if (error) throw error;
}
