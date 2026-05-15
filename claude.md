# DoulaFlow — Claude Code Context

## Session Start Checklist
At the start of every session, read these files before doing anything:
- BUGS.md — known defects
- TASKS.md — current todos  
- ROADMAP.md — phase plan

## What This Is
A doula practice management SaaS app. Built for doulas to manage clients, 
appointments, packages, documents, and notes.

## Tech Stack
- Next.js 16 App Router (TypeScript)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Storage + Auth)
- TanStack React Query
- Deployed on Vercel at app.laquintanadoulacare.com

## Folder Structure
src/
  app/
    (app)/          ← authenticated pages (has sidebar layout + auth guard)
    login/          ← public login page
    intake/[token]/ ← public client intake form (no auth)
    api/            ← server-side API routes
  features/
    clients/        ← client management (api, components, hooks, types)
    packages/       ← service packages
    appointments/   ← appointment types + scheduling
    documents/      ← file upload/download
    intake/         ← intake form token + PDF generation
  components/       ← shared UI components (SidebarNav etc.)
  lib/
    supabaseClient.ts   ← browser Supabase client
    auth-context.tsx    ← AuthProvider + useAuth() hook

## Auth
- Supabase Auth with email/password
- AuthProvider wraps the whole app via src/app/providers.tsx
- useAuth() returns { user, loading, signOut }
- user.id = Supabase Auth UUID = public.users.id
- user.orgId = public.users.org_id
- All authenticated pages are under src/app/(app)/
- The (app)/layout.tsx has the auth guard — redirects to /login if no session

## Database
- Supabase project: jzjaiepktgizeodurhdf.supabase.co
- RLS is OFF — auth is handled at the app level
- Key tables: orgs, users, doulas, clients, packages, 
  appointment_types, package_appointment_types, client_packages,
  appointments, notes, documents, tasks, invoices, intake_tokens
- org_id for all records: cf301ffa-ebc4-40f3-9399-d00b23357fc0
- Never use process.env.NEXT_PUBLIC_USER_ID in new code — 
  always use useAuth().user.id instead
- Never use process.env.NEXT_PUBLIC_ORG_ID in new code — 
  always use useAuth().user.orgId instead

## Environment Variables
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_ORG_ID        ← legacy, use useAuth() instead in new code
NEXT_PUBLIC_USER_ID       ← legacy, use useAuth() instead in new code
SUPABASE_SERVICE_ROLE_KEY ← server-side only, never expose to browser

## Key Conventions
- All new pages go under src/app/(app)/ unless they are public
- Public pages (intake form, login) go directly under src/app/
- Use useAuth() to get the current user — never hardcode user/org IDs
- API files live in src/features/[feature]/api/[feature].api.ts
- Hooks live in src/features/[feature]/hooks/
- Use React Query for all data fetching — invalidate relevant query keys after mutations
- Important query keys: ['clients:listview'], ['client:profile', id], ['packages']
- After any client mutation, invalidate: clients, clients:listview, client:profile
- Storage bucket for documents: 'documents' (private)
- TypeScript strict mode is OFF (tsconfig strict: false)
- ESLint errors are ignored during build

## Current Status
Phase 1 complete and deployed. Fixing Bugs and final features. Active features:
- Client management (list, create, edit, filter, sort)
- Client case view (appointments, notes, documents, packages tabs)
- Schedule appointment modal with package usage tracking
- Packages + appointment types management  
- Calendar (react-big-calendar)
- Documents (upload/download/delete with category folders)
- Intake form system (token generation, public form, PDF upload)
- Auth (login/logout/session persistence)


## Do Not
- Do not add RLS policies without discussing first
- Do not create new Supabase tables without updating this file
- Do not use localStorage (not supported in Claude.ai artifacts)
- Do not add the sidebar to public pages
- Do not use the service role key in client-side code