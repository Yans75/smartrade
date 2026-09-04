import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createDeepSeekProvider, SIGNAL_MODEL } from "@/lib/ai-gateway.server";
import { fetchCandles, fetchDepth, fetchQuotes } from "@/lib/market/market.server";
import { TIMEFRAMES, roundTo, type Timeframe } from "@/lib/market/symbols";
import { analyseStructure, type StructureAnalysis } from "./analysis.server";
import { checkLevels } from "./validate";
import type { TradingMode, TradingSignal } from "@/lib/mock/types";

const AiSignal = z.object({
  direction: z.enum(["BUY", "SELL", "NEUTRAL"]),
  entry_price: z.number(),
  stop_loss: z.number(),
  take_profit_1: z.number(),
  take_profit_2: z.number(),
  take_profit_3: z.number(),
  confidence_score: z.number(),
  reasoning: z.string(),
  position_advice: z.string(),
  market_warning: z.string().nullable(),
  order_flow_confirms: z.boolean(),
  order_flow_strength: z.enum(["fort", "moyen", "faible"]),
  order_flow_observation: z.string(),
});

/** Mirrors SL_ATR in validate.ts, for the message shown to the user. */
const SL_ATR_LABEL: Record<TradingMode, string> = {
  scalping: "0.8 ATR",
  day_trading: "1.2 ATR",
  swing: "1.8 ATR",
};

const MODE_LABEL: Record<TradingMode, string> = {
  scalping: "scalping (horizon quelques minutes, risque serré)",
  day_trading: "day trading (horizon intraday)",
  swing: "swing (horizon plusieurs jours)",
};

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function statusOf(error: unknown): number | null {
  const candidate = error as { statusCode?: number; status?: number; cause?: unknown };
  if (typeof candidate?.statusCode === "number") return candidate.statusCode;
  if (typeof candidate?.status === "number") return candidate.status;
  if (candidate?.cause) return statusOf(candidate.cause);
  return null;
}

function messageFor(status: number, raw: string) {
  if (status === 402)
    return "Crédits DeepSeek épuisés. Rechargez votre compte DeepSeek pour relancer l'analyse.";
  if (status === 403) return "L'accès à l'API DeepSeek est refusé (clé invalide ou restreinte).";
  if (status === 429)
    return "Trop de requêtes IA en peu de temps. Réessayez dans quelques secondes.";
  if (status === 401) return "Clé API DeepSeek invalide ou manquante.";
  return raw || "L'analyse IA a échoué.";
}

export async function generateAiSignal(symbol: string, mode: TradingMode): Promise<TradingSignal> {
  const key = process.env["DEEPSEEK_API_KEY"];
  if (!key) throw new AiGatewayError("Configuration IA manquante (DEEPSEEK_API_KEY).", 401);
  if (!SIGNAL_MODEL)
    throw new AiGatewayError(
      "Configuration IA manquante (DEEPSEEK_MODEL) : indiquez l'id exact du modèle DeepSeek à utiliser.",
      401,
    );

  const [quotes, depth, ...candleSets] = await Promise.all([
    fetchQuotes([symbol]),
    fetchDepth(symbol).catch(() => null),
    ...TIMEFRAMES.map((tf) => fetchCandles(symbol, tf, 150)),
  ]);

  const quote = quotes[0];
  if (!quote?.price) throw new AiGatewayError(`Aucune donnée de marché pour ${symbol}.`, 400);

  const analyses: StructureAnalysis[] = TIMEFRAMES.map((tf, i) =>
    analyseStructure(tf as Timeframe, candleSets[i]!),
  );
  const reference = analyses.find(
    (a) => a.timeframe === (mode === "swing" ? "1d" : mode === "scalping" ? "15m" : "1h"),
  )!;

  const gateway = createDeepSeekProvider(key);
  const prompt = [
    `Tu es un analyste de marché senior spécialisé ICT / Smart Money Concepts et Order Flow.`,
    `Analyse ${symbol} pour un trade en ${MODE_LABEL[mode]}.`,
    `Prix actuel : ${quote.price} (variation 24h : ${quote.change_24h}%).`,
    `ATR de référence (${reference.timeframe}) : ${reference.atr}.`,
    ``,
    `Structure multi-timeframe calculée sur les vraies bougies :`,
    ...analyses.map(
      (a) =>
        `- ${a.timeframe} : tendance ${a.trend}, ${a.structure}. Niveaux clés ${a.key_levels.join(" / ")}, POI ${a.poi_levels.join(" / ")}, FVG ${
          a.fvg_zones.map((z) => `${z.start}-${z.end} (${z.type})`).join(", ") || "aucun"
        }.`,
    ),
    depth?.source === "binance"
      ? `Carnet d'ordres réel (Binance/OKX, 100 niveaux) : imbalance ${depth.imbalance}% (positif = pression acheteuse).`
      : depth
        ? `Pas de carnet d'ordres sur cet instrument : proxy volumétrique calculé sur 40 bougies 15m, imbalance ${depth.imbalance}%. Ce n'est PAS de l'order flow réel — n'en fais pas un argument fort et pondère la confiance en conséquence.`
        : `Carnet d'ordres indisponible.`,
    ``,
    `Donne un signal exploitable : entrée réaliste proche du prix actuel, stop loss placé derrière un niveau invalidant la structure, et 3 take profits croissants en R:R (au moins 1.2R, 2R, 3R).`,
    `Le stop et les TP doivent être cohérents avec la direction (pour un BUY : stop < entrée < TP1 < TP2 < TP3).`,
    `confidence_score : entier 0-100. Tous les textes en français, 3 à 6 phrases pour reasoning.`,
    `Si aucune configuration n'est valable, renvoie direction NEUTRAL avec une confiance faible.`,
    // DeepSeek (comme l'API OpenAI qu'il imite) exige que le prompt
    // mentionne explicitement "JSON" pour accepter response_format:
    // {type: "json_object"} — sinon il renvoie une erreur 400.
    `Réponds uniquement avec un objet JSON valide respectant exactement le schéma demandé, sans texte hors JSON.`,
  ].join("\n");

  let output: z.infer<typeof AiSignal>;
  try {
    const result = await generateText({
      model: gateway(SIGNAL_MODEL),
      output: Output.object({ schema: AiSignal }),
      prompt,
    });
    output = result.output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      // Sortie brute du modèle : seul moyen de voir pourquoi le parsing a
      // échoué (markdown autour du JSON, champ manquant, enum invalide...).
      // Visible dans les logs du Worker (Cloudflare dashboard > Workers >
      // smartrade > Logs), pas renvoyé au client.
      console.error("[DeepSeek] NoObjectGeneratedError — texte brut reçu:", error.text);
      console.error("[DeepSeek] cause:", error.cause);
      throw new AiGatewayError("L'IA n'a pas renvoyé une analyse exploitable. Réessayez.", 502);
    }
    const status = statusOf(error) ?? 500;
    throw new AiGatewayError(messageFor(status, (error as Error).message), status);
  }

  const ref = quote.price;

  // The model is asked for coherent levels but nothing guarantees them: an
  // inverted stop or an unreachable entry must never reach a user's platform.
  const checked = checkLevels(
    {
      entry_price: output.entry_price,
      stop_loss: output.stop_loss,
      take_profit_1: output.take_profit_1,
      take_profit_2: output.take_profit_2,
      take_profit_3: output.take_profit_3,
    },
    output.direction,
    ref,
    reference.atr,
    mode,
  );
  const warning = checked.corrected
    ? `Niveaux recalculés automatiquement (${checked.reason}) : entrée au prix courant, stop à ${SL_ATR_LABEL[mode]} et take profits en 1.2R / 2R / 3R.${
        output.market_warning ? ` ${output.market_warning}` : ""
      }`
    : output.market_warning;
  const confidence = Math.max(0, Math.min(100, Math.round(output.confidence_score)));

  return {
    id: `sig-${symbol}-${Date.now()}`,
    symbol,
    direction: output.direction,
    entry_price: roundTo(checked.levels.entry_price, ref),
    stop_loss: roundTo(checked.levels.stop_loss, ref),
    take_profit_1: roundTo(checked.levels.take_profit_1, ref),
    take_profit_2: roundTo(checked.levels.take_profit_2, ref),
    take_profit_3: roundTo(checked.levels.take_profit_3, ref),
    // A rebuilt setup is not the setup the model scored: cap the confidence.
    confidence_score: checked.corrected ? Math.min(confidence, 55) : confidence,
    trading_mode: mode,
    strategy: "ict_smc",
    timeframe_analysis: analyses.map((a) => ({
      timeframe: a.timeframe,
      trend: a.trend,
      structure: a.structure,
      key_levels: a.key_levels,
      fvg_zones: a.fvg_zones,
      bos_detected: a.bos_detected,
      poi_levels: a.poi_levels,
    })),
    reasoning: output.reasoning,
    position_advice: output.position_advice,
    market_warning: warning,
    order_flow_confirmation: {
      confirms_direction: output.order_flow_confirms,
      strength: output.order_flow_strength,
      key_observation: output.order_flow_observation,
    },
    status: "active",
    pnl_percent: null,
    closed_at: null,
    closed_price: null,
    created_at: new Date().toISOString(),
  };
}
