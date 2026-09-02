import { fetchCandles, fetchQuotes, type Candle } from "@/lib/market/market.server";
import type { Timeframe } from "@/lib/market/symbols";
import type { Direction, SignalStatus, TradingMode } from "@/lib/mock/types";

export type TrackableSignal = {
  id: string;
  symbol: string;
  direction: Direction;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3: number;
  trading_mode: TradingMode;
  status: SignalStatus;
  created_at: string;
};

export type Outcome = {
  id: string;
  status: SignalStatus;
  /** Null while the position is still running (a TP was reached, TP3 was not). */
  closed_price: number | null;
  closed_at: string | null;
  pnl_percent: number | null;
};

/** Candles fine enough to catch a wick without pulling months of history. */
const TRACK_TF: Record<TradingMode, Timeframe> = {
  scalping: "15m",
  day_trading: "15m",
  swing: "1h",
};

/** Past this age an unresolved signal is closed at market: a stale idea is not a live one. */
const MAX_AGE_MS: Record<TradingMode, number> = {
  scalping: 6 * 3_600_000,
  day_trading: 36 * 3_600_000,
  swing: 10 * 24 * 3_600_000,
};

const TP_STATUS: SignalStatus[] = ["active", "tp1_hit", "tp2_hit", "tp3_hit"];

function pnl(direction: Direction, entry: number, exit: number) {
  if (!entry) return 0;
  const raw = ((exit - entry) / entry) * 100;
  return Number((direction === "SELL" ? -raw : raw).toFixed(2));
}

/** How many take profits the candle reached, 0 to 3. */
function tpsReached(signal: TrackableSignal, candle: Candle) {
  const targets = [signal.take_profit_1, signal.take_profit_2, signal.take_profit_3];
  const extreme = signal.direction === "BUY" ? candle.high : candle.low;
  let count = 0;
  for (const tp of targets) {
    const hit = signal.direction === "BUY" ? extreme >= tp : extreme <= tp;
    if (!hit) break;
    count++;
  }
  return count;
}

function tpPrice(signal: TrackableSignal, level: number) {
  return [signal.take_profit_1, signal.take_profit_2, signal.take_profit_3][level - 1]!;
}

/**
 * Replays the candles printed since the signal was issued and decides its fate.
 *
 * Intra-candle ordering is unknowable on OHLC data, so the stop wins whenever
 * both sides are touched inside the same candle: over-reporting wins on a
 * public track record would be the worse error.
 */
export function resolveOutcome(
  signal: TrackableSignal,
  candles: Candle[],
  lastPrice: number | null,
  now = Date.now(),
): Outcome | null {
  if (signal.direction === "NEUTRAL") return null;

  const created = Date.parse(signal.created_at);
  const closedAt = () => new Date(now).toISOString();
  const relevant = candles.filter((c) => c.time >= created);

  let reached = TP_STATUS.indexOf(signal.status);
  if (reached < 0) reached = 0;

  for (const candle of relevant) {
    const stopHit =
      signal.direction === "BUY" ? candle.low <= signal.stop_loss : candle.high >= signal.stop_loss;

    if (stopHit) {
      // A target banked in an earlier candle would already have been taken.
      const exit = reached > 0 ? tpPrice(signal, reached) : signal.stop_loss;
      const status: SignalStatus = reached > 0 ? TP_STATUS[reached]! : "sl_hit";
      return {
        id: signal.id,
        status,
        closed_price: exit,
        closed_at: closedAt(),
        pnl_percent: pnl(signal.direction, signal.entry_price, exit),
      };
    }

    reached = Math.max(reached, tpsReached(signal, candle));
    if (reached === 3) {
      return {
        id: signal.id,
        status: "tp3_hit",
        closed_price: signal.take_profit_3,
        closed_at: closedAt(),
        pnl_percent: pnl(signal.direction, signal.entry_price, signal.take_profit_3),
      };
    }
  }

  if (now - created > MAX_AGE_MS[signal.trading_mode]) {
    const exit = lastPrice ?? candles.at(-1)?.close ?? signal.entry_price;
    return {
      id: signal.id,
      status: "cancelled",
      closed_price: exit,
      closed_at: closedAt(),
      pnl_percent: pnl(signal.direction, signal.entry_price, exit),
    };
  }

  // Still running: only record the progress when a new target was reached.
  const status = TP_STATUS[reached]!;
  if (status === signal.status) return null;
  return { id: signal.id, status, closed_price: null, closed_at: null, pnl_percent: null };
}

/** Candles and last price for every symbol carrying an open signal. */
export async function fetchTrackingData(signals: TrackableSignal[]) {
  const keys = [...new Set(signals.map((s) => `${s.symbol}|${TRACK_TF[s.trading_mode]}`))];
  const symbols = [...new Set(signals.map((s) => s.symbol))];

  const [candleSets, quotes] = await Promise.all([
    Promise.all(
      keys.map(async (key) => {
        const [symbol, tf] = key.split("|") as [string, Timeframe];
        return [key, await fetchCandles(symbol, tf, 300).catch(() => [] as Candle[])] as const;
      }),
    ),
    fetchQuotes(symbols).catch(() => []),
  ]);

  return {
    candles: new Map(candleSets),
    prices: new Map(quotes.map((q) => [q.symbol, q.price])),
  };
}

/** Outcomes for every open signal, ready to be persisted. */
export async function resolveSignals(signals: TrackableSignal[]): Promise<Outcome[]> {
  if (signals.length === 0) return [];
  const { candles, prices } = await fetchTrackingData(signals);
  return signals
    .map((s) =>
      resolveOutcome(
        s,
        candles.get(`${s.symbol}|${TRACK_TF[s.trading_mode]}`) ?? [],
        prices.get(s.symbol) ?? null,
      ),
    )
    .filter((o): o is Outcome => o !== null);
}
