// src/features/clients/api/clients.api.ts
import { supabase } from '@/lib/supabaseClient';

// ─── Core Client type (matches public.clients table) ─────────────────────────

export type Client = {
  id: string;
  org_id: string;
  doula_id: string | null;
  invited_email: string | null;
  name: string;
  partner_name: string | null;
  phone: string | null;
  address_city: string | null;
  status: string;
  service_types: string[];       // e.g. ['birth','postpartum']
  due_date: string | null;
  lmp: string | null;
  pregnancy_stage: string | null;
  risk_notes: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

// ─── List view row (clients + active package tags) ────────────────────────────

export type ClientListRow = {
  id: string;
  name: string;
  due_date: string | null;
  status: string;
  service_types: string[];
  next_appointment: string | null;  // starts_at of next scheduled appointment
  // From active client_package → package
  client_package_id: number | null;
  package_id: string | null;
  package_name: string | null;
  package_tags: string[];
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export async function listClientsForListView(): Promise<ClientListRow[]> {
  const now = new Date().toISOString();

  // Fetch clients with active package + next upcoming appointment
  const { data, error } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      due_date,
      status,
      service_types,
      client_packages!left (
        id,
        package_id,
        is_active,
        packages (
          id,
          name,
          tags
        )
      ),
      appointments!left (
        id,
        starts_at,
        status
      )
    `)
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((c: any) => {
    // Find the active package if any
    const activeCP = (c.client_packages ?? []).find((cp: any) => cp.is_active);
    const pkg = activeCP?.packages ?? null;

    // Find next upcoming scheduled appointment
    const upcomingAppts = (c.appointments ?? [])
      .filter((a: any) => a.status === 'scheduled' && a.starts_at >= now)
      .sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at));
    const nextAppt = upcomingAppts[0]?.starts_at ?? null;

    return {
      id: c.id,
      name: c.name,
      due_date: c.due_date,
      status: c.status,
      service_types: c.service_types ?? [],
      next_appointment: nextAppt,
      client_package_id: activeCP?.id ?? null,
      package_id: pkg?.id ?? null,
      package_name: pkg?.name ?? null,
      package_tags: pkg?.tags ?? [],
    } satisfies ClientListRow;
  });
}

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createClient(
  input: Omit<Client, 'id' | 'created_at'>
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data!;
}

export async function updateClient(
  id: string,
  updates: Partial<Omit<Client, 'id' | 'created_at'>>
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data!;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

export async function setClientStatus(
  id: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}