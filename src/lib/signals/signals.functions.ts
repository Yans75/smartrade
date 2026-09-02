import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeStats, rowToSignal, type SignalRow } from "./map";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { TrackableSignal } from "./tracking.server";

type SupabaseLike = SupabaseClient<Database>;

const GenerateInput = z.object({
  symbol: z.string().min(1),
  mode: z.enum(["scalping", "day_trading", "swing"]),
});

const FREE_DAILY_LIMIT = 3;
const SIGNAL_COLUMNS =
  "id, symbol, direction, entry_price, stop_loss, take_profit_1, take_profit_2, take_profit_3, confidence_score, trading_mode, strategy, timeframe_analysis, order_flow_confirmation, reasoning, position_advice, market_warning, status, pnl_percent, closed_price, closed_at, created_at";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/** Generates an AI signal, enforces the daily quota server-side and persists it. */
export const generateSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: usage }] = await Promise.all([
      supabase
        .from("profiles")
        .select("subscription_tier, bonus_signals")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("signal_usage")
        .select("signals_used")
        .eq("user_id", userId)
        .eq("usage_date", todayUtc())
        .maybeSingle(),
    ]);

    const isPro = profile?.subscription_tier === "premium";
    const used = usage?.signals_used ?? 0;
    const allowance = FREE_DAILY_LIMIT + (profile?.bonus_signals ?? 0);
    if (!isPro && used >= allowance) {
      return {
        signal: null,
        usage: { used, limit: allowance },
        error: {
          message: `Limite gratuite atteinte (${allowance} signaux aujourd'hui). Passez Pro pour des signaux illimités.`,
          status: 402,
        },
      };
    }

    const { generateAiSignal, AiGatewayError } = await import("./signals.server");
    let signal;
    try {
      signal = await generateAiSignal(data.symbol, data.mode);
    } catch (error) {
      const status = error instanceof AiGatewayError ? error.status : 500;
      return {
        signal: null,
        usage: { used, limit: isPro ? 999 : allowance },
        error: { message: (error as Error).message || "Analyse impossible.", status },
      };
    }

    const { data: inserted } = await supabase
      .from("signals")
      .insert({
        user_id: userId,
        symbol: signal.symbol,
        direction: signal.direction,
        entry_price: signal.entry_price,
        stop_loss: signal.stop_loss,
        take_profit_1: signal.take_profit_1,
        take_profit_2: signal.take_profit_2,
        take_profit_3: signal.take_profit_3,
        confidence_score: signal.confidence_score,
        trading_mode: signal.trading_mode,
        strategy: signal.strategy,
        timeframe_analysis: signal.timeframe_analysis,
        order_flow_confirmation: signal.order_flow_confirmation,
        reasoning: signal.reasoning,
        position_advice: signal.position_advice,
        market_warning: signal.market_warning,
        status: signal.status,
      })
      .select(SIGNAL_COLUMNS)
      .maybeSingle();

    await supabase
      .from("signal_usage")
      .upsert(
        { user_id: userId, usage_date: todayUtc(), signals_used: used + 1 },
        { onConflict: "user_id,usage_date" },
      );

    return {
      signal: inserted ? rowToSignal(inserted as unknown as SignalRow) : signal,
      usage: { used: used + 1, limit: isPro ? 999 : allowance },
      error: null,
    };
  });

const TRACKING_COLUMNS =
  "id, symbol, direction, entry_price, stop_loss, take_profit_1, take_profit_2, take_profit_3, trading_mode, status, created_at";

/** Market data is rate-limited: one outcome sweep per user per minute is plenty. */
const SYNC_INTERVAL_MS = 60_000;
const lastSync = new Map<string, number>();

/**
 * Replays the market on every open signal and persists TP / SL outcomes.
 * Without it pnl_percent stays null forever and the whole track record is empty.
 */
async function syncOutcomes(supabase: SupabaseLike, userId: string, force = false) {
  const previous = lastSync.get(userId) ?? 0;
  if (!force && Date.now() - previous < SYNC_INTERVAL_MS) return 0;
  lastSync.set(userId, Date.now());

  const { data } = await supabase
    .from("signals")
    .select(TRACKING_COLUMNS)
    .eq("user_id", userId)
    .is("closed_at", null)
    .neq("direction", "NEUTRAL")
    .order("created_at", { ascending: false })
    .limit(100);

  const open = (data ?? []) as unknown as TrackableSignal[];
  if (open.length === 0) return 0;

  const { resolveSignals } = await import("./tracking.server");
  const outcomes = await resolveSignals(
    open.map((s) => ({
      ...s,
      entry_price: Number(s.entry_price),
      stop_loss: Number(s.stop_loss),
      take_profit_1: Number(s.take_profit_1),
      take_profit_2: Number(s.take_profit_2),
      take_profit_3: Number(s.take_profit_3),
    })),
  ).catch(() => []);

  await Promise.all(
    outcomes.map((o) =>
      supabase
        .from("signals")
        .update({
          status: o.status,
          closed_price: o.closed_price,
          closed_at: o.closed_at,
          pnl_percent: o.pnl_percent,
        })
        .eq("id", o.id)
        .eq("user_id", userId),
    ),
  );
  return outcomes.length;
}

/** All signals of the signed-in user, newest first. */
export const listMySignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await syncOutcomes(context.supabase, context.userId).catch(() => 0);
    const { data } = await context.supabase
      .from("signals")
      .select(SIGNAL_COLUMNS)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(300);
    const signals = ((data ?? []) as unknown as SignalRow[]).map(rowToSignal);
    return { signals, stats: computeStats(signals) };
  });

/** Manual "check my signals now" trigger, bypassing the throttle. */
export const checkMySignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const updated = await syncOutcomes(context.supabase, context.userId, true).catch(() => 0);
    return { updated };
  });
