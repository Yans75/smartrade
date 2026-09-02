import type {
  Direction,
  OrderFlowConfirmation,
  SignalStatus,
  TimeframeAnalysis,
  TradingMode,
  TradingSignal,
} from "@/lib/mock/types";

export type SignalRow = {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number | string;
  stop_loss: number | string;
  take_profit_1: number | string;
  take_profit_2: number | string;
  take_profit_3: number | string;
  confidence_score: number;
  trading_mode: string;
  strategy: string;
  timeframe_analysis: unknown;
  order_flow_confirmation: unknown;
  reasoning: string | null;
  position_advice: string | null;
  market_warning: string | null;
  status: string;
  pnl_percent: number | string | null;
  closed_price: number | string | null;
  closed_at: string | null;
  created_at: string;
};

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined ? 0 : Number(v);

/** Database row -> UI signal shape. */
export function rowToSignal(row: SignalRow): TradingSignal {
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction as Direction,
    entry_price: num(row.entry_price),
    stop_loss: num(row.stop_loss),
    take_profit_1: num(row.take_profit_1),
    take_profit_2: num(row.take_profit_2),
    take_profit_3: num(row.take_profit_3),
    confidence_score: row.confidence_score,
    trading_mode: row.trading_mode as TradingMode,
    strategy: row.strategy,
    timeframe_analysis: (Array.isArray(row.timeframe_analysis)
      ? row.timeframe_analysis
      : []) as TimeframeAnalysis[],
    reasoning: row.reasoning ?? "",
    position_advice: row.position_advice ?? "",
    market_warning: row.market_warning,
    order_flow_confirmation: (row.order_flow_confirmation ?? {
      confirms_direction: false,
      strength: "faible",
      key_observation: "",
    }) as OrderFlowConfirmation,
    status: row.status as SignalStatus,
    pnl_percent: row.pnl_percent === null ? null : num(row.pnl_percent),
    closed_at: row.closed_at,
    closed_price: row.closed_price === null ? null : num(row.closed_price),
    created_at: row.created_at,
  };
}

export type SignalStats = {
  total_signals: number;
  closed_signals: number;
  win_rate: number;
  total_pnl: number;
  avg_confidence: number;
  tp_hits: number;
  sl_hits: number;
  active_signals: number;
};

export function computeStats(signals: TradingSignal[]): SignalStats {
  // A signal counts as closed once the tracker settled it, which is exactly
  // when a PnL exists. A "tp1_hit" position still running is not closed yet.
  const closed = signals.filter((s) => s.pnl_percent !== null);
  const wins = closed.filter((s) => (s.pnl_percent ?? 0) > 0).length;
  const totalPnl = closed.reduce((a, s) => a + (s.pnl_percent ?? 0), 0);
  const avgConfidence = signals.length
    ? signals.reduce((a, s) => a + s.confidence_score, 0) / signals.length
    : 0;
  return {
    total_signals: signals.length,
    closed_signals: closed.length,
    win_rate: closed.length ? Number(((wins / closed.length) * 100).toFixed(1)) : 0,
    total_pnl: Number(totalPnl.toFixed(2)),
    avg_confidence: Math.round(avgConfidence),
    tp_hits: signals.filter((s) => s.status.startsWith("tp")).length,
    sl_hits: signals.filter((s) => s.status === "sl_hit").length,
    active_signals: signals.filter((s) => s.closed_at === null && s.status !== "cancelled").length,
  };
}
