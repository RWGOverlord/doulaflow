// src/app/(app)/documents/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  listDocuments, uploadDocument, deleteDocument, getDownloadUrl,
  DOCUMENT_CATEGORIES, VISIBILITY_OPTIONS,
  formatFileSize, fileIcon,
  type Document, type DocumentCategory, type DocumentVisibility,
} from '@/features/documents/api/documents.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { Upload, Folder, FolderOpen, Download, Trash2, Search, X, ChevronRight, Users } from 'lucide-react';
import clsx from 'clsx';

type ClientOption = { id: string; name: string };

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({
  open, onClose, onUploaded, defaultCategory, defaultClientId, orgId, userId,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (doc: Document) => void;
  defaultCategory?: DocumentCategory;
  defaultClientId?: string | null;
  orgId: string;
  userId: string;
}) {
  const [file, setFile]             = useState<File | null>(null);
  const [title, setTitle]           = useState('');
  const [category, setCategory]     = useState<DocumentCategory>(defaultCategory ?? 'General');
  const [visibility, setVisibility] = useState<DocumentVisibility>('doula');
  const [clientId, setClientId]     = useState<string>(defaultClientId ?? '');
  const [clients, setClients]       = useState<ClientOption[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null); setTitle(''); setError(null);
    setCategory(defaultCategory ?? 'General');
    setClientId(defaultClientId ?? '');
    supabase.from('clients').select('id, name').eq('doula_id', userId).order('name')
      .then(({ data }) => setClients(data ?? []));
  }, [open, defaultCategory, defaultClientId, orgId]);

  function handleFile(f: File) {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Please select a file.'); return; }
    if (!title.trim()) { setError('Please enter a title.'); return; }
    setUploading(true); setError(null);
    try {
      const doc = await uploadDocument({
        file, title: title.trim(), category, visibility,
        clientId: clientId || null, orgId, userId,
      });
      onUploaded(doc);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={clsx(
              'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            )}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">{fileIcon(file.type)}</span>
                <div className="text-left">
                  <div className="text-sm font-medium truncate max-w-[200px]">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="ml-2 text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Drop a file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, Word, images up to 50MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
                value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
                {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
                value={visibility} onChange={e => setVisibility(e.target.value as DocumentVisibility)}>
                {VISIBILITY_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tag to Client <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
              value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">— Account level (no client) —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocRow({ doc, onDelete }: { doc: Document; onDelete: (doc: Document) => void }) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting]       = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try { const url = await getDownloadUrl(doc.storage_path); window.open(url, '_blank'); }
    catch (err) { console.error(err); }
    finally { setDownloading(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await deleteDocument(doc); onDelete(doc); }
    catch (err) { console.error(err); }
    finally { setDeleting(false); }
  }

  const visibilityBadge: Record<string, string> = {
    doula:  'bg-muted text-muted-foreground',
    client: 'bg-blue-50 text-blue-700',
    both:   'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
      <span className="text-xl shrink-0">{fileIcon(doc.file_type)}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{doc.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
          {doc.client_name && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />{doc.client_name}
              </span>
            </>
          )}
        </div>
      </div>
      <span className={clsx('text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0',
        visibilityBadge[doc.visibility] ?? visibilityBadge.doula)}>
        {VISIBILITY_OPTIONS.find(v => v.value === doc.visibility)?.label ?? doc.visibility}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={handleDownload} disabled={downloading}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Download className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user }                          = useAuth();
  const [docs, setDocs]                   = useState<Document[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState('');
  const [activeFolder, setActiveFolder]   = useState<DocumentCategory | 'All'>('All');
  const [uploadOpen, setUploadOpen]       = useState(false);

  useEffect(() => {
    if (!user) return;
    listDocuments({ orgId: user.orgId, doulaId: user.id })
      .then(setDocs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  function handleUploaded(doc: Document) { setDocs(prev => [doc, ...prev]); }
  function handleDeleted(doc: Document)  { setDocs(prev => prev.filter(d => d.id !== doc.id)); }

  const filtered = docs.filter(d => {
    const matchesFolder = activeFolder === 'All' || d.category === activeFolder;
    const matchesSearch = !searchTerm || d.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const counts = DOCUMENT_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = docs.filter(d => d.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  if (!user) return null;

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Folder sidebar */}
        <div className="w-52 shrink-0 border-r overflow-y-auto py-4">
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2">Folders</p>
          </div>

          <button
            onClick={() => setActiveFolder('All')}
            className={clsx(
              'flex items-center justify-between w-full px-4 py-2 text-sm transition-colors',
              activeFolder === 'All'
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <span className="flex items-center gap-2">
              {activeFolder === 'All' ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
              All Documents
            </span>
            <span className="text-xs text-muted-foreground">{docs.length}</span>
          </button>

          <div className="h-px bg-border mx-3 my-2" />

          {DOCUMENT_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFolder(cat)}
              className={clsx(
                'flex items-center justify-between w-full px-4 py-2 text-sm transition-colors',
                activeFolder === cat
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <span className="flex items-center gap-2">
                {activeFolder === cat ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                {cat}
              </span>
              {counts[cat] > 0 && (
                <span className="text-xs text-muted-foreground">{counts[cat]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          <div className="flex items-center gap-3 px-6 py-3 border-b bg-background">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search documents..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
            </div>
            {activeFolder !== 'All' && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{activeFolder}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-sm text-muted-foreground py-12 text-center">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
                <Folder className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  {searchTerm
                    ? 'No documents match your search'
                    : `No documents in ${activeFolder === 'All' ? 'your library' : activeFolder}`}
                </p>
                {!searchTerm && (
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-3.5 w-3.5" />
                    Upload a document
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map(doc => <DocRow key={doc.id} doc={doc} onDelete={handleDeleted} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
        orgId={user.orgId}
        userId={user.id}
      />
    </div>
  );
}
