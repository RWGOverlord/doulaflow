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
  user:    AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, signOut: async () => {},
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
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Safety net: if the auth handshake hangs (slow network, congested DB),
    // unblock the loading state after 8 seconds so the user isn't permanently stuck.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    // onAuthStateChange fires INITIAL_SESSION immediately with the cached session,
    // so a separate getSession() call is redundant and creates a race condition
    // where both try to call loadProfile concurrently.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          try {
            const profile = await loadProfile(session.user);
            if (mounted) setUser(profile);
          } catch (err) {
            logger.error('auth', 'loadProfile', 'Failed to load user profile from DB', {
              userId: session.user.id,
              error: err instanceof Error ? err.message : String(err),
            });
            if (mounted) setUser(null);
          }
        } else {
          if (mounted) setUser(null);
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
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
