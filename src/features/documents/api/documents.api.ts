// src/features/documents/api/documents.api.ts
import { supabase } from '@/lib/supabaseClient';

export const DOCUMENT_CATEGORIES = [
  'Contracts',
  'Birth Plans',
  'Intake Forms',
  'Consent Forms',
  'Resources',
  'Invoices',
  'General',
] as const;

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number];

export const VISIBILITY_OPTIONS = [
  { value: 'doula',  label: 'Doula only' },
  { value: 'client', label: 'Client only' },
  { value: 'both',   label: 'Doula & Client' },
] as const;

export type DocumentVisibility = 'doula' | 'client' | 'both';

export type Document = {
  id:           string;
  org_id:       string;
  client_id:    string | null;
  uploaded_by:  string | null;
  title:        string;
  storage_path: string;
  visibility:   DocumentVisibility;
  category:     DocumentCategory | null;
  file_size:    number | null;
  file_type:    string | null;
  created_at:   string;
  client_name?: string | null;
};

function storagePath(orgId: string, userId: string, fileName: string): string {
  const timestamp = Date.now();
  const clean = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${orgId}/${userId}/${timestamp}_${clean}`;
}

export async function uploadDocument(params: {
  file:       File;
  title:      string;
  category:   DocumentCategory;
  visibility: DocumentVisibility;
  clientId:   string | null;
  orgId:      string;
  userId:     string;
}): Promise<Document> {
  const { file, title, category, visibility, clientId, orgId, userId } = params;
  const path = storagePath(orgId, userId, file.name);

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from('documents')
    .insert({
      org_id:       orgId,
      client_id:    clientId || null,
      uploaded_by:  userId,
      title,
      storage_path: path,
      visibility,
      category,
      file_size:    file.size,
      file_type:    file.type,
    })
    .select('*')
    .single();

  if (dbError) {
    await supabase.storage.from('documents').remove([path]);
    throw dbError;
  }
  return data as Document;
}

export async function listDocuments(params: {
  orgId:     string;
  clientId?: string | null;
}): Promise<Document[]> {
  let query = supabase
    .from('documents')
    .select('*, clients ( name )')
    .eq('org_id', params.orgId)
    .order('created_at', { ascending: false });

  if (params.clientId) {
    query = query.eq('client_id', params.clientId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((d: any) => ({
    ...d,
    client_name: d.clients?.name ?? null,
  }));
}

export async function deleteDocument(doc: Document): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([doc.storage_path]);
  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', doc.id);
  if (dbError) throw dbError;
}

export async function getDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileIcon(fileType: string | null): string {
  if (!fileType) return '📄';
  if (fileType.includes('pdf')) return '📕';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
  return '📄';
}