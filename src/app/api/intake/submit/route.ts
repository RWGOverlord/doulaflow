import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { IntakeFormData } from '@/features/intake/api/intake.api';

// ─── Admin client (service role — never exposed to the browser) ───────────────

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCity(address: string): string {
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : address.trim();
}

// ─── POST /api/intake/submit ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: { token: string; formData: IntakeFormData; pdfBase64: string } =
      await req.json();

    const { token, formData, pdfBase64 } = body;

    if (!token || !formData) {
      return NextResponse.json({ error: 'Missing token or form data' }, { status: 400 });
    }

    const supabase = adminClient();

    // ── 1. Validate token server-side (simple lookup, no join) ───────────────
console.log(token);
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('intake_tokens')
      .select('id, client_id, expires_at, completed_at')
      .eq('token', token)
      .single();

    if (tokenErr || !tokenRow) {
      console.error('[intake/submit] token lookup failed', {
        code:    tokenErr?.code,
        message: tokenErr?.message,
        hint:    tokenErr?.hint,
        token:   token?.slice(0, 8) + '…',
      });
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    if (tokenRow.completed_at) {
      return NextResponse.json({ error: 'This form has already been submitted' }, { status: 409 });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }

    const clientId = tokenRow.client_id as string;

    // ── 2. Fetch client name + org_id separately ──────────────────────────────

    const { data: clientRow, error: clientFetchErr } = await supabase
      .from('clients')
      .select('name, org_id')
      .eq('id', clientId)
      .single();

    if (clientFetchErr || !clientRow) {
      console.error('[intake/submit] client fetch failed', clientFetchErr);
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientName = (clientRow.name as string) ?? '';
    const orgId      = (clientRow.org_id as string) ?? '';

    // ── 2. Update client record with structured fields ────────────────────────

    const noteParts: string[] = [];
    if (formData.pregnancy_experience?.trim()) {
      noteParts.push(`Pregnancy experience:\n${formData.pregnancy_experience.trim()}`);
    }
    if (formData.additional_questions?.trim()) {
      noteParts.push(`Additional questions:\n${formData.additional_questions.trim()}`);
    }
    const combinedNotes = noteParts.join('\n\n') || null;

    const { error: clientErr } = await supabase
      .from('clients')
      .update({
        name:          formData.name,
        phone:         formData.phone         || null,
        invited_email: formData.email         || null,
        address_city:  formData.address ? parseCity(formData.address) : null,
        partner_name:  formData.partner_name  || null,
        due_date:      formData.due_date       || null,
        notes:         combinedNotes,
      })
      .eq('id', clientId);

    if (clientErr) {
      console.error('[intake/submit] client update failed', clientErr);
      return NextResponse.json({ error: clientErr.message }, { status: 500 });
    }

    // ── 3. Upsert all form data into client_intake_forms ─────────────────────

    const { error: intakeFormErr } = await supabase
      .from('client_intake_forms')
      .upsert({
        org_id:           orgId,
        client_id:        clientId,
        intake_token_id:  tokenRow.id,

        // Contact
        name:                     formData.name,
        address:                  formData.address,
        email:                    formData.email,
        phone:                    formData.phone,
        partner_name:             formData.partner_name,
        partner_email:            formData.partner_email,
        partner_phone:            formData.partner_phone,
        preferred_contact_method: formData.preferred_contact,
        emergency_contact:        formData.emergency_contact,

        // Care team
        provider_name:               formData.provider_name,
        birth_location:              formData.birth_location,
        chose_provider_specifically: formData.provider_chosen_specifically,
        comfortable_with_provider:   formData.comfortable_with_provider,

        // Pregnancy
        due_date:                  formData.due_date || null,
        expecting_multiples:       formData.expecting_multiples
                                     ? parseInt(formData.expecting_multiples)
                                     : null,
        baby_gender:               formData.baby_gender,
        baby_name:                 formData.baby_name,
        pregnancy_experience:      formData.pregnancy_experience,
        current_health_conditions: formData.current_health_conditions,
        pregnancy_number:          formData.pregnancy_number,
        previous_births:           formData.previous_births,
        birth_experiences:         formData.birth_experiences,
        previous_labor_length:     formData.previous_labor_length,
        past_pregnancy_conditions: formData.past_pregnancy_health_conditions,

        // Medical
        medical_history: formData.medical_history,

        // Birth preferences
        birth_preparation:                formData.birth_preparation,
        birth_vision:                     formData.birth_vision,
        has_birth_plan:                   formData.has_birth_plan,
        shared_preferences_with_provider: formData.shared_preferences_with_provider,
        provider_knows_doula:             formData.provider_knows_doula,
        early_labor_contact:              formData.early_labor_contact_timing,
        post_dates_protocols:             formData.post_dates_protocols,
        partner_role:                     formData.partner_role_at_birth,
        additional_birth_attendees:       formData.additional_birth_attendees,
        unwanted_attendees:               formData.people_not_at_birth,

        // Support
        fears_concerns:             formData.fears_or_concerns,
        religious_cultural_beliefs: formData.religious_cultural_beliefs,
        comforting_in_pain:         formData.comforting_in_pain,
        doula_support_vision:       formData.how_doula_helps_most,

        // Postpartum
        nursing_experience: formData.nursing_experience,
        feeding_concerns:   formData.feeding_concerns,
        postpartum_support: formData.postpartum_support,

        // Additional
        additional_questions: formData.additional_questions,

        submitted_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });

    if (intakeFormErr) {
      console.error('[intake/submit] intake form upsert failed', intakeFormErr);
      // Non-fatal: client record and PDF still succeed
    }

    // ── 4 & 5. Upload PDF and insert document row ─────────────────────────────

    let pdfUploaded = false;

    if (pdfBase64 && orgId) {
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const timestamp = Date.now();
      const path      = `${orgId}/${clientId}/intake_${timestamp}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, pdfBuffer, {
          contentType: 'application/pdf',
          upsert:      false,
        });

      if (uploadErr) {
        console.error('[intake/submit] storage upload failed', uploadErr);
        // Non-fatal: client record is already updated; log and continue
      } else {
        const date  = new Date().toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        });

        const { error: docErr } = await supabase
          .from('documents')
          .insert({
            org_id:       orgId,
            client_id:    clientId,
            uploaded_by:  null,
            title:        `Intake Form — ${clientName} — ${date}`,
            storage_path: path,
            visibility:   'doula',
            category:     'Intake Forms',
            file_size:    pdfBuffer.length,
            file_type:    'application/pdf',
          });

        if (docErr) {
          console.error('[intake/submit] document insert failed', docErr);
          await supabase.storage.from('documents').remove([path]);
        } else {
          pdfUploaded = true;
        }
      }
    }

    // ── 6. Mark token as completed ────────────────────────────────────────────

    const { error: tokenUpdateErr } = await supabase
      .from('intake_tokens')
      .update({ completed_at: new Date().toISOString() })
      .eq('token', token);

    if (tokenUpdateErr) {
      console.error('[intake/submit] token mark-complete failed', tokenUpdateErr);
      // Non-fatal: client data is saved; worst case the form could be re-submitted
    }

    return NextResponse.json({ success: true, pdfUploaded });

  } catch (err: unknown) {
    console.error('[intake/submit] unexpected error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
