// src/lib/auth-context.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
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

    // Get initial session immediately
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        const profile = await loadProfile(session.user);
        if (mounted) setUser(profile);
      }
      if (mounted) setLoading(false);
    });

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const profile = await loadProfile(session.user);
          if (mounted) setUser(profile);
        } else {
          if (mounted) setUser(null);
        }
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
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
