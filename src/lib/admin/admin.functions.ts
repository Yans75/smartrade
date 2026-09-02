import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SignalStatus } from "@/lib/mock/types";

const TierInput = z.object({ userId: z.string().uuid(), tier: z.enum(["free", "premium"]) });
const UserInput = z.object({ userId: z.string().uuid() });
const BonusInput = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(1).max(100),
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const supabase = context.supabase as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{ data: unknown }>;
          };
        };
      };
    };
  };
  // Reads the caller's own row under RLS ("Users can read their own roles").
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Accès réservé aux administrateurs.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  tier: "free" | "premium";
  bonus_signals: number;
  signals_used_today: number;
  signals_limit: number;
  is_admin: boolean;
  created_at: string;
};

const RoleInput = z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const [{ data: profiles }, { data: usage }, { data: signals }, { data: roles }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, full_name, email, subscription_tier, bonus_signals, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        admin
          .from("signal_usage")
          .select("user_id, signals_used, usage_date")
          .eq("usage_date", today()),
        admin
          .from("signals")
          .select("id, symbol, confidence_score, pnl_percent, status, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        admin.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);

    const usedBy = new Map((usage ?? []).map((u) => [u.user_id, u.signals_used]));
    const admins = new Set((roles ?? []).map((r) => r.user_id));
    const users: AdminUser[] = (profiles ?? []).map((p) => {
      const tier = p.subscription_tier === "premium" ? "premium" : "free";
      return {
        id: p.id,
        name: p.full_name ?? "—",
        email: p.email ?? "—",
        tier,
        bonus_signals: p.bonus_signals,
        signals_used_today: usedBy.get(p.id) ?? 0,
        signals_limit: tier === "premium" ? 999 : 3 + p.bonus_signals,
        is_admin: admins.has(p.id),
        created_at: p.created_at,
      };
    });

    const rows = signals ?? [];
    const startOfDay = today();
    return {
      users,
      recent: rows.slice(0, 9).map((s) => ({
        id: s.id,
        symbol: s.symbol,
        confidence_score: s.confidence_score,
        pnl_percent: s.pnl_percent === null ? null : Number(s.pnl_percent),
        status: (s.status === "tp_hit" ||
        s.status === "sl_hit" ||
        s.status === "closed" ||
        s.status === "expired"
          ? s.status
          : "active") as SignalStatus,
        created_at: s.created_at,
      })),
      stats: {
        users: users.length,
        premium: users.filter((u) => u.tier === "premium").length,
        signals_today: rows.filter((s) => s.created_at.slice(0, 10) === startOfDay).length,
        signals_total: rows.length,
        mrr: users.filter((u) => u.tier === "premium").length * 29,
      },
    };
  });

export const setUserTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TierInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { error } = await admin
      .from("profiles")
      .update({ subscription_tier: data.tier })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UserInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { error } = await admin
      .from("signal_usage")
      .upsert({ user_id: data.userId, usage_date: today(), signals_used: 0 });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addBonusSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BonusInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: profile } = await admin
      .from("profiles")
      .select("bonus_signals")
      .eq("id", data.userId)
      .maybeSingle();
    const { error } = await admin
      .from("profiles")
      .update({ bonus_signals: (profile?.bonus_signals ?? 0) + data.amount })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UserInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId)
      throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    const admin = await assertAdmin(context);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Grants or revokes the admin role for a user. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RoleInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId && !data.makeAdmin)
      throw new Error("Vous ne pouvez pas retirer votre propre accès administrateur.");
    const admin = await assertAdmin(context);
    if (data.makeAdmin) {
      const { error } = await admin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
