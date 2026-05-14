import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Uses the service role key so the upload bypasses Supabase RLS.
// SUPABASE_SERVICE_ROLE_KEY must be set as a server-side env variable
// (no NEXT_PUBLIC_ prefix — never exposed to the browser).
function adminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!svcKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, svcKey, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const form       = await req.formData();
    const pdfFile    = form.get('pdf')        as File   | null;
    const clientId   = form.get('clientId')   as string | null;
    const clientName = form.get('clientName') as string | null;

    if (!pdfFile || !clientId || !clientName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = adminClient();

    // Resolve the org_id from the client record
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('org_id')
      .eq('id', clientId)
      .single();

    if (clientErr || !clientRow) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const orgId     = clientRow.org_id as string;
    const timestamp = Date.now();
    const path      = `${orgId}/${clientId}/intake_${timestamp}.pdf`;

    // Upload the PDF to the 'documents' storage bucket
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(path, await pdfFile.arrayBuffer(), {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadErr) {
      console.error('[intake/upload] storage error', uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // Insert the document metadata row
    const date  = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    const title = `Intake Form — ${clientName} — ${date}`;

    const { error: dbErr } = await supabase
      .from('documents')
      .insert({
        org_id:       orgId,
        client_id:    clientId,
        uploaded_by:  null,
        title,
        storage_path: path,
        visibility:   'doula',
        category:     'Intake Forms',
        file_size:    pdfFile.size,
        file_type:    'application/pdf',
      });

    if (dbErr) {
      // Best-effort cleanup: remove the uploaded file if the DB insert fails
      await supabase.storage.from('documents').remove([path]);
      console.error('[intake/upload] db error', dbErr);
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[intake/upload] unexpected error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
