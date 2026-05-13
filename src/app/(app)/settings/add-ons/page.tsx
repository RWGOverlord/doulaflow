// src/app/settings/add-ons/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  listAddOns,
  createAddOn,
  updateAddOn,
  deleteAddOn,
  type AddOn,
} from '@/features/add-ons/api/add_ons.api';
import { Plus, Pencil, Trash2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type FormValues = {
  name:        string;
  description: string;
  price:       number | '';
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddOnsPage() {
  const [addOns, setAddOns]         = useState<AddOn[]>([]);
  const [loading, setLoading]       = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<AddOn | null>(null);
  const [deleting, setDeleting]     = useState<number | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: { name: '', description: '', price: '' },
  });

  useEffect(() => {
    listAddOns()
      .then(setAddOns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    form.reset({ name: '', description: '', price: '' });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(a: AddOn) {
    setEditing(a);
    form.reset({
      name:        a.name,
      description: a.description ?? '',
      price:       a.price ?? '',
    });
    setError(null);
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const payload = {
        name:        values.name,
        description: values.description || null,
        price:       values.price !== '' ? Number(values.price) : null,
      };
      if (editing) {
        const updated = await updateAddOn(editing.id, payload);
        setAddOns(prev => prev.map(a => a.id === updated.id ? updated : a));
      } else {
        const created = await createAddOn(payload);
        setAddOns(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setDialogOpen(false);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await deleteAddOn(id);
      setAddOns(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert('Could not delete: ' + (err?.message ?? 'unknown error'));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b bg-background">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add-ons</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Custom services you can assign individually to clients
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Add-on
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
        ) : addOns.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center max-w-lg mx-auto mt-8">
            <div className="text-3xl mb-3">✨</div>
            <p className="font-medium text-muted-foreground">No add-ons yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Create custom services like "Extra Postpartum Visit" or "Lactation Consult" to assign to individual clients.
            </p>
            <Button onClick={openCreate} variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create your first add-on
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-background overflow-hidden max-w-3xl">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_72px] gap-4 px-5 py-2.5 border-b bg-muted/40">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</span>
              <span />
            </div>
            {/* Rows */}
            <div className="divide-y">
              {addOns.map(a => (
                <div
                  key={a.id}
                  className="grid grid-cols-[1fr_120px_72px] gap-4 items-center px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    {a.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{a.description}</div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {a.price != null ? `$${a.price.toLocaleString()}` : '—'}
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => openEdit(a)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting === a.id}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Add-on' : 'New Add-on'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                {...form.register('name', { required: true })}
                placeholder="e.g. Extra Postpartum Visit"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Price <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative max-w-[180px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  {...form.register('price')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                {...form.register('description')}
                placeholder="Brief description of this add-on…"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? 'Saving…'
                  : editing ? 'Save Changes' : 'Create Add-on'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
