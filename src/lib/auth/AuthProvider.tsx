import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase.ts';
import { AuthContext, type UserProfile } from './AuthContext.tsx';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, avatar_url, phone')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error.message);
      setProfile(null);
      return;
    }

    setProfile(data as UserProfile);
  }, []);

  useEffect(() => {
    // Get the initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (
    email: string,
    password: string,
    role: 'painter' | 'customer',
    displayName?: string
  ) => {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return { error: new Error(error.message), user: null };
    }

    const newUser = data.user;
    if (!newUser) {
      return { error: new Error('Sign up succeeded but no user was returned'), user: null };
    }

    // Insert profile row with the chosen role
    const { error: profileError } = await supabase.from('profiles').insert({
      id: newUser.id,
      role,
      display_name: displayName ?? null,
    });

    if (profileError) {
      console.error('Error creating profile:', profileError.message);
      return { error: new Error(profileError.message), user: newUser };
    }

    return { error: null, user: newUser };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext value={{
      user,
      profile,
      session,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext>
  );
}
