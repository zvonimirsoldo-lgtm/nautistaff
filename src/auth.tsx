import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  role: 'worker' | 'employer' | 'admin';
  full_name: string;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  reloadProfile: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>({
  session: null, profile: null, loading: true, profileError: null, reloadProfile: async () => {},
});
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles').select('id, role, full_name').eq('id', s.user.id).maybeSingle();
    if (error || !data) {
      setProfile(null);
      setProfileError(error?.message ?? 'Profil nije pronađen. Je li datoteka 01_baza.sql pokrenuta u Supabaseu?');
    } else {
      setProfile(data as Profile);
      setProfileError(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // odgodimo učitavanje profila da ne blokiramo Supabase unutar ovog poziva
      setTimeout(() => { loadProfile(s); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const reloadProfile = useCallback(() => loadProfile(session), [loadProfile, session]);

  return (
    <AuthCtx.Provider value={{ session, profile, loading, profileError, reloadProfile }}>
      {props.children}
    </AuthCtx.Provider>
  );
}
