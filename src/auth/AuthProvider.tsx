import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.ts";
import type { Profile } from "../lib/types.ts";

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  /** true until the first session check (and profile load) has finished */
  loading: boolean;
  profileFailed: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileFailed, setProfileFailed] = useState(false);
  const loadedFor = useRef<string | null>(null); // user id whose profile is loaded

  // The role and status come from the database (the profiles table) and
  // nowhere else. RLS lets a user read only their own row.
  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, full_name, phone, status, language, id_type, avatar_path")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) {
      setProfile(null);
      setProfileFailed(true);
      loadedFor.current = null;
    } else {
      setProfile(data as Profile);
      setProfileFailed(false);
      loadedFor.current = userId;
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setProfileFailed(false);
        loadedFor.current = null;
        return;
      }
      // Token refreshes and tab re-focus fire this too: nothing to reload.
      if (loadedFor.current === s.user.id) return;
      // Do not call Supabase inside this callback directly (can deadlock).
      setLoading(true);
      setTimeout(async () => {
        await loadProfile(s.user.id);
        setLoading(false);
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, profile, loading, profileFailed, refreshProfile, signOut }),
    [session, profile, loading, profileFailed, refreshProfile, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
