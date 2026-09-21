import { JEV_MODEL, JevError, systemOne } from "@/lib/jev/client.server";
import { fetchCandles, fetchDepth, fetchQuotes } from "@/lib/market/market.server";
import { TIMEFRAMES, type Timeframe } from "@/lib/market/symbols";
import { analyseStructure, type StructureAnalysis } from "./analysis.server";
import { buildSignal, decide } from "./build-signal";
import { logJevCall } from "./jev-log.server";
import { signalQuestions } from "./jev-questions";
import { buildSignalState } from "./jev-state";
import type { TradingMode, TradingSignal } from "@/lib/mock/types";

/**
 * Génération d'un signal par le moteur Jev (TypeSafe AI).
 *
 * Le pipeline tient en quatre étapes, toutes bornées en temps :
 *   1. collecte des données de marché (parallélisée)
 *   2. analyse de structure déterministe (locale, instantanée)
 *   3. UN appel à Jev qui répond aux trois questions de décision
 *   4. construction du signal, niveaux calculés depuis l'ATR
 *
 * Jev est un modèle « System One » : il ne déroule pas de chaîne de
 * raisonnement, il renvoie des probabilités. C'est ce qui permet de tenir un
 * budget de latence — l'approche LLM génératif précédente demandait au modèle
 * de rédiger son analyse, et le raisonnement à lui seul dépassait la minute.
 */

/** Unité de temps de référence selon l'horizon du trade. */
const REFERENCE_TIMEFRAME: Record<TradingMode, Timeframe> = {
  scalping: "15m",
  day_trading: "1h",
  swing: "1d",
};

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export type GeneratedSignal = {
  signal: TradingSignal;
  /** Id de la ligne de journal, à rattacher au signal une fois celui-ci persisté. */
  jevCallId: string | null;
};

export async function generateAiSignal(
  symbol: string,
  mode: TradingMode,
  userId: string | null = null,
): Promise<GeneratedSignal> {
  if (!process.env["TYPESAFE_API_KEY"]) {
    throw new AiGatewayError("Configuration IA manquante (TYPESAFE_API_KEY).", 401);
  }

  const startedAt = Date.now();

  // 80 bougies suffisent à tout ce que calcule analyseStructure (SMA50, ATR14,
  // swings) : au-delà, on allonge la collecte sans rien changer à l'analyse.
  const [quotes, depth, ...candleSets] = await Promise.all([
    fetchQuotes([symbol]),
    fetchDepth(symbol).catch(() => null),
    ...TIMEFRAMES.map((tf) => fetchCandles(symbol, tf, 80)),
  ]);
  const marketMs = Date.now() - startedAt;

  const quote = quotes[0];
  if (!quote?.price) throw new AiGatewayError(`Aucune donnée de marché pour ${symbol}.`, 400);

  const analyses: StructureAnalysis[] = TIMEFRAMES.map((tf, i) =>
    analyseStructure(tf as Timeframe, candleSets[i]!),
  );
  const reference = analyses.find((a) => a.timeframe === REFERENCE_TIMEFRAME[mode]) ?? analyses[0]!;

  const state = buildSignalState(symbol, mode, quote, analyses, reference, depth);
  const questions = signalQuestions(symbol, mode);

  const jevStartedAt = Date.now();
  let response;
  try {
    response = await systemOne({ state, questions });
  } catch (error) {
    if (error instanceof JevError) {
      console.error(
        `[Jev] échec HTTP ${error.status}${error.requestId ? ` (request_id=${error.requestId})` : ""} — ${error.message}`,
      );
      throw new AiGatewayError(error.message, error.status);
    }
    throw new AiGatewayError(`L'analyse a échoué : ${(error as Error).message}`, 500);
  }
  const jevMs = Date.now() - jevStartedAt;

  const decision = decide(response);
  const signal = buildSignal({ symbol, mode, quote, analyses, reference, depth, decision });

  const totalMs = Date.now() - startedAt;
  console.log(
    `[Smartrade] ${symbol} ${mode} — marché ${marketMs}ms, Jev ${jevMs}ms (${response.model}), ` +
      `total ${totalMs}ms → ${decision.direction} ${signal.confidence_score}%` +
      (decision.vetoReason ? ` (veto: ${decision.vetoReason})` : ""),
  );

  const jevCallId = await logJevCall({
    userId,
    symbol,
    mode,
    model: response.model || JEV_MODEL,
    state,
    questions,
    response,
    decision,
    signal,
    latencyMs: jevMs,
  });

  return { signal, jevCallId };
}
