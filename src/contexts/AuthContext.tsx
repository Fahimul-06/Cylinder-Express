import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, Session, User } from '../lib/supabase';
import { CustomerSettings, Profile } from '../lib/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  signIn: (emailOrPhone: string, password: string) => Promise<{ error: string | null }>;
  signInManagement: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signInHub: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signInWithSocial: (provider: 'google' | 'facebook', accessToken: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { full_name?: string; email?: string; phone?: string; avatar_url?: string; family_members?: number; daily_cooking_times?: number; customer_settings?: CustomerSettings }) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => { await fetchProfile(s.user.id); })();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => { await fetchProfile(s.user.id); })();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });
    if (error) return { error: error.message };

    const { data: { user: newUser } } = await supabase.auth.getUser();
    if (newUser) {
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: newUser.id,
        full_name: fullName,
        phone,
        email,
      });
      if (profileError) return { error: profileError.message };
      await fetchProfile(newUser.id);
    }
    return { error: null };
  };

  const signIn = async (emailOrPhone: string, password: string) => {
    const { error } = await supabase.auth.signInCustomer({ identifier: emailOrPhone, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signInHub = async (identifier: string, password: string) => {
    const { error } = await supabase.auth.signInHub({ identifier, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signInManagement = async (identifier: string, password: string) => {
    const { error } = await supabase.auth.signInManagement({ identifier, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signInWithSocial = async (provider: 'google' | 'facebook', accessToken: string) => {
    const { error } = await supabase.auth.signInWithSocial({ provider, accessToken });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateProfile = async (updates: { full_name?: string; email?: string; phone?: string; avatar_url?: string; family_members?: number; daily_cooking_times?: number; customer_settings?: CustomerSettings }) => {
    if (!user) return { error: 'Not authenticated' };
    const profileUpdates: { full_name?: string; email?: string; phone?: string; avatar_url?: string; family_members?: number; daily_cooking_times?: number; customer_settings?: CustomerSettings; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name;
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
    if (updates.email !== undefined) profileUpdates.email = updates.email;
    if (updates.avatar_url !== undefined) profileUpdates.avatar_url = updates.avatar_url;
    if (updates.family_members !== undefined) profileUpdates.family_members = updates.family_members;
    if (updates.daily_cooking_times !== undefined) profileUpdates.daily_cooking_times = updates.daily_cooking_times;
    if (updates.customer_settings !== undefined) profileUpdates.customer_settings = updates.customer_settings;

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('user_id', user.id);
    if (profileError) return { error: profileError.message };

    if (updates.email) {
      const { error: authError } = await supabase.auth.updateUser({ email: updates.email });
      if (authError) return { error: authError.message };
    }

    await fetchProfile(user.id);
    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signUp, signIn, signInHub, signInManagement, signInWithSocial, signOut, updateProfile, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
