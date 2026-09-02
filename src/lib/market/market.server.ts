import { isCrypto, toYahooQuoteSymbols, toYahooSymbols, type Timeframe } from "./symbols";
import { hasTwelveData, tdCandles, tdQuotes } from "./twelvedata.server";
import { fetchCryptoBook, fetchCryptoCandles, fetchCryptoQuotes } from "./crypto.server";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Quote = {
  symbol: string;
  price: number;
  change_24h: number;
  /** Epoch ms when the price was captured server-side. */
  ts: number;
  provider: "twelvedata" | "yahoo" | "crypto" | "spot";
};
export type DepthRow = { level: number; askLevel: number; bids: number; asks: number };
export type Depth = { rows: DepthRow[]; imbalance: number; source: "binance" | "estimated" };

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Smartrade/1.0)" };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: UA, ...init });
  if (!res.ok) throw new Error(`Requête marché échouée (${res.status}) : ${url}`);
  return (await res.json()) as T;
}

/* ------------------------------- quotes ------------------------------- */

type YahooChart = {
  chart: {
    result:
      | {
          meta: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
          };
          timestamp?: number[];
          indicators: {
            quote: {
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }[];
          };
        }[]
      | null;
    error?: { description?: string } | null;
  };
};

async function yahooChart(symbol: string, interval: string, range: string, tickers?: string[]) {
  let lastError: unknown;
  for (const ticker of tickers ?? toYahooSymbols(symbol)) {
    for (const host of ["query1", "query2"]) {
      try {
        const data = await json<YahooChart>(
          `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            ticker,
          )}?interval=${interval}&range=${range}`,
        );
        const result = data.chart.result?.[0];
        if (result) return result;
        lastError = new Error(`Données indisponibles pour ${symbol}`);
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError ?? new Error(`Données indisponibles pour ${symbol}`);
}

/**
 * Live spot price for precious metals. Yahoo only exposes the futures contract
 * (premium + delayed feed), so the spot fix comes from a dedicated endpoint.
 */
const METAL_SPOT: Record<string, string> = {
  "XAU/USD": "XAU",
  "XAG/USD": "XAG",
};

async function metalSpot(symbol: string): Promise<{ price: number; ts: number } | null> {
  const code = METAL_SPOT[symbol];
  if (!code) return null;
  try {
    const data = await json<{ price?: number; updatedAt?: string }>(
      `https://api.gold-api.com/price/${code}`,
    );
    if (!data.price || data.price <= 0) return null;
    const ts = data.updatedAt ? Date.parse(data.updatedAt) : Date.now();
    return { price: Number(data.price.toFixed(2)), ts: Number.isFinite(ts) ? ts : Date.now() };
  } catch {
    return null;
  }
}

async function yahooQuote(symbol: string): Promise<Quote> {
  // 1-minute chart => freshest regularMarketPrice available on the free feed.
  const result = await yahooChart(symbol, "1m", "1d", toYahooQuoteSymbols(symbol)).catch(() =>
    yahooChart(symbol, "1d", "5d", toYahooQuoteSymbols(symbol)),
  );
  const closes = (result.indicators.quote[0]?.close ?? []).filter(
    (v): v is number => typeof v === "number",
  );
  const reference = result.meta.regularMarketPrice ?? closes.at(-1) ?? 0;
  const previous =
    result.meta.chartPreviousClose ?? result.meta.previousClose ?? closes.at(-2) ?? reference;
  const change = previous ? ((reference - previous) / previous) * 100 : 0;

  const spot = await metalSpot(symbol);
  return {
    symbol,
    price: spot?.price ?? reference,
    change_24h: Number(change.toFixed(2)),
    ts: spot?.ts ?? Date.now(),
    provider: spot ? "spot" : "yahoo",
  };
}

/**
 * Short-lived server cache: keeps the UI able to poll every few seconds
 * without burning the Twelve Data rate limit (8 req/min).
 */
const quoteCache = new Map<string, Quote>();
const TTL = { crypto: 2_000, other: 6_000 };

function fresh(symbol: string): Quote | null {
  const hit = quoteCache.get(symbol);
  if (!hit) return null;
  const ttl = isCrypto(symbol) ? TTL.crypto : TTL.other;
  return Date.now() - hit.ts <= ttl ? hit : null;
}

function remember(quotes: Quote[]) {
  for (const q of quotes) quoteCache.set(q.symbol, q);
  return quotes;
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const cached = symbols.map(fresh).filter((q): q is Quote => q !== null);
  const todo = symbols.filter((s) => !cached.some((q) => q.symbol === s));
  const crypto = todo.filter(isCrypto);
  const others = todo.filter((s) => !isCrypto(s));

  // Yahoo is the primary quote feed for forex / metals / indices: unlimited and
  // spot-based. Twelve Data credits are reserved for the candle history used by
  // the SMC analysis, and only fill the gaps Yahoo cannot cover.
  const [cryptoRaw, yahooRaw] = await Promise.all([
    crypto.length ? fetchCryptoQuotes(crypto).catch(() => []) : Promise.resolve([]),
    Promise.all(others.map((s) => yahooQuote(s).catch(() => null))),
  ]);
  const cryptoQuotes: Quote[] = cryptoRaw.map((q) => ({
    ...q,
    ts: Date.now(),
    provider: "crypto",
  }));
  const yahooQuotes = yahooRaw.filter((q): q is Quote => q !== null && q.price > 0);

  const missing = others.filter((s) => !yahooQuotes.some((q) => q.symbol === s));
  const tdRaw = hasTwelveData() && missing.length ? await tdQuotes(missing).catch(() => []) : [];
  const tdQuoted: Quote[] = tdRaw.map((q) => ({ ...q, ts: Date.now(), provider: "twelvedata" }));

  const live = remember([...cryptoQuotes, ...yahooQuotes, ...tdQuoted]);

  // Stale-but-known prices are better than a gap when a provider fails.
  const stale = symbols
    .filter((s) => !cached.some((q) => q.symbol === s) && !live.some((q) => q.symbol === s))
    .map((s) => quoteCache.get(s))
    .filter((q): q is Quote => q !== undefined);

  return [...cached, ...live, ...stale];
}

/* ------------------------------- candles ------------------------------ */

const YAHOO_TF: Record<Timeframe, { interval: string; range: string; aggregate: number }> = {
  "15m": { interval: "15m", range: "5d", aggregate: 1 },
  "1h": { interval: "1h", range: "1mo", aggregate: 1 },
  "4h": { interval: "1h", range: "3mo", aggregate: 4 },
  "1d": { interval: "1d", range: "1y", aggregate: 1 },
};

function aggregate(candles: Candle[], size: number): Candle[] {
  if (size <= 1) return candles;
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += size) {
    const chunk = candles.slice(i, i + size);
    if (chunk.length === 0) continue;
    out.push({
      time: chunk[0]!.time,
      open: chunk[0]!.open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk.at(-1)!.close,
      volume: chunk.reduce((a, c) => a + c.volume, 0),
    });
  }
  return out;
}

export async function fetchCandles(
  symbol: string,
  timeframe: Timeframe,
  limit = 120,
): Promise<Candle[]> {
  if (isCrypto(symbol)) {
    return fetchCryptoCandles(symbol, timeframe, limit);
  }

  if (hasTwelveData()) {
    const rows = await tdCandles(symbol, timeframe, limit).catch(() => null);
    if (rows && rows.length > 0) return rows.slice(-limit);
  }

  const cfg = YAHOO_TF[timeframe];
  const result = await yahooChart(symbol, cfg.interval, cfg.range);
  const q = result.indicators.quote[0] ?? {};
  const times = result.timestamp ?? [];
  const candles: Candle[] = [];
  for (let i = 0; i < times.length; i++) {
    const close = q.close?.[i];
    if (typeof close !== "number") continue;
    candles.push({
      time: times[i]! * 1000,
      open: q.open?.[i] ?? close,
      high: q.high?.[i] ?? close,
      low: q.low?.[i] ?? close,
      close,
      volume: q.volume?.[i] ?? 0,
    });
  }
  return aggregate(candles, cfg.aggregate).slice(-limit);
}

/* -------------------------------- depth ------------------------------- */

export async function fetchDepth(symbol: string): Promise<Depth> {
  if (isCrypto(symbol)) {
    const book = await fetchCryptoBook(symbol);
    const bucket = 14;
    const bids = book.bids.slice(0, 70);
    const asks = book.asks.slice(0, 70);
    const perBucket = Math.max(1, Math.floor(Math.min(bids.length, asks.length) / bucket));
    let bidCum = 0;
    let askCum = 0;
    const rows: DepthRow[] = [];
    for (let i = 0; i < bucket; i++) {
      const bidChunk = bids.slice(i * perBucket, (i + 1) * perBucket);
      const askChunk = asks.slice(i * perBucket, (i + 1) * perBucket);
      if (bidChunk.length === 0 || askChunk.length === 0) break;
      bidCum += bidChunk.reduce((a, [, qty]) => a + Number(qty), 0);
      askCum += askChunk.reduce((a, [, qty]) => a + Number(qty), 0);
      rows.push({
        level: Number(bidChunk.at(-1)![0]),
        askLevel: Number(askChunk.at(-1)![0]),
        bids: Number(bidCum.toFixed(3)),
        asks: Number(askCum.toFixed(3)),
      });
    }
    const totalBids = rows.at(-1)?.bids ?? 1;
    const totalAsks = rows.at(-1)?.asks ?? 1;
    return {
      rows,
      imbalance: Number((((totalBids - totalAsks) / (totalBids + totalAsks)) * 100).toFixed(1)),
      source: "binance",
    };
  }

  // No public order book for forex / commodities / indices: estimate depth from
  // recent intraday volume distribution so the UI still shows real liquidity shape.
  const candles = await fetchCandles(symbol, "15m", 40);
  const last = candles.at(-1)?.close ?? 0;
  const step = last * 0.0004 || 0.01;
  const upVolume = candles
    .filter((c) => c.close >= c.open)
    .reduce((a, c) => a + (c.volume || 1), 0);
  const downVolume = candles
    .filter((c) => c.close < c.open)
    .reduce((a, c) => a + (c.volume || 1), 0);
  const total = upVolume + downVolume || 1;
  let bidCum = 0;
  let askCum = 0;
  const rows: DepthRow[] = Array.from({ length: 14 }, (_, i) => {
    bidCum += (upVolume / total) * 100;
    askCum += (downVolume / total) * 100;
    return {
      level: Number((last - step * (14 - i)).toFixed(5)),
      askLevel: Number((last + step * (i + 1)).toFixed(5)),
      bids: Number(bidCum.toFixed(2)),
      asks: Number(askCum.toFixed(2)),
    };
  });
  return {
    rows,
    imbalance: Number((((upVolume - downVolume) / total) * 100).toFixed(1)),
    source: "estimated",
  };
}
