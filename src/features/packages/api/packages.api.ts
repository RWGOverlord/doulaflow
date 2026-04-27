// src/features/packages/api/packages.api.ts
import { supabase } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PackageSummary = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  tags: string[];
  appointment_types: {
    appointment_type_id: number;
    quantity: number;
    name: string;
    duration_minutes: number;
    mode: string | null;
  }[];
};

export type PackageWithAppointmentTypes = PackageSummary & {
  appointment_types: {
    appointment_type_id: number;
    quantity: number;
    name: string;
    duration_minutes: number;
    mode: string | null;
  }[];
};

export type PackageInput = {
  name: string;
  description: string | null;
  price: number | null;
  tags: string[];
  appointmentTypes: { appointmentTypeId: string; quantity: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getIds(): Promise<{ orgId: string; doulaId: string }> {
  return {
    orgId:   process.env.NEXT_PUBLIC_ORG_ID!,
    doulaId: process.env.NEXT_PUBLIC_USER_ID!,
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listPackages(): Promise<PackageSummary[]> {
  const { doulaId } = await getIds();

  const { data, error } = await supabase
    .from('packages')
    .select(`
      id, name, description, price, tags,
      package_appointment_types (
        appointment_type_id,
        quantity,
        appointment_types ( id, name, duration_minutes, mode )
      )
    `)
    .eq('doula_id', doulaId)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id:          p.id,
    name:        p.name,
    description: p.description,
    price:       p.price,
    tags:        p.tags ?? [],
    appointment_types: (p.package_appointment_types ?? []).map((pat: any) => ({
      appointment_type_id: pat.appointment_type_id,
      quantity:            pat.quantity,
      name:                pat.appointment_types?.name ?? '',
      duration_minutes:    pat.appointment_types?.duration_minutes ?? 60,
      mode:                pat.appointment_types?.mode ?? null,
    })),
  }));
}

export async function getPackage(id: string): Promise<PackageSummary | null> {
  const { data, error } = await supabase
    .from('packages')
    .select('id, name, description, price, tags')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    id:          data.id,
    name:        data.name,
    description: data.description,
    price:       data.price,
    tags:        data.tags ?? [],
  };
}

export async function getPackageWithAppointmentTypes(
  id: string
): Promise<PackageWithAppointmentTypes | null> {
  const { data, error } = await supabase
    .from('packages')
    .select(`
      id, name, description, price, tags,
      package_appointment_types (
        appointment_type_id,
        quantity,
        appointment_types (
          id, name, duration_minutes, mode
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    id:          data.id,
    name:        data.name,
    description: data.description,
    price:       data.price,
    tags:        (data as any).tags ?? [],
    appointment_types: ((data as any).package_appointment_types ?? []).map((pat: any) => ({
      appointment_type_id: pat.appointment_type_id,
      quantity:            pat.quantity,
      name:                pat.appointment_types?.name ?? '',
      duration_minutes:    pat.appointment_types?.duration_minutes ?? 60,
      mode:                pat.appointment_types?.mode ?? null,
    })),
  };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createPackage(input: PackageInput): Promise<string> {
  const { orgId, doulaId } = await getIds();

  // Filter out incomplete appointment type entries
  const validTypes = (input.appointmentTypes ?? []).filter(
    (t) => t.appointmentTypeId && t.appointmentTypeId !== ''
  );

  const { data, error } = await supabase.rpc('create_package_with_types', {
    p_org_id:      orgId,
    p_doula_id:    doulaId,
    p_name:        input.name,
    p_description: input.description ?? null,
    p_price:       input.price ?? null,
    p_tags:        input.tags ?? [],
    p_types:       validTypes.length > 0
      ? validTypes.map((t) => ({
          appointmentTypeId: t.appointmentTypeId,
          quantity:          t.quantity,
        }))
      : null,
  });

  if (error) throw error;
  return data as string; // returns new package uuid
}

export async function updatePackage(
  id: string,
  input: PackageInput
): Promise<void> {
  const validTypes = (input.appointmentTypes ?? []).filter(
    (t) => t.appointmentTypeId && t.appointmentTypeId !== ''
  );

  const { error } = await supabase.rpc('update_package_with_types', {
    p_package_id:  id,
    p_name:        input.name,
    p_description: input.description ?? null,
    p_price:       input.price ?? null,
    p_tags:        input.tags ?? [],
    p_types:       validTypes.length > 0
      ? validTypes.map((t) => ({
          appointmentTypeId: t.appointmentTypeId,
          quantity:          t.quantity,
        }))
      : null,
  });

  if (error) throw error;
}

export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase.from('packages').delete().eq('id', id);
  if (error) throw error;
}