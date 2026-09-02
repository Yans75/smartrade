import type { Timeframe } from "./symbols";

export type TdCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Twelve Data ticker for each non-crypto symbol we expose. */
const TD_SYMBOLS: Record<string, string> = {
  "XAU/USD": "XAU/USD",
  "XAG/USD": "XAG/USD",
  "XPT/USD": "XPT/USD",
  BRENT: "BRENT",
  WTI: "WTI",
  NG: "NG",
  "^GSPC": "SPX",
  "^NDX": "NDX",
  "^DJI": "DJI",
  "^GDAXI": "DAX",
  "^FTSE": "UKX",
  "^FCHI": "CAC",
  "^N225": "N225",
  "^HSI": "HSI",
  "ES=F": "SPX",
  "NQ=F": "NDX",
};

/** Forex pairs pass through unchanged (EUR/USD etc.). */
export function toTdSymbol(symbol: string): string | null {
  if (TD_SYMBOLS[symbol]) return TD_SYMBOLS[symbol];
  if (symbol.includes("/")) return symbol;
  return null;
}

const TD_INTERVAL: Record<Timeframe, string> = {
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

function apiKey() {
  const key = process.env["TWELVE_DATA_API_KEY"];
  return key && key.length > 0 ? key : null;
}

async function tdFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("Clé Twelve Data absente");
  const query = new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(`https://api.twelvedata.com/${path}?${query.toString()}`);
  if (!res.ok) throw new Error(`Twelve Data ${res.status}`);
  const body = (await res.json()) as T & { status?: string; message?: string; code?: number };
  if (body.status === "error") throw new Error(body.message ?? "Twelve Data error");
  return body;
}

export function hasTwelveData() {
  return apiKey() !== null;
}

type TdQuote = { symbol?: string; close?: string; percent_change?: string; status?: string };

/** Batched real-time quote for up to 8 non-crypto symbols. */
export async function tdQuotes(
  symbols: string[],
): Promise<{ symbol: string; price: number; change_24h: number }[]> {
  const pairs = symbols
    .map((s) => ({ app: s, td: toTdSymbol(s) }))
    .filter((p): p is { app: string; td: string } => p.td !== null);
  if (pairs.length === 0) return [];

  const unique = [...new Set(pairs.map((p) => p.td))];
  const body = await tdFetch<Record<string, TdQuote> | TdQuote>("quote", {
    symbol: unique.join(","),
  });
  const byTd = new Map<string, TdQuote>();
  if (unique.length === 1) byTd.set(unique[0]!, body as TdQuote);
  else for (const [k, v] of Object.entries(body as Record<string, TdQuote>)) byTd.set(k, v);

  const out: { symbol: string; price: number; change_24h: number }[] = [];
  for (const p of pairs) {
    const q = byTd.get(p.td);
    const price = Number(q?.close);
    if (!q || q.status === "error" || !Number.isFinite(price) || price === 0) continue;
    out.push({
      symbol: p.app,
      price,
      change_24h: Number(Number(q.percent_change ?? 0).toFixed(2)),
    });
  }
  return out;
}

type TdSeries = {
  values?: {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }[];
};

export async function tdCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number,
): Promise<TdCandle[]> {
  const td = toTdSymbol(symbol);
  if (!td) throw new Error(`Symbole non supporté par Twelve Data : ${symbol}`);
  const body = await tdFetch<TdSeries>("time_series", {
    symbol: td,
    interval: TD_INTERVAL[timeframe],
    outputsize: String(Math.min(limit, 500)),
    order: "ASC",
  });
  const values = body.values ?? [];
  if (values.length === 0) throw new Error(`Aucune bougie Twelve Data pour ${symbol}`);
  return values.map((v) => ({
    time: new Date(v.datetime.replace(" ", "T") + "Z").getTime(),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: Number(v.volume ?? 0),
  }));
}
