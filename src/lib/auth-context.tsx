// src/lib/auth-context.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';

type AuthUser = {
  id:    string;
  email: string;
  name:  string;
  orgId: string;
  role:  string;
};

type AuthContextType = {
  user:         AuthUser | null;
  loading:      boolean;
  profileError: string | null;
  signOut:      () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, profileError: null, signOut: async () => {},
});

async function loadProfile(authUser: User): Promise<AuthUser | null> {
  const { data } = await supabase
    .from('users')
    .select('id, email, name, role, org_id')
    .eq('id', authUser.id)
    .single();

  if (!data) return null;
  return {
    id:    data.id,
    email: data.email,
    name:  data.name ?? '',
    orgId: data.org_id,
    role:  data.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                 = useState<AuthUser | null>(null);
  const [loading, setLoading]           = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Safety net: if auth handshake hangs, only unblock loading when there is
    // genuinely no session. If a session exists, loadProfile is still running —
    // leave loading=true so the layout doesn't redirect to /login prematurely.
    const timeout = setTimeout(async () => {
      if (!mounted) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) {
        setUser(null);
        setLoading(false);
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // TOKEN_REFRESHED: JWT rotated, profile unchanged — skip redundant DB call
        if (event === 'TOKEN_REFRESHED') {
          if (mounted) setLoading(false);
          return;
        }

        if (session?.user) {
          try {
            const profile = await loadProfile(session.user);
            if (mounted) {
              if (profile) {
                setUser(profile);
                setProfileError(null);
              } else {
                // Session is valid but no matching row in public.users.
                // Don't redirect to /login silently — surface the error so the
                // user isn't caught in a lockout loop.
                setProfileError('Your account profile could not be loaded. Please contact support.');
                setUser(null);
              }
            }
          } catch (err) {
            logger.error('auth', 'loadProfile', 'Failed to load user profile from DB', {
              userId: session.user.id,
              error: err instanceof Error ? err.message : String(err),
            });
            if (mounted) {
              setProfileError('Failed to load your account. Please try again.');
              setUser(null);
            }
          }
        } else {
          if (mounted) {
            setUser(null);
            setProfileError(null);
          }
        }

        if (mounted) {
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfileError(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, profileError, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
