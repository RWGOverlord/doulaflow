// src/app/(app)/settings/profile/page.tsx
'use client';

import Link from 'next/link';
import { ArrowLeft, User, Mail, Phone, FileText, MapPin } from 'lucide-react';

const PROFILE_FIELDS = [
  { icon: User,     label: 'Full Name',       placeholder: 'Your full name' },
  { icon: Mail,     label: 'Email',            placeholder: 'your@email.com' },
  { icon: Phone,    label: 'Phone',            placeholder: '(615) 555-0100' },
  { icon: MapPin,   label: 'City',             placeholder: 'Nashville, TN' },
  { icon: FileText, label: 'Bio',              placeholder: 'A short bio about your practice…' },
];

export default function ProfileSettingsPage() {
  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-6 border-b bg-background">
        <Link
          href="/settings"
          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your name, email, and doula info</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-2xl space-y-6">

          {/* Coming soon banner */}
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Profile editing coming soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll be able to update your name, contact info, and doula bio here.
            </p>
          </div>

          {/* Preview of fields */}
          <div className="rounded-xl border bg-background overflow-hidden divide-y opacity-50 pointer-events-none select-none">
            {PROFILE_FIELDS.map(({ icon: Icon, label, placeholder }) => (
              <div key={label} className="flex items-center gap-4 px-5 py-4">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                  <div className="text-sm text-muted-foreground/60 italic">{placeholder}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
