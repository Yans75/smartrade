import type { Answer, SystemOneResponse } from "@/lib/jev/client.server";
import type { Depth, Quote } from "@/lib/market/market.server";
import { roundTo } from "@/lib/market/symbols";
import type { Direction, TradingMode, TradingSignal } from "@/lib/mock/types";
import type { StructureAnalysis } from "./analysis.server";
import { SETUP_QUALITY_MAX } from "./jev-questions";
import { buildLevels, checkLevels } from "./validate";

/**
 * Traduit les réponses de Jev en signal exploitable.
 *
 * Répartition des rôles, volontairement étanche :
 *   - Jev décide  : sens, qualité du setup, moment d'entrée.
 *   - Le code calcule : entrée, stop, take profits, à partir de l'ATR.
 *
 * Aucun prix ne transite par le modèle, donc aucun prix ne peut être halluciné.
 * C'est l'inverse de l'approche LLM génératif précédente, où chaque niveau
 * sortait du texte du modèle et devait être rattrapé après coup.
 */

/** En dessous de « setup correct », on ne propose pas de trade. */
const MIN_SETUP_QUALITY = 1.5;
/** Un sens retenu à moins de 45 % de probabilité est un pile ou face. */
const MIN_DIRECTION_PROBABILITY = 0.45;
/** Fenêtre, en ATR, dans laquelle un FVG est une entrée en repli crédible. */
const PULLBACK_MIN_ATR = 0.2;
const PULLBACK_MAX_ATR = 1.5;

export type JevDecision = {
  direction: Direction;
  /** Probabilité du sens retenu, telle que renvoyée par Jev (0-1). */
  directionProbability: number;
  probabilities: Record<string, number>;
  setupQuality: number;
  setupConfidence: number;
  entryTiming: "immediate" | "pullback" | "wait";
  /** Raison d'un passage forcé en NEUTRAL, si c'est le cas. */
  vetoReason: string | null;
};

function asChoice(answer: Answer | undefined) {
  return answer?.type === "choice" ? answer : null;
}
function asScore(answer: Answer | undefined) {
  return answer?.type === "score" ? answer : null;
}

/**
 * Applique les garde-fous sur la sortie brute de Jev.
 *
 * Jev répond toujours — y compris quand il est très incertain. Un sens choisi
 * à 38 % de probabilité reste le plus probable des trois, ce n'est pas pour
 * autant un trade. Ces seuils sont la traduction de « ne pas forcer un trade
 * médiocre » en règle exécutable.
 */
export function decide(response: SystemOneResponse): JevDecision {
  const directionAnswer = asChoice(response.answers["direction"]);
  const qualityAnswer = asScore(response.answers["setup_quality"]);
  const timingAnswer = asChoice(response.answers["entry_timing"]);

  const rawDirection = directionAnswer?.choice;
  const direction: Direction =
    rawDirection === "BUY" || rawDirection === "SELL" || rawDirection === "NEUTRAL"
      ? rawDirection
      : "NEUTRAL";

  const probabilities = directionAnswer?.probabilities ?? {};
  const directionProbability = probabilities[direction] ?? directionAnswer?.confidence ?? 0;
  const setupQuality = qualityAnswer?.score ?? 0;
  const setupConfidence = qualityAnswer?.confidence ?? 0;

  const rawTiming = timingAnswer?.choice;
  const entryTiming =
    rawTiming === "immediate" || rawTiming === "pullback" || rawTiming === "wait"
      ? rawTiming
      : "immediate";

  let vetoReason: string | null = null;
  if (direction !== "NEUTRAL") {
    if (setupQuality < MIN_SETUP_QUALITY) {
      vetoReason = `qualité du setup insuffisante (${setupQuality.toFixed(1)}/${SETUP_QUALITY_MAX})`;
    } else if (directionProbability < MIN_DIRECTION_PROBABILITY) {
      vetoReason = `sens trop incertain (${Math.round(directionProbability * 100)} % de probabilité)`;
    } else if (entryTiming === "wait") {
      vetoReason = "Jev recommande d'attendre une nouvelle confirmation";
    }
  }

  return {
    direction: vetoReason ? "NEUTRAL" : direction,
    directionProbability,
    probabilities,
    setupQuality,
    setupConfidence,
    entryTiming,
    vetoReason,
  };
}

/**
 * Confiance affichée : la probabilité calibrée du sens, modulée par la qualité
 * du setup. Un sens très probable sur un setup médiocre ne mérite pas 90 %,
 * et la qualité seule ne dit rien du sens — d'où le produit des deux.
 */
function confidenceScore(decision: JevDecision): number {
  const quality = Math.min(1, Math.max(0, decision.setupQuality / SETUP_QUALITY_MAX));
  const raw = decision.directionProbability * (0.5 + 0.5 * quality);
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

/**
 * Entrée en repli : cherche le FVG le plus proche qui joue dans le sens du
 * trade, à une distance crédible. Sans candidat, on entre au prix courant
 * plutôt que de placer une entrée arbitraire que le marché n'atteindra pas.
 */
function pullbackEntry(
  direction: "BUY" | "SELL",
  price: number,
  atr: number,
  analyses: StructureAnalysis[],
): { entry: number; zone: string } | null {
  if (!Number.isFinite(atr) || atr <= 0) return null;
  const wanted = direction === "BUY" ? "haussier" : "baissier";

  const candidates = analyses.flatMap((a) =>
    a.fvg_zones
      .filter((z) => z.type === wanted)
      .map((z) => {
        // Pour un achat on veut revenir sur le haut du FVG situé sous le prix ;
        // pour une vente, sur le bas du FVG situé au-dessus.
        const edge = direction === "BUY" ? Math.max(z.start, z.end) : Math.min(z.start, z.end);
        const distance = direction === "BUY" ? price - edge : edge - price;
        return { edge, distanceAtr: distance / atr, timeframe: a.timeframe };
      })
      .filter((c) => c.distanceAtr >= PULLBACK_MIN_ATR && c.distanceAtr <= PULLBACK_MAX_ATR),
  );

  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => (a.distanceAtr <= b.distanceAtr ? a : b));
  return { entry: best.edge, zone: `FVG ${wanted} ${best.timeframe}` };
}

function orderFlow(decision: JevDecision, depth: Depth | null) {
  const real = depth?.source === "binance";
  const imbalance = depth?.imbalance ?? 0;
  const aligned =
    decision.direction === "BUY"
      ? imbalance > 0
      : decision.direction === "SELL"
        ? imbalance < 0
        : false;
  const magnitude = Math.abs(imbalance);

  // Un proxy volumétrique ne vaut pas un carnet réel : sa force est plafonnée
  // à « faible » pour qu'il ne pèse pas comme une mesure directe.
  const strength: "fort" | "moyen" | "faible" = !real
    ? "faible"
    : magnitude >= 20
      ? "fort"
      : magnitude >= 8
        ? "moyen"
        : "faible";

  const observation = !depth
    ? "Carnet d'ordres indisponible sur cet instrument : la décision repose uniquement sur la structure."
    : real
      ? `Carnet réel : imbalance ${imbalance > 0 ? "+" : ""}${imbalance} % (${imbalance > 0 ? "pression acheteuse" : "pression vendeuse"}), ${aligned ? "cohérente avec" : "contraire à"} la direction retenue.`
      : `Pas de carnet réel : proxy volumétrique à ${imbalance > 0 ? "+" : ""}${imbalance} %. Indicatif seulement, ce n'est pas de l'order flow.`;

  return { confirms_direction: aligned, strength, key_observation: observation };
}

/** Narration en français, construite à partir des faits — jamais générée. */
function narrate(
  decision: JevDecision,
  reference: StructureAnalysis,
  analyses: StructureAnalysis[],
  zone: string | null,
) {
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const aligned = analyses.filter((a) => a.trend === reference.trend).length;

  if (decision.direction === "NEUTRAL") {
    const reasoning = decision.vetoReason
      ? `Aucun trade retenu : ${decision.vetoReason}. Sur ${reference.timeframe}, ${reference.structure.toLowerCase()}.`
      : `Aucune configuration exploitable sur ${reference.timeframe} : ${reference.structure.toLowerCase()}. Jev évalue la qualité du setup à ${decision.setupQuality.toFixed(1)}/${SETUP_QUALITY_MAX}.`;
    return {
      reasoning,
      position_advice:
        "Rester à l'écart et attendre une structure plus nette avant d'engager du capital.",
    };
  }

  const sens = decision.direction === "BUY" ? "acheteuse" : "vendeuse";
  const reasoning =
    `Jev retient une position ${sens} à ${pct(decision.directionProbability)} de probabilité, ` +
    `sur un setup noté ${decision.setupQuality.toFixed(1)}/${SETUP_QUALITY_MAX}. ` +
    `Unité de référence ${reference.timeframe} : ${reference.structure.toLowerCase()}, tendance ${reference.trend}, ` +
    `${aligned}/${analyses.length} unités de temps alignées.`;

  const position_advice =
    decision.entryTiming === "pullback" && zone
      ? `Entrée sur repli dans le ${zone} plutôt qu'au prix du marché : l'ordre n'est déclenché que si le prix revient sur la zone.`
      : `Entrée au prix du marché. Risquer au maximum 1 % du capital sur ce trade et remonter le stop à l'entrée dès le TP1 atteint.`;

  return { reasoning, position_advice };
}

export type BuildSignalInput = {
  symbol: string;
  mode: TradingMode;
  quote: Quote;
  analyses: StructureAnalysis[];
  reference: StructureAnalysis;
  depth: Depth | null;
  decision: JevDecision;
};

export function buildSignal({
  symbol,
  mode,
  quote,
  analyses,
  reference,
  depth,
  decision,
}: BuildSignalInput): TradingSignal {
  const price = quote.price;
  const atr = reference.atr;

  let entry = price;
  let zone: string | null = null;
  if (decision.direction !== "NEUTRAL" && decision.entryTiming === "pullback") {
    const pullback = pullbackEntry(decision.direction, price, atr, analyses);
    if (pullback) {
      entry = pullback.entry;
      zone = pullback.zone;
    }
  }

  // NEUTRAL n'a pas de trade à exécuter : on renvoie le prix courant partout
  // plutôt que des niveaux qui laisseraient croire à une position à prendre.
  const levels =
    decision.direction === "NEUTRAL"
      ? {
          entry_price: price,
          stop_loss: price,
          take_profit_1: price,
          take_profit_2: price,
          take_profit_3: price,
        }
      : buildLevels(decision.direction, entry, atr, price, mode);

  // Filet final : les niveaux sont construits de façon cohérente par
  // buildLevels, mais un ATR dégénéré sur un instrument peu liquide peut
  // encore produire une géométrie absurde.
  const checked = checkLevels(levels, decision.direction, price, atr, mode);
  const { reasoning, position_advice } = narrate(decision, reference, analyses, zone);

  const warning =
    decision.setupConfidence > 0 && decision.setupConfidence < 0.6
      ? `Jev est lui-même peu sûr de son évaluation (confiance ${Math.round(decision.setupConfidence * 100)} %) : traiter ce signal avec prudence.`
      : checked.corrected
        ? `Niveaux recalculés automatiquement (${checked.reason}).`
        : null;

  return {
    id: `sig-${symbol}-${Date.now()}`,
    symbol,
    direction: decision.direction,
    entry_price: roundTo(checked.levels.entry_price, price),
    stop_loss: roundTo(checked.levels.stop_loss, price),
    take_profit_1: roundTo(checked.levels.take_profit_1, price),
    take_profit_2: roundTo(checked.levels.take_profit_2, price),
    take_profit_3: roundTo(checked.levels.take_profit_3, price),
    confidence_score: confidenceScore(decision),
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
    reasoning,
    position_advice,
    market_warning: warning,
    order_flow_confirmation: orderFlow(decision, depth),
    status: "active",
    pnl_percent: null,
    closed_at: null,
    closed_price: null,
    created_at: new Date().toISOString(),
  };
}
