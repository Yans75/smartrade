import type { TradingSignal } from "@/lib/mock/types";

const round = (n: number) => Number(n.toFixed(2));

export type DetailedStats = {
  total_signals: number;
  win_rate: number;
  total_pnl: number;
  avg_confidence: number;
  tp_hits: number;
  sl_hits: number;
  best: TradingSignal | null;
  worst: TradingSignal | null;
  by_symbol: { symbol: string; trades: number; win_rate: number; pnl: number }[];
  by_mode: { mode: string; trades: number; win_rate: number; pnl: number }[];
};

function group(signals: TradingSignal[], key: (s: TradingSignal) => string) {
  const map = new Map<string, TradingSignal[]>();
  for (const s of signals) {
    const k = key(s);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.entries()].map(([name, rows]) => {
    const closed = rows.filter((r) => r.pnl_percent !== null);
    const wins = closed.filter((r) => (r.pnl_percent ?? 0) > 0).length;
    return {
      name,
      trades: rows.length,
      win_rate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
      pnl: round(closed.reduce((a, r) => a + (r.pnl_percent ?? 0), 0)),
    };
  });
}

/** Derives every performance metric shown on the stats page from real signals. */
export function buildDetailedStats(signals: TradingSignal[]): DetailedStats {
  const closed = signals.filter((s) => s.pnl_percent !== null);
  const wins = closed.filter((s) => (s.pnl_percent ?? 0) > 0).length;
  const sorted = [...closed].sort((a, b) => (b.pnl_percent ?? 0) - (a.pnl_percent ?? 0));
  return {
    total_signals: signals.length,
    win_rate: closed.length ? Number(((wins / closed.length) * 100).toFixed(1)) : 0,
    total_pnl: round(closed.reduce((a, s) => a + (s.pnl_percent ?? 0), 0)),
    avg_confidence: signals.length
      ? Math.round(signals.reduce((a, s) => a + s.confidence_score, 0) / signals.length)
      : 0,
    tp_hits: signals.filter((s) => s.status.startsWith("tp")).length,
    sl_hits: signals.filter((s) => s.status === "sl_hit").length,
    best: sorted[0] ?? null,
    worst: sorted.at(-1) ?? null,
    by_symbol: group(signals, (s) => s.symbol)
      .map(({ name, ...rest }) => ({ symbol: name, ...rest }))
      .sort((a, b) => b.trades - a.trades),
    by_mode: group(signals, (s) => s.trading_mode.replace("_", " ")).map(({ name, ...rest }) => ({
      mode: name,
      ...rest,
    })),
  };
}

/** Cumulative PnL curve, oldest first. */
export function buildPnlCurve(signals: TradingSignal[]) {
  let cumulative = 0;
  return [...signals]
    .filter((s) => s.pnl_percent !== null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((s) => {
      cumulative = round(cumulative + (s.pnl_percent ?? 0));
      return { date: new Date(s.created_at).toLocaleDateString("fr-FR"), pnl: cumulative };
    });
}
