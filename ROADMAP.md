# DoulaFlow — Roadmap

## Phase 1 — Core Practice Management ✅ COMPLETE
- Client management (list, create, edit, filter, sort)
- Client case view (appointments, notes, documents, packages)
- Schedule appointment modal with package usage tracking
- Packages + appointment types management
- Calendar
- Documents (upload/download/delete, category folders)
- Intake form (token, public form, PDF generation)
- Auth (login/logout/session persistence)
- Deployed at app.laquintanadoulacare.com

## Phase 2 — Business Tools
- all intake form data should be stored in supabase under new table
- ability to edit the intake form using the new client_intake_form table
- Invoice generation (PDF template)
- Email invoices and documents via Resend API. 
- the email services should be structured in a way that migrating from Resend to Mailgun for multi-doula /org support will be easy.
- Send intake form link via email through Resend API (currently copy/paste)
- E-sign contracts
- Google Calendar sync (two-way)
- Outlook Calendar sync
- Insights/analytics dashboard
  - Revenue tracking
  - Client count over time
  - Appointments this week
  - Clients by status
- Stripe payment integration
- "Clear Client" feature to wipe out sensative client data while keeping relevant data for insights dashboard (data fields still to be defined)

## Phase 3 — Client Portal (Web)
- Client login via app.laquintanadoulacare.com
- Client can view their own appointments
- Client can view shared documents (visibility: both)
- Client can view their package and what's included
- Client can request appointment reschedule
- Client can complete intake form via invite link
- Client can pay invoices online
- No push notifications or reminders yet

## Phase 4 — Client Mobile App
- Expo React Native app for clients
- View appointments, documents, package details
- Baby size tracker ("your baby is the size of a grape")
  - Week by week pregnancy progression
  - Fun fruit/object comparisons
  - Developmental milestones
- Messaging with doula
- Push notifications and appointment reminders

## Phase 5 — Multi-Doula / Org Support
- Second doula onboarding flow
- Team and staff permissions
- RLS (Row Level Security) enforcement across all tables
- Each doula sees only their own clients and data
- Org-level settings and branding
- HIPAA-ready hosting path
- CSV/Airtable import tool
- White-label option for other doula practices
- Advanced analytics across the org