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

    // ── 1. Validate token server-side ─────────────────────────────────────────

    const { data: tokenRow, error: tokenErr } = await supabase
      .from('intake_tokens')
      .select('id, client_id, expires_at, completed_at, clients(name, org_id)')
      .eq('token', token)
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    if (tokenRow.completed_at) {
      return NextResponse.json({ error: 'This form has already been submitted' }, { status: 409 });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }

    const clientId   = tokenRow.client_id as string;
    const clientName = (tokenRow as any).clients?.name  as string ?? '';
    const orgId      = (tokenRow as any).clients?.org_id as string ?? '';

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

    // ── 3 & 4. Upload PDF and insert document row ─────────────────────────────

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

    // ── 5. Mark token as completed ────────────────────────────────────────────

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
