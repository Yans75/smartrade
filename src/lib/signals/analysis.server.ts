import type { Candle } from "@/lib/market/market.server";
import type { Timeframe } from "@/lib/market/symbols";

export type StructureAnalysis = {
  timeframe: Timeframe;
  trend: "haussier" | "baissier" | "range";
  structure: string;
  key_levels: number[];
  fvg_zones: { start: number; end: number; type: "haussier" | "baissier" }[];
  bos_detected: boolean;
  poi_levels: number[];
  atr: number;
  last_close: number;
};

function round(v: number, ref: number) {
  return Number(v.toFixed(ref >= 1000 ? 2 : ref >= 1 ? 4 : 5));
}

function atr(candles: Candle[], period = 14) {
  const slice = candles.slice(-period - 1);
  let sum = 0;
  for (let i = 1; i < slice.length; i++) {
    const c = slice[i]!;
    const prev = slice[i - 1]!;
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  }
  return sum / Math.max(1, slice.length - 1);
}

function swings(candles: Candle[], lookback = 2) {
  const highs: { index: number; price: number }[] = [];
  const lows: { index: number; price: number }[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i]!;
    const window = candles.slice(i - lookback, i + lookback + 1);
    if (window.every((w) => w.high <= c.high)) highs.push({ index: i, price: c.high });
    if (window.every((w) => w.low >= c.low)) lows.push({ index: i, price: c.low });
  }
  return { highs, lows };
}

/** Fair Value Gaps: 3-candle imbalance (ICT). */
function fairValueGaps(candles: Candle[]) {
  const zones: { start: number; end: number; type: "haussier" | "baissier" }[] = [];
  for (let i = 2; i < candles.length; i++) {
    const a = candles[i - 2]!;
    const c = candles[i]!;
    if (c.low > a.high) zones.push({ start: a.high, end: c.low, type: "haussier" });
    else if (c.high < a.low) zones.push({ start: c.high, end: a.low, type: "baissier" });
  }
  return zones.slice(-3);
}

export function analyseStructure(timeframe: Timeframe, candles: Candle[]): StructureAnalysis {
  const last = candles.at(-1)!;
  const ref = last.close;
  const { highs, lows } = swings(candles);
  const lastHigh = highs.at(-1)?.price ?? last.high;
  const lastLow = lows.at(-1)?.price ?? last.low;
  const prevHigh = highs.at(-2)?.price ?? lastHigh;
  const prevLow = lows.at(-2)?.price ?? lastLow;

  const bullishBos = lastHigh > prevHigh && last.close > prevHigh;
  const bearishBos = lastLow < prevLow && last.close < prevLow;
  const sma20 = candles.slice(-20).reduce((a, c) => a + c.close, 0) / Math.min(20, candles.length);
  const sma50 = candles.slice(-50).reduce((a, c) => a + c.close, 0) / Math.min(50, candles.length);

  const trend: StructureAnalysis["trend"] =
    bullishBos && sma20 > sma50 ? "haussier" : bearishBos && sma20 < sma50 ? "baissier" : "range";

  const structure = bullishBos
    ? "BOS haussier confirmé : le dernier sommet structurel a été cassé en clôture"
    : bearishBos
      ? "BOS baissier confirmé : cassure du dernier plus bas structurel"
      : "Structure en range entre les derniers sommets et plus bas non balayés";

  return {
    timeframe,
    trend,
    structure,
    key_levels: [round(lastLow, ref), round(lastHigh, ref)],
    fvg_zones: fairValueGaps(candles).map((z) => ({
      start: round(z.start, ref),
      end: round(z.end, ref),
      type: z.type,
    })),
    bos_detected: bullishBos || bearishBos,
    poi_levels: [round(prevLow, ref), round(prevHigh, ref)],
    atr: round(atr(candles), ref),
    last_close: round(last.close, ref),
  };
}
