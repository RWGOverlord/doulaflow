// src/lib/auth-context.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

type AuthUser = {
  id:     string;
  email:  string;
  name:   string;
  orgId:  string;
  role:   string;
};

type AuthContextType = {
  user:       AuthUser | null;
  loading:    boolean;
  signOut:    () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user:    null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(authUser: User) {
    const { data } = await supabase
      .from('users')
      .select('id, email, name, role, org_id')
      .eq('id', authUser.id)
      .single();

    if (data) {
      setUser({
        id:    data.id,
        email: data.email,
        name:  data.name ?? '',
        orgId: data.org_id,
        role:  data.role,
      });
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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
