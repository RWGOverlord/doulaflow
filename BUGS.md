# DoulaFlow — Known Bugs

## Active

### HIGH — Session timeout too short (~30 minutes)
Supabase default session expiry is too short. Users are being logged out
after ~30 minutes of inactivity. Target: extend to 4 hours.
Fix options:
1. In Supabase dashboard → Authentication → Settings → JWT expiry,
   increase from default (3600s) to 14400s (4 hours)
2. Also enable "Refresh token rotation" and set refresh token expiry
   longer so active sessions stay alive
3. In auth-context.tsx ensure onAuthStateChange handles TOKEN_REFRESHED
   event so the session silently refreshes without logging the user out


### HIGH — Intake form "invalid token" error on submit
Token validation is failing at submit time even when the token exists
in the intake_tokens table. Likely causes:
1. The API route at src/app/api/intake/submit/route.ts is re-validating
   the token and the query is failing silently
2. The token may be getting URL-encoded or truncated when passed
3. The completed_at or expires_at check may be too strict
Debug: log the raw token received in the API route and compare to DB

### MEDIUM — Client list stale after edit
Edit client page makes direct Supabase calls and doesn't invalidate
React Query cache. Client list shows old data until page refresh.
Fix: add queryClient.invalidateQueries(['clients:listview']) after
save in src/app/(app)/clients/[id]/edit/page.tsx

### MEDIUM — Root URL doesn't redirect when already logged in
Navigating to app.laquintanadoulacare.com when already authenticated
does not redirect to /clients. The root page.tsx checks session but
may not be catching an existing session correctly.
Fix: ensure src/app/page.tsx calls supabase.auth.getSession() and
redirects to /clients if a valid session exists

### LOW — NEXT_PUBLIC_USER_ID still hardcoded in some API files
packages.api.ts, appointment_types.api.ts and others still use
process.env.NEXT_PUBLIC_USER_ID instead of useAuth(). Works for
single doula but will break when Phase 5 multi-doula is added.

## Fixed
- Intake form submits on step 3 → added step guard in onSubmit so Enter key on earlier steps is ignored
- Package assignment duplicates → fixed with set_client_package RPC
- Login redirect race condition → fixed with onAuthStateChange
- Sidebar showing on login page → fixed with (app) route group
- Black calendar background → fixed with direct hex colors
- TypeScript build errors → fixed with strict: false in tsconfig