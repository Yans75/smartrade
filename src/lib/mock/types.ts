export type Direction = "BUY" | "SELL" | "NEUTRAL";
export type TradingMode = "scalping" | "day_trading" | "swing";
export type SignalStatus = "active" | "tp1_hit" | "tp2_hit" | "tp3_hit" | "sl_hit" | "cancelled";
export type MarketCategory = "crypto" | "forex" | "commodities" | "indices";

export type TimeframeAnalysis = {
  timeframe: string;
  trend: "haussier" | "baissier" | "range";
  structure: string;
  key_levels: number[];
  fvg_zones: { start: number; end: number; type: "haussier" | "baissier" }[];
  bos_detected: boolean;
  poi_levels: number[];
};

export type OrderFlowConfirmation = {
  confirms_direction: boolean;
  strength: "fort" | "moyen" | "faible";
  key_observation: string;
};

export type TradingSignal = {
  id: string;
  symbol: string;
  direction: Direction;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3: number;
  confidence_score: number;
  trading_mode: TradingMode;
  strategy: string;
  timeframe_analysis: TimeframeAnalysis[];
  reasoning: string;
  position_advice: string;
  market_warning: string | null;
  order_flow_confirmation: OrderFlowConfirmation;
  status: SignalStatus;
  pnl_percent: number | null;
  closed_at: string | null;
  closed_price: number | null;
  created_at: string;
};

export type Ticker = {
  symbol: string;
  label: string;
  price: number;
  change_24h: number;
  category: MarketCategory;
};
