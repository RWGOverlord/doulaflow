// src/app/settings/page.tsx
import Link from 'next/link';
import { Calendar, ChevronRight, User, Bell } from 'lucide-react';

const SETTINGS_SECTIONS = [
  {
    title: 'Practice',
    items: [
      {
        href:        '/settings/appointment-types',
        icon:        Calendar,
        label:       'Appointment Types',
        description: 'Manage reusable appointment templates for packages',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        href:        '/settings/profile',
        icon:        User,
        label:       'Profile',
        description: 'Your name, email, and doula info',
      },
      {
        href:        '/settings/notifications',
        icon:        Bell,
        label:       'Notifications',
        description: 'Email and push notification preferences',
      },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-6 border-b bg-background">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your practice and account settings</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-2xl space-y-8">
          {SETTINGS_SECTIONS.map(section => (
            <div key={section.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {section.title}
              </h2>
              <div className="rounded-xl border bg-background overflow-hidden divide-y">
                {section.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
