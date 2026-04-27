'use client';
import NewClientWizard from '@/features/clients/components/NewClientWizard';

export default function NewClientPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">New Client</h1>
      <NewClientWizard />
    </div>
  );
}
