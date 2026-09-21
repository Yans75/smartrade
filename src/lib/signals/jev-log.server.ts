import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { Question, SystemOneResponse } from "@/lib/jev/client.server";
import type { TradingMode, TradingSignal } from "@/lib/mock/types";
import type { JevDecision } from "./build-signal";
import type { SignalState } from "./jev-state";

/**
 * Journalisation des appels à Jev, pour backtest et calibration.
 *
 * Deux règles non négociables :
 *
 * 1. Une écriture de journal ne doit JAMAIS faire échouer une génération de
 *    signal. Toute erreur est avalée et tracée en console — l'utilisateur a
 *    déjà son signal, perdre la ligne de calibration est un moindre mal.
 *
 * 2. On archive l'état ET les questions tels qu'envoyés. Les questions
 *    évolueront (c'est le but d'une calibration) ; sans leur version d'origine,
 *    les réponses d'hier ne seraient plus comparables à celles de demain.
 */

export type JevLogPayload = {
  userId: string | null;
  symbol: string;
  mode: TradingMode;
  model: string;
  state: SignalState;
  questions: Record<string, Question>;
  response: SystemOneResponse;
  decision: JevDecision;
  signal: TradingSignal;
  latencyMs: number;
};

/** Plafond sur l'écriture du journal : au-delà, on abandonne la ligne. */
const LOG_TIMEOUT_MS = 3_000;

/**
 * Insère la ligne de journal et renvoie son id, ou null en cas d'échec.
 * Le signal n'est pas encore en base à cet instant : le rattachement se fait
 * ensuite via linkJevCallToSignal.
 */
export async function logJevCall(payload: JevLogPayload): Promise<string | null> {
  try {
    const insert = supabaseAdmin
      .from("jev_calls")
      .insert({
        user_id: payload.userId,
        symbol: payload.symbol,
        trading_mode: payload.mode,
        model: payload.model,
        state: payload.state as unknown as Json,
        questions: payload.questions as unknown as Json,
        answers: payload.response.answers as unknown as Json,
        direction: payload.decision.direction,
        direction_probability: payload.decision.directionProbability,
        setup_quality: payload.decision.setupQuality,
        setup_confidence: payload.decision.setupConfidence,
        entry_timing: payload.decision.entryTiming,
        veto_reason: payload.decision.vetoReason,
        confidence_score: payload.signal.confidence_score,
        entry_price: payload.signal.entry_price,
        stop_loss: payload.signal.stop_loss,
        take_profit_1: payload.signal.take_profit_1,
        latency_ms: payload.latencyMs,
        input_tokens: payload.response.usage.input_tokens,
        output_tokens: payload.response.usage.output_tokens,
      })
      .select("id")
      .maybeSingle();

    const result = await withTimeout(insert, LOG_TIMEOUT_MS);
    if (result === null) {
      console.error("[Jev] journal : délai dépassé, ligne abandonnée");
      return null;
    }
    if (result.error) {
      console.error("[Jev] journal : insertion refusée —", result.error.message);
      return null;
    }
    return (result.data as { id: string } | null)?.id ?? null;
  } catch (error) {
    console.error("[Jev] journal : échec —", (error as Error).message);
    return null;
  }
}

/** Rattache la ligne de journal au signal persisté. Sans effet si l'un manque. */
export async function linkJevCallToSignal(
  jevCallId: string | null,
  signalId: string | null,
): Promise<void> {
  if (!jevCallId || !signalId) return;
  try {
    const update = supabaseAdmin
      .from("jev_calls")
      .update({ signal_id: signalId })
      .eq("id", jevCallId);
    await withTimeout(update, LOG_TIMEOUT_MS);
  } catch (error) {
    console.error("[Jev] journal : rattachement au signal échoué —", (error as Error).message);
  }
}

/** Renvoie null si l'opération dépasse le délai, plutôt que d'attendre. */
async function withTimeout<T>(operation: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(operation),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
