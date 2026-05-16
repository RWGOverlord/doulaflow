// src/app/(app)/settings/notifications/page.tsx
'use client';

import Link from 'next/link';
import { ArrowLeft, Bell, Mail, MessageSquare, Calendar, Baby } from 'lucide-react';

const NOTIFICATION_GROUPS = [
  {
    title: 'Email',
    items: [
      { icon: Calendar,      label: 'Appointment reminders',       description: 'Get notified before upcoming appointments' },
      { icon: Baby,          label: 'Client milestones',           description: 'Due dates and postpartum check-in reminders' },
      { icon: MessageSquare, label: 'New intake form submissions',  description: 'When a client completes their intake form' },
    ],
  },
  {
    title: 'Push',
    items: [
      { icon: Bell,          label: 'Same-day appointment alerts',  description: 'Reminder on the day of a scheduled appointment' },
      { icon: MessageSquare, label: 'Client messages',             description: 'When a client sends you a message' },
    ],
  },
];

export default function NotificationsSettingsPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Email and push notification preferences</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-2xl space-y-6">

          {/* Coming soon banner */}
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Notification settings coming soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll be able to control email and push alerts for appointments, clients, and more.
            </p>
          </div>

          {/* Preview of toggles */}
          {NOTIFICATION_GROUPS.map(group => (
            <div key={group.title} className="opacity-50 pointer-events-none select-none">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {group.title}
              </h2>
              <div className="rounded-xl border bg-background overflow-hidden divide-y">
                {group.items.map(item => (
                  <div key={item.label} className="flex items-center gap-4 px-5 py-4">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                    </div>
                    {/* Toggle placeholder */}
                    <div className="h-5 w-9 rounded-full bg-muted shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
