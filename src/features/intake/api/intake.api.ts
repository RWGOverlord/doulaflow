import { supabase } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IntakeFormData = {
  // ── Section 1: Contact Information ─────────────────────────────────────────
  name: string;
  address: string;
  email: string;
  phone: string;
  partner_name: string;
  partner_email: string;
  partner_phone: string;
  preferred_contact: string;
  emergency_contact: string;

  // ── Section 2: Care Team ────────────────────────────────────────────────────
  provider_name: string;
  birth_location: string;
  provider_chosen_specifically: string;
  comfortable_with_provider: string;

  // ── Section 3: Pregnancy Details ───────────────────────────────────────────
  due_date: string;
  expecting_multiples: string;
  baby_gender: string;
  baby_name: string;
  pregnancy_experience: string;       // "How has pregnancy been" → also saved to notes
  current_health_conditions: string;
  pregnancy_number: string;
  previous_births: string;
  birth_experiences: string;
  previous_labor_length: string;
  past_pregnancy_health_conditions: string;

  // ── Section 4: Medical History (PDF only) ──────────────────────────────────
  medical_history: string;

  // ── Section 5: Birth Preferences (PDF only) ────────────────────────────────
  birth_preparation: string;
  birth_vision: string;
  has_birth_plan: string;
  shared_preferences_with_provider: string;
  provider_knows_doula: string;
  early_labor_contact_timing: string;
  post_dates_protocols: string;
  partner_role_at_birth: string;
  additional_birth_attendees: string;
  people_not_at_birth: string;

  // ── Section 6: Support & Concerns (PDF only) ───────────────────────────────
  fears_or_concerns: string;
  religious_cultural_beliefs: string;
  comforting_in_pain: string;
  how_doula_helps_most: string;

  // ── Section 7: Postpartum (PDF only) ───────────────────────────────────────
  nursing_experience: string;
  feeding_concerns: string;
  postpartum_support: string;

  // ── Section 8: Additional Notes ────────────────────────────────────────────
  additional_questions: string;       // "Any questions or anything else" → also saved to notes
};

export type ClientIntakeForm = {
  id?: string;
  org_id: string;
  client_id: string;
  intake_token_id?: string | null;
  submitted_at?: string | null;
  // Contact (managed on client record, not shown in display)
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  partner_name?: string | null;
  partner_email?: string | null;
  partner_phone?: string | null;
  // Displayed fields
  preferred_contact_method?: string | null;
  emergency_contact?: string | null;
  provider_name?: string | null;
  birth_location?: string | null;
  chose_provider_specifically?: string | null;
  comfortable_with_provider?: string | null;
  due_date?: string | null;
  expecting_multiples?: number | null;
  baby_gender?: string | null;
  baby_name?: string | null;
  pregnancy_experience?: string | null;
  current_health_conditions?: string | null;
  pregnancy_number?: string | null;
  previous_births?: string | null;
  birth_experiences?: string | null;
  previous_labor_length?: string | null;
  past_pregnancy_conditions?: string | null;
  medical_history?: string | null;
  birth_preparation?: string | null;
  birth_vision?: string | null;
  has_birth_plan?: string | null;
  shared_preferences_with_provider?: string | null;
  provider_knows_doula?: string | null;
  early_labor_contact?: string | null;
  post_dates_protocols?: string | null;
  partner_role?: string | null;
  additional_birth_attendees?: string | null;
  unwanted_attendees?: string | null;
  fears_concerns?: string | null;
  religious_cultural_beliefs?: string | null;
  comforting_in_pain?: string | null;
  doula_support_vision?: string | null;
  nursing_experience?: string | null;
  feeding_concerns?: string | null;
  postpartum_support?: string | null;
  additional_questions?: string | null;
};

export type IntakeTokenRow = {
  id: string;
  client_id: string;
  token: string;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
  client_name: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Naively extracts the city from a freeform address string.
// Handles "Street, City, State ZIP" → "City"
// Falls back to the full address if it cannot be parsed.
function parseCity(address: string): string {
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : address.trim();
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function generateIntakeToken(clientId: string): Promise<string> {
  // Return an existing active token if one already exists
  const { data: existing } = await supabase
    .from('intake_tokens')
    .select('token')
    .eq('client_id', clientId)
    .is('completed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) return existing.token as string;

  const { data, error } = await supabase
    .from('intake_tokens')
    .insert({ client_id: clientId })
    .select('token')
    .single();

  if (error) throw error;
  return data!.token as string;
}

export async function getIntakeToken(token: string): Promise<IntakeTokenRow | null> {
  const { data, error } = await supabase
    .from('intake_tokens')
    .select(`
      id,
      client_id,
      token,
      expires_at,
      completed_at,
      created_at,
      clients ( name )
    `)
    .eq('token', token)
    .single();

  if (error || !data) return null;

  const row = data as any;

  // Reject if expired or already submitted
  if (new Date(row.expires_at) < new Date()) return null;
  if (row.completed_at !== null) return null;

  return {
    id:           row.id,
    client_id:    row.client_id,
    token:        row.token,
    expires_at:   row.expires_at,
    completed_at: row.completed_at,
    created_at:   row.created_at,
    client_name:  row.clients?.name ?? '',
  };
}

export async function getClientIntakeForm(clientId: string): Promise<ClientIntakeForm | null> {
  const { data, error } = await supabase
    .from('client_intake_forms')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return data as ClientIntakeForm | null;
}

export async function upsertClientIntakeForm(
  clientId: string,
  orgId: string,
  data: Partial<ClientIntakeForm>,
): Promise<ClientIntakeForm> {
  const { data: result, error } = await supabase
    .from('client_intake_forms')
    .upsert({ ...data, client_id: clientId, org_id: orgId }, { onConflict: 'client_id' })
    .select('*')
    .single();
  if (error) throw error;
  return result as ClientIntakeForm;
}

export async function submitIntakeForm(
  token: string,
  data: IntakeFormData,
): Promise<{ client_id: string }> {
  // Resolve the token row first (validates it's still live)
  const tokenRow = await getIntakeToken(token);
  if (!tokenRow) throw new Error('Intake link is invalid, expired, or already used.');

  const noteParts: string[] = [];
  if (data.pregnancy_experience.trim()) {
    noteParts.push(`Pregnancy experience:\n${data.pregnancy_experience.trim()}`);
  }
  if (data.additional_questions.trim()) {
    noteParts.push(`Additional questions:\n${data.additional_questions.trim()}`);
  }
  const combinedNotes = noteParts.join('\n\n') || null;

  // Update the client record with structured fields
  const { error: clientError } = await supabase
    .from('clients')
    .update({
      name:          data.name,
      phone:         data.phone || null,
      invited_email: data.email || null,
      address_city:  data.address ? parseCity(data.address) : null,
      partner_name:  data.partner_name || null,
      due_date:      data.due_date || null,
      notes:         combinedNotes,
    })
    .eq('id', tokenRow.client_id);

  if (clientError) throw clientError;

  // Mark the token as completed
  const { error: tokenError } = await supabase
    .from('intake_tokens')
    .update({ completed_at: new Date().toISOString() })
    .eq('token', token);

  if (tokenError) throw tokenError;

  return { client_id: tokenRow.client_id };
}
