# DoulaFlow — Known Bugs
All Completed bugs should be moved from ##Active to ##Ready For Human Testing

## Active


## Ready For Human Testing
- The calander is not filtering by doula_id. all doulas can see all appointments that aren't for thier clients.

## Fixed
- Intake form submits on step 3 → added step guard in onSubmit so Enter key on earlier steps is ignored
- Package assignment duplicates → fixed with set_client_package RPC
- Login redirect race condition → fixed with onAuthStateChange
- Sidebar showing on login page → fixed with (app) route group
- Black calendar background → fixed with direct hex colors
- TypeScript build errors → fixed with strict: false in tsconfig
- Client list stale after edit → invalidate clients, clients:listview, client:profile in edit page onSubmit
- NEXT_PUBLIC_USER_ID hardcoded in components → replaced with useAuth() in NotesTab, TasksTab, ScheduleAppointmentModal, NewClientWizard, edit page
- Root URL doesn't redirect when logged in → already implemented correctly with getSession() in page.tsx
- when clicking an add-on within the edit client page, saving it does not add a record into supabase for that client_add_ons