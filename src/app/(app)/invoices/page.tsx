import { FileText } from 'lucide-react';

export default function InvoicesPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-6 border-b bg-background">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage client invoices and payments</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <FileText className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Coming Soon</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Invoice management is on its way. You'll be able to create and send invoices to clients here.
          </p>
        </div>
      </div>
    </div>
  );
}
