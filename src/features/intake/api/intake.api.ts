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
