import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export const FREE_DAILY_LIMIT = 3;
export const PRO_DAILY_LIMIT = 999;

export type AppUser = {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  subscription_tier: "free" | "premium";
  signals_limit: number;
  signals_used_today: number;
  bonus_signals: number;
};

type AuthContextValue = {
  user: AppUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  update: (patch: {
    subscription_tier?: "free" | "premium";
    bonus_signals?: number;
    name?: string;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function loadUser(): Promise<AppUser | null> {
  const { data: sessionData } = await supabase.auth.getUser();
  const authUser = sessionData.user;
  if (!authUser) return null;

  const [{ data: profile }, { data: roles }, { data: usage }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", authUser.id),
    supabase
      .from("signal_usage")
      .select("signals_used")
      .eq("user_id", authUser.id)
      .eq("usage_date", todayUtc())
      .maybeSingle(),
  ]);

  const tier = profile?.subscription_tier === "premium" ? "premium" : "free";
  return {
    id: authUser.id,
    email: profile?.email ?? authUser.email ?? "",
    name: profile?.full_name ?? authUser.email?.split("@")[0] ?? "Trader",
    is_admin: (roles ?? []).some((r) => r.role === "admin"),
    subscription_tier: tier,
    signals_limit: tier === "premium" ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT,
    signals_used_today: usage?.signals_used ?? 0,
    bonus_signals: profile?.bonus_signals ?? 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setUser(await loadUser());
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await loadUser();
      if (!active) return;
      setUser(next);
      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") setUser(null);
      else void refresh();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => {
    const signOut = async () => {
      await supabase.auth.signOut();
      setUser(null);
    };

    return {
      user,
      ready,
      refresh,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return { error: error.message };
        await refresh();
        return { error: null };
      },
      signUp: async (email, password, name) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) return { error: error.message };
        if (!data.session) return { error: null, needsConfirmation: true };
        await refresh();
        return { error: null };
      },
      signInWithGoogle: async () => {
        // Redirects the browser to Google via Supabase's own OAuth flow.
        // Requires the Google provider to be enabled in the Supabase project
        // (Authentication > Providers > Google).
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) return { error: error.message };
        return { error: null };
      },
      signOut,
      logout: signOut,
      update: async (patch) => {
        if (!user) return;
        const row: { subscription_tier?: string; bonus_signals?: number; full_name?: string } = {};
        if (patch.subscription_tier) row.subscription_tier = patch.subscription_tier;
        if (patch.bonus_signals !== undefined) row.bonus_signals = patch.bonus_signals;
        if (patch.name) row.full_name = patch.name;
        if (Object.keys(row).length === 0) return;
        await supabase.from("profiles").update(row).eq("id", user.id);
        await refresh();
      },
    };
  }, [user, ready, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
