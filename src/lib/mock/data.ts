import type { MarketCategory, Ticker, TradingSignal } from "./types";

export const CATEGORIES: { id: MarketCategory; label: string }[] = [
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "commodities", label: "Matières premières" },
  { id: "indices", label: "Indices" },
];

export const SYMBOLS: Record<MarketCategory, { symbol: string; label: string }[]> = {
  crypto: [
    { symbol: "BTCUSDT", label: "Bitcoin" },
    { symbol: "ETHUSDT", label: "Ethereum" },
    { symbol: "BNBUSDT", label: "BNB" },
    { symbol: "SOLUSDT", label: "Solana" },
    { symbol: "XRPUSDT", label: "XRP" },
    { symbol: "ADAUSDT", label: "Cardano" },
    { symbol: "DOGEUSDT", label: "Dogecoin" },
    { symbol: "AVAXUSDT", label: "Avalanche" },
    { symbol: "DOTUSDT", label: "Polkadot" },
    { symbol: "MATICUSDT", label: "Polygon" },
  ],
  forex: [
    { symbol: "EUR/USD", label: "Euro / Dollar" },
    { symbol: "GBP/USD", label: "Livre / Dollar" },
    { symbol: "USD/JPY", label: "Dollar / Yen" },
    { symbol: "USD/CHF", label: "Dollar / Franc" },
    { symbol: "AUD/USD", label: "Aussie / Dollar" },
    { symbol: "USD/CAD", label: "Dollar / Canadien" },
    { symbol: "NZD/USD", label: "Kiwi / Dollar" },
    { symbol: "EUR/GBP", label: "Euro / Livre" },
    { symbol: "EUR/JPY", label: "Euro / Yen" },
    { symbol: "GBP/JPY", label: "Livre / Yen" },
  ],
  commodities: [
    { symbol: "XAU/USD", label: "Or" },
    { symbol: "XAG/USD", label: "Argent" },
    { symbol: "XPT/USD", label: "Platine" },
    { symbol: "BRENT", label: "Pétrole Brent" },
    { symbol: "WTI", label: "Pétrole WTI" },
    { symbol: "NG", label: "Gaz naturel" },
  ],
  indices: [
    { symbol: "^GSPC", label: "S&P 500" },
    { symbol: "^NDX", label: "Nasdaq 100" },
    { symbol: "^DJI", label: "Dow Jones" },
    { symbol: "^GDAXI", label: "DAX 40" },
    { symbol: "^FTSE", label: "FTSE 100" },
    { symbol: "^FCHI", label: "CAC 40" },
    { symbol: "^N225", label: "Nikkei" },
    { symbol: "^HSI", label: "Hang Seng" },
    { symbol: "ES=F", label: "S&P Futures" },
    { symbol: "NQ=F", label: "Nasdaq Futures" },
  ],
};

export const TRADING_MODES: { id: "scalping" | "day_trading" | "swing"; label: string }[] = [
  { id: "scalping", label: "Scalping" },
  { id: "day_trading", label: "Day Trading" },
  { id: "swing", label: "Swing" },
];

const BASE_PRICES: Record<string, number> = {
  BTCUSDT: 104250.5,
  ETHUSDT: 3284.12,
  BNBUSDT: 712.44,
  SOLUSDT: 214.87,
  XRPUSDT: 2.4312,
  ADAUSDT: 0.9812,
  DOGEUSDT: 0.3421,
  AVAXUSDT: 41.28,
  DOTUSDT: 7.812,
  MATICUSDT: 0.5124,
  "EUR/USD": 1.0842,
  "GBP/USD": 1.2712,
  "USD/JPY": 156.84,
  "USD/CHF": 0.9043,
  "AUD/USD": 0.6412,
  "USD/CAD": 1.4321,
  "NZD/USD": 0.5821,
  "EUR/GBP": 0.8531,
  "EUR/JPY": 170.12,
  "GBP/JPY": 199.44,
  "XAU/USD": 2712.4,
  "XAG/USD": 31.24,
  "XPT/USD": 964.2,
  BRENT: 78.42,
  WTI: 74.18,
  NG: 3.412,
  "^GSPC": 6042.12,
  "^NDX": 21684.4,
  "^DJI": 44218.9,
  "^GDAXI": 20124.6,
  "^FTSE": 8241.3,
  "^FCHI": 7612.8,
  "^N225": 39842.1,
  "^HSI": 19842.4,
  "ES=F": 6051.5,
  "NQ=F": 21712.2,
};

const CHANGES: Record<string, number> = {
  BTCUSDT: 2.14,
  ETHUSDT: 3.42,
  BNBUSDT: -0.82,
  SOLUSDT: 5.12,
  XRPUSDT: -1.24,
  ADAUSDT: 1.87,
  DOGEUSDT: 4.21,
  AVAXUSDT: -2.14,
  DOTUSDT: 0.94,
  MATICUSDT: -0.42,
};

/** Deterministic pseudo-random so SSR and client render identically. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function getPrice(symbol: string) {
  return BASE_PRICES[symbol] ?? 100;
}

export function getChange(symbol: string) {
  if (CHANGES[symbol] !== undefined) return CHANGES[symbol];
  const rnd = seeded(symbol);
  return Number(((rnd() - 0.45) * 4).toFixed(2));
}

export function formatPrice(value: number) {
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 5;
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export const TICKERS: Ticker[] = SYMBOLS.crypto.slice(0, 8).map((s) => ({
  symbol: s.symbol,
  label: s.label,
  price: getPrice(s.symbol),
  change_24h: getChange(s.symbol),
  category: "crypto" as const,
}));

export function buildSignal(
  symbol: string,
  mode: "scalping" | "day_trading" | "swing",
  overrides: Partial<TradingSignal> = {},
): TradingSignal {
  const rnd = seeded(symbol + mode + (overrides.id ?? ""));
  const price = getPrice(symbol);
  const direction = overrides.direction ?? (rnd() > 0.42 ? "BUY" : "SELL");
  const sign = direction === "SELL" ? -1 : 1;
  const risk = price * (mode === "scalping" ? 0.004 : mode === "day_trading" ? 0.011 : 0.028);
  const entry = price * (1 + (rnd() - 0.5) * 0.002);
  const round = (v: number) => Number(v.toFixed(price >= 1000 ? 2 : price >= 1 ? 4 : 5));

  return {
    id: overrides.id ?? `sig-${symbol}-${mode}`,
    symbol,
    direction,
    entry_price: round(entry),
    stop_loss: round(entry - sign * risk),
    take_profit_1: round(entry + sign * risk * 1.2),
    take_profit_2: round(entry + sign * risk * 2.1),
    take_profit_3: round(entry + sign * risk * 3.4),
    confidence_score: overrides.confidence_score ?? 55 + Math.floor(rnd() * 40),
    trading_mode: mode,
    strategy: "ict_smc",
    timeframe_analysis: ["15m", "1h", "4h", "1d"].map((tf, i) => ({
      timeframe: tf,
      trend:
        direction === "BUY" ? (i === 0 ? "range" : "haussier") : i === 0 ? "range" : "baissier",
      structure:
        direction === "BUY"
          ? "BOS confirmé, continuation haussière après retest de l'order block"
          : "CHoCH validé, prise de liquidité au-dessus du dernier sommet",
      key_levels: [round(entry - risk * 1.5), round(entry + risk * 1.5)],
      fvg_zones: [
        {
          start: round(entry - risk * 0.6),
          end: round(entry - risk * 0.2),
          type: direction === "BUY" ? "haussier" : "baissier",
        },
      ],
      bos_detected: i !== 0,
      poi_levels: [round(entry - risk * 0.8), round(entry + risk * 0.9)],
    })),
    reasoning:
      direction === "BUY"
        ? `Le prix de ${symbol} a réalisé un balayage de liquidité sous le plus bas de la session asiatique avant de repartir avec un déséquilibre acheteur marqué. La structure H1 reste haussière (BOS confirmé), et le retest du Fair Value Gap offre une entrée à faible risque. Le carnet d'ordres montre une accumulation nette côté acheteur, ce qui renforce le scénario de continuation vers les liquidités supérieures.`
        : `${symbol} a pris la liquidité au-dessus du sommet précédent puis a cassé la structure interne à la baisse (CHoCH). Le déséquilibre vendeur sur le carnet d'ordres et l'absence de demande sur les niveaux intermédiaires favorisent une distribution vers les Fair Value Gaps inférieurs. L'entrée se situe sur le retest de l'order block baissier H1.`,
    position_advice:
      "Risque conseillé : 1 % du capital. Sécurisez 50 % de la position sur TP1 et déplacez le stop au point d'entrée. Laissez courir le reste jusqu'à TP2/TP3 avec un stop suiveur.",
    market_warning:
      rnd() > 0.7 ? "Publication macroéconomique dans moins de 2 h — volatilité accrue." : null,
    order_flow_confirmation: {
      confirms_direction: rnd() > 0.25,
      strength: rnd() > 0.6 ? "fort" : rnd() > 0.3 ? "moyen" : "faible",
      key_observation:
        direction === "BUY"
          ? `Murs d'achat massifs détectés à ${formatPrice(round(entry - risk * 0.7))}, imbalance +38 % côté bids.`
          : `Concentration d'ordres de vente à ${formatPrice(round(entry + risk * 0.7))}, imbalance -31 % côté asks.`,
    },
    status: "active",
    pnl_percent: null,
    closed_at: null,
    closed_price: null,
    created_at: new Date("2026-08-18T16:12:00Z").toISOString(),
    ...overrides,
  };
}

export const ACTIVE_SIGNAL = buildSignal("BTCUSDT", "day_trading", {
  id: "sig-active",
  direction: "BUY",
  confidence_score: 82,
});

const HISTORY_SEEDS: {
  symbol: string;
  mode: "scalping" | "day_trading" | "swing";
  status: TradingSignal["status"];
  pnl: number;
  day: number;
}[] = [
  { symbol: "BTCUSDT", mode: "day_trading", status: "tp2_hit", pnl: 2.34, day: 1 },
  { symbol: "ETHUSDT", mode: "swing", status: "tp3_hit", pnl: 6.82, day: 2 },
  { symbol: "SOLUSDT", mode: "scalping", status: "sl_hit", pnl: -0.94, day: 3 },
  { symbol: "EUR/USD", mode: "day_trading", status: "tp1_hit", pnl: 0.72, day: 4 },
  { symbol: "XAU/USD", mode: "swing", status: "tp2_hit", pnl: 3.18, day: 5 },
  { symbol: "^NDX", mode: "day_trading", status: "sl_hit", pnl: -1.12, day: 6 },
  { symbol: "BNBUSDT", mode: "scalping", status: "tp1_hit", pnl: 0.48, day: 7 },
  { symbol: "GBP/JPY", mode: "day_trading", status: "tp2_hit", pnl: 2.04, day: 8 },
  { symbol: "WTI", mode: "swing", status: "cancelled", pnl: 0, day: 9 },
  { symbol: "XRPUSDT", mode: "scalping", status: "tp1_hit", pnl: 0.63, day: 10 },
  { symbol: "^GSPC", mode: "swing", status: "tp3_hit", pnl: 4.42, day: 11 },
  { symbol: "AVAXUSDT", mode: "day_trading", status: "sl_hit", pnl: -1.34, day: 12 },
  { symbol: "ETHUSDT", mode: "day_trading", status: "tp2_hit", pnl: 2.81, day: 13 },
  { symbol: "XAG/USD", mode: "swing", status: "tp1_hit", pnl: 1.12, day: 14 },
];

export const SIGNAL_HISTORY: TradingSignal[] = HISTORY_SEEDS.map((seed, i) => {
  const closed = new Date(Date.UTC(2026, 7, 18 - seed.day, 14, 30));
  const created = new Date(closed.getTime() - 6 * 3600 * 1000);
  return buildSignal(seed.symbol, seed.mode, {
    id: `sig-h-${i}`,
    status: seed.status,
    pnl_percent: seed.pnl,
    closed_at: closed.toISOString(),
    created_at: created.toISOString(),
    closed_price: getPrice(seed.symbol),
  });
});

export const ALL_SIGNALS = [ACTIVE_SIGNAL, ...SIGNAL_HISTORY];

export function orderBook(symbol: string) {
  const price = getPrice(symbol);
  const rnd = seeded(symbol + "ob");
  const step = price * 0.0004;
  let bidCum = 0;
  let askCum = 0;
  const rows = Array.from({ length: 14 }, (_, i) => {
    bidCum += rnd() * 32 + 6;
    askCum += rnd() * 30 + 5;
    return {
      level: Number((price - step * (14 - i)).toFixed(2)),
      askLevel: Number((price + step * (i + 1)).toFixed(2)),
      bids: Number(bidCum.toFixed(1)),
      asks: Number(askCum.toFixed(1)),
    };
  });
  const totalBids = rows.at(-1)!.bids;
  const totalAsks = rows.at(-1)!.asks;
  return {
    rows,
    imbalance: Number((((totalBids - totalAsks) / (totalBids + totalAsks)) * 100).toFixed(1)),
  };
}

export const PERFORMANCE_HISTORY = (() => {
  let cum = 0;
  return [...SIGNAL_HISTORY]
    .reverse()
    .filter((s) => s.status !== "cancelled")
    .map((s) => {
      cum += s.pnl_percent ?? 0;
      return {
        date: new Date(s.closed_at!).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        }),
        pnl: Number(cum.toFixed(2)),
      };
    });
})();

export const DETAILED_STATS = (() => {
  const closed = SIGNAL_HISTORY.filter((s) => s.status !== "cancelled" && s.status !== "active");
  const wins = closed.filter((s) => (s.pnl_percent ?? 0) > 0);
  const total_pnl = closed.reduce((a, s) => a + (s.pnl_percent ?? 0), 0);
  const bySymbol = new Map<string, { trades: number; pnl: number; wins: number }>();
  for (const s of closed) {
    const cur = bySymbol.get(s.symbol) ?? { trades: 0, pnl: 0, wins: 0 };
    cur.trades += 1;
    cur.pnl += s.pnl_percent ?? 0;
    if ((s.pnl_percent ?? 0) > 0) cur.wins += 1;
    bySymbol.set(s.symbol, cur);
  }
  const byMode = TRADING_MODES.map((m) => {
    const rows = closed.filter((s) => s.trading_mode === m.id);
    return {
      mode: m.label,
      trades: rows.length,
      pnl: Number(rows.reduce((a, s) => a + (s.pnl_percent ?? 0), 0).toFixed(2)),
      win_rate: rows.length
        ? Math.round((rows.filter((s) => (s.pnl_percent ?? 0) > 0).length / rows.length) * 100)
        : 0,
    };
  });
  const sorted = [...closed].sort((a, b) => (b.pnl_percent ?? 0) - (a.pnl_percent ?? 0));
  return {
    total_signals: ALL_SIGNALS.length,
    win_rate: Math.round((wins.length / closed.length) * 100),
    total_pnl: Number(total_pnl.toFixed(2)),
    avg_confidence: Math.round(
      ALL_SIGNALS.reduce((a, s) => a + s.confidence_score, 0) / ALL_SIGNALS.length,
    ),
    tp_hits: closed.filter((s) => s.status.startsWith("tp")).length,
    sl_hits: closed.filter((s) => s.status === "sl_hit").length,
    best: sorted[0]!,
    worst: sorted.at(-1)!,
    by_symbol: [...bySymbol.entries()]
      .map(([symbol, v]) => ({
        symbol,
        trades: v.trades,
        pnl: Number(v.pnl.toFixed(2)),
        win_rate: Math.round((v.wins / v.trades) * 100),
      }))
      .sort((a, b) => b.pnl - a.pnl),
    by_mode: byMode,
  };
})();

export const ADMIN_USERS = [
  {
    id: "u-1",
    email: "thomas.leroy@gmail.com",
    name: "Thomas Leroy",
    tier: "premium" as const,
    signals_used_today: 12,
    signals_limit: 999,
    is_admin: false,
    created_at: "2026-04-12",
  },
  {
    id: "u-2",
    email: "sofia.martin@outlook.fr",
    name: "Sofia Martin",
    tier: "free" as const,
    signals_used_today: 3,
    signals_limit: 3,
    is_admin: false,
    created_at: "2026-06-02",
  },
  {
    id: "u-3",
    email: "admin@smartsignal.io",
    name: "Admin",
    tier: "premium" as const,
    signals_used_today: 5,
    signals_limit: 999,
    is_admin: true,
    created_at: "2026-01-08",
  },
  {
    id: "u-4",
    email: "karim.b@proton.me",
    name: "Karim Benali",
    tier: "free" as const,
    signals_used_today: 1,
    signals_limit: 3,
    is_admin: false,
    created_at: "2026-07-21",
  },
  {
    id: "u-5",
    email: "elena.rossi@gmail.com",
    name: "Elena Rossi",
    tier: "premium" as const,
    signals_used_today: 22,
    signals_limit: 999,
    is_admin: false,
    created_at: "2026-05-30",
  },
];

export const ADMIN_STATS = {
  users: 1284,
  premium: 218,
  signals_today: 476,
  signals_total: 38412,
  mrr: 6322,
};
