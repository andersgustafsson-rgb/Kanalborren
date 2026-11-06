import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { fetchIsAdmin } from "./adminApi";
import { isSupabaseConfigured, supabase } from "./supabase";
import { localDisplayName, setLocalDisplayName } from "./localPresence";

type AuthState = {
  ready: boolean;
  configured: boolean;
  user: User | null;
  session: Session | null;
  displayName: string;
  isAdmin: boolean;
  setDisplayName: (name: string) => void;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsEmailConfirm?: boolean }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function upsertProfile(user: User, displayName: string) {
  if (!supabase) return;
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name:
        displayName ||
        (typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : null) ||
        user.email?.split("@")[0] ||
        "Fiskare",
      age_attested_16_plus: true,
    },
    { onConflict: "id" },
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayNameState] = useState(() => localDisplayName());
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!configured || !supabase) {
      setReady(true);
      return;
    }
    let mounted = true;

    async function applySession(s: Session | null) {
      setSession(s);
      if (!s?.user) {
        setIsAdmin(false);
        return;
      }
      const meta = s.user.user_metadata?.display_name;
      if (typeof meta === "string" && meta) {
        setDisplayNameState(meta);
        setLocalDisplayName(meta);
      }
      void upsertProfile(
        s.user,
        (typeof meta === "string" && meta) || localDisplayName(),
      );
      const admin = await fetchIsAdmin(s.user.id);
      if (mounted) setIsAdmin(admin);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      void applySession(data.session).finally(() => {
        if (mounted) setReady(true);
      });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void applySession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  const setDisplayName = useCallback((name: string) => {
    setLocalDisplayName(name);
    setDisplayNameState(name.trim() || localDisplayName());
    if (supabase && session?.user) {
      void supabase
        .from("profiles")
        .update({ display_name: name.trim() || "Fiskare" })
        .eq("id", session.user.id);
      void supabase.auth.updateUser({
        data: { display_name: name.trim() || "Fiskare" },
      });
    }
  }, [session?.user]);

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: "Supabase är inte konfigurerat" };
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName,
            age_attested_16_plus: true,
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) return { error: error.message };
      if (data.user && !data.session) {
        return {
          error: null,
          needsEmailConfirm: true,
        };
      }
      return { error: null };
    },
    [displayName],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase är inte konfigurerat" };
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      configured,
      user: session?.user ?? null,
      session,
      displayName,
      isAdmin,
      setDisplayName,
      signUp,
      signIn,
      signOut,
    }),
    [
      ready,
      configured,
      session,
      displayName,
      isAdmin,
      setDisplayName,
      signUp,
      signIn,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
