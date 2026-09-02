import type { Direction, TradingMode } from "@/lib/mock/types";

export type Levels = {
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3: number;
};

export type LevelCheck = {
  levels: Levels;
  /** True when the model output was incoherent and had to be rebuilt. */
  corrected: boolean;
  reason: string | null;
};

/** Risk distance expressed in ATR, per horizon. */
const SL_ATR: Record<TradingMode, number> = { scalping: 0.8, day_trading: 1.2, swing: 1.8 };
/** Take profits as R multiples of the entry-to-stop distance. */
const R_MULTIPLES = [1.2, 2, 3];
/** An entry further than this (in ATR) from spot is not executable. */
const MAX_ENTRY_DRIFT_ATR = 1.5;
/** Acceptable stop distance, in ATR, before the placement is considered absurd. */
const MIN_RISK_ATR = 0.25;
const MAX_RISK_ATR = 4;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Falls back to a fraction of price when ATR is missing or degenerate. */
function riskUnit(atr: number, price: number) {
  return finite(atr) && atr > price * 0.0001 ? atr : price * 0.004;
}

function rebuild(
  direction: "BUY" | "SELL",
  entry: number,
  unit: number,
  mode: TradingMode,
): Levels {
  const risk = unit * SL_ATR[mode];
  const sign = direction === "BUY" ? 1 : -1;
  return {
    entry_price: entry,
    stop_loss: entry - sign * risk,
    take_profit_1: entry + sign * risk * R_MULTIPLES[0]!,
    take_profit_2: entry + sign * risk * R_MULTIPLES[1]!,
    take_profit_3: entry + sign * risk * R_MULTIPLES[2]!,
  };
}

function ordered(direction: "BUY" | "SELL", l: Levels) {
  const seq =
    direction === "BUY"
      ? [l.stop_loss, l.entry_price, l.take_profit_1, l.take_profit_2, l.take_profit_3]
      : [l.take_profit_3, l.take_profit_2, l.take_profit_1, l.entry_price, l.stop_loss];
  return seq.every((v, i) => i === 0 || v > seq[i - 1]!);
}

/**
 * Deterministic safety net over the AI output. The prompt asks for coherent
 * levels but nothing guarantees them, so an incoherent set (inverted stop,
 * unreachable entry, absurd risk) is rebuilt from spot price and ATR rather
 * than served to a user who would trade it.
 */
export function checkLevels(
  raw: Levels,
  direction: Direction,
  price: number,
  atr: number,
  mode: TradingMode,
): LevelCheck {
  const unit = riskUnit(atr, price);

  if (direction === "NEUTRAL") {
    // Nothing to execute: keep the model's view, only replace unusable numbers.
    const safe = (v: number) => (finite(v) ? v : price);
    return {
      levels: {
        entry_price: safe(raw.entry_price),
        stop_loss: safe(raw.stop_loss),
        take_profit_1: safe(raw.take_profit_1),
        take_profit_2: safe(raw.take_profit_2),
        take_profit_3: safe(raw.take_profit_3),
      },
      corrected: false,
      reason: null,
    };
  }

  const values = [
    raw.entry_price,
    raw.stop_loss,
    raw.take_profit_1,
    raw.take_profit_2,
    raw.take_profit_3,
  ];
  if (!values.every(finite)) {
    return {
      levels: rebuild(direction, price, unit, mode),
      corrected: true,
      reason: "niveaux non exploitables renvoyés par le modèle",
    };
  }

  const drift = Math.abs(raw.entry_price - price);
  const entryOff = drift > unit * MAX_ENTRY_DRIFT_ATR;
  const entry = entryOff ? price : raw.entry_price;

  const risk = Math.abs(entry - raw.stop_loss);
  const riskOff = risk < unit * MIN_RISK_ATR || risk > unit * MAX_RISK_ATR;
  const orderOff = !ordered(direction, { ...raw, entry_price: entry });
  const rrOff = Math.abs(raw.take_profit_1 - entry) < risk;

  if (!entryOff && !riskOff && !orderOff && !rrOff) {
    return { levels: { ...raw, entry_price: entry }, corrected: false, reason: null };
  }

  const reason = [
    entryOff ? "entrée trop éloignée du prix courant" : null,
    orderOff ? "ordre entrée / stop / take profits incohérent" : null,
    riskOff ? "distance de stop hors norme" : null,
    rrOff && !orderOff ? "ratio R:R du TP1 insuffisant" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return { levels: rebuild(direction, entry, unit, mode), corrected: true, reason };
}
