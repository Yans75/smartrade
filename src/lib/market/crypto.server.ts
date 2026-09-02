import type { Timeframe } from "./symbols";

/**
 * Crypto market data with provider redundancy: Binance is preferred but is
 * geo-blocked from some server regions (HTTP 451), so OKX and Bybit act as
 * fallbacks for quotes, candles and the order book.
 */

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Quote = { symbol: string; price: number; change_24h: number };
export type Book = { bids: [string, string][]; asks: [string, string][] };

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Smartrade/1.0)" };

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Requête crypto échouée (${res.status})`);
  return (await res.json()) as T;
}

/** BTCUSDT -> BTC-USDT (OKX / Coinbase style). */
function dashed(symbol: string) {
  const quote = ["USDT", "USDC", "USD", "BTC", "ETH"].find((q) => symbol.endsWith(q)) ?? "USDT";
  return `${symbol.slice(0, symbol.length - quote.length)}-${quote}`;
}

const OKX_BAR: Record<Timeframe, string> = { "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1Dutc" };
const BYBIT_INTERVAL: Record<Timeframe, string> = {
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

/* -------------------------------- quotes ------------------------------- */

async function binanceQuotes(symbols: string[]): Promise<Quote[]> {
  const query = encodeURIComponent(JSON.stringify(symbols));
  const rows = await json<{ symbol: string; lastPrice: string; priceChangePercent: string }[]>(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${query}`,
  );
  return rows
    .map((r) => ({
      symbol: r.symbol,
      price: Number(r.lastPrice),
      change_24h: Number(Number(r.priceChangePercent).toFixed(2)),
    }))
    .filter((q) => Number.isFinite(q.price) && q.price > 0);
}

async function okxQuotes(symbols: string[]): Promise<Quote[]> {
  const body = await json<{ data?: { instId: string; last: string; open24h: string }[] }>(
    "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
  );
  const byId = new Map((body.data ?? []).map((d) => [d.instId, d]));
  const out: Quote[] = [];
  for (const symbol of symbols) {
    const row = byId.get(dashed(symbol));
    const price = Number(row?.last);
    const open = Number(row?.open24h);
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({
      symbol,
      price,
      change_24h: open > 0 ? Number((((price - open) / open) * 100).toFixed(2)) : 0,
    });
  }
  return out;
}

async function bybitQuotes(symbols: string[]): Promise<Quote[]> {
  const body = await json<{
    result?: { list?: { symbol: string; lastPrice: string; price24hPcnt: string }[] };
  }>("https://api.bybit.com/v5/market/tickers?category=spot");
  const byId = new Map((body.result?.list ?? []).map((d) => [d.symbol, d]));
  const out: Quote[] = [];
  for (const symbol of symbols) {
    const row = byId.get(symbol);
    const price = Number(row?.lastPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({
      symbol,
      price,
      change_24h: Number((Number(row?.price24hPcnt ?? 0) * 100).toFixed(2)),
    });
  }
  return out;
}

export async function fetchCryptoQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const providers = [binanceQuotes, okxQuotes, bybitQuotes];
  let collected: Quote[] = [];
  for (const provider of providers) {
    const missing = symbols.filter((s) => !collected.some((q) => q.symbol === s));
    if (missing.length === 0) break;
    const rows = await provider(missing).catch(() => [] as Quote[]);
    collected = [...collected, ...rows];
  }
  return collected;
}

/* ------------------------------- candles ------------------------------- */

async function binanceCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number,
): Promise<Candle[]> {
  const rows = await json<(string | number)[][]>(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`,
  );
  return rows.map((r) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

async function okxCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[]> {
  const body = await json<{ data?: string[][] }>(
    `https://www.okx.com/api/v5/market/candles?instId=${dashed(symbol)}&bar=${OKX_BAR[timeframe]}&limit=${Math.min(limit, 300)}`,
  );
  const rows = (body.data ?? []).map((r) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
  return rows.reverse();
}

async function bybitCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number,
): Promise<Candle[]> {
  const body = await json<{ result?: { list?: string[][] } }>(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${BYBIT_INTERVAL[timeframe]}&limit=${Math.min(limit, 200)}`,
  );
  const rows = (body.result?.list ?? []).map((r) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
  return rows.reverse();
}

export async function fetchCryptoCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number,
): Promise<Candle[]> {
  for (const provider of [binanceCandles, okxCandles, bybitCandles]) {
    const rows = await provider(symbol, timeframe, limit).catch(() => [] as Candle[]);
    const clean = rows.filter((c) => Number.isFinite(c.close) && c.close > 0);
    if (clean.length > 10) return clean.slice(-limit);
  }
  throw new Error(`Aucune bougie disponible pour ${symbol}`);
}

/* -------------------------------- book -------------------------------- */

async function binanceBook(symbol: string): Promise<Book> {
  return json<Book>(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=100`);
}

async function okxBook(symbol: string): Promise<Book> {
  const body = await json<{ data?: { bids: string[][]; asks: string[][] }[] }>(
    `https://www.okx.com/api/v5/market/books?instId=${dashed(symbol)}&sz=100`,
  );
  const row = body.data?.[0];
  if (!row) throw new Error("Carnet indisponible");
  const map = (rows: string[][]) => rows.map((r) => [r[0]!, r[1]!] as [string, string]);
  return { bids: map(row.bids), asks: map(row.asks) };
}

export async function fetchCryptoBook(symbol: string): Promise<Book> {
  for (const provider of [binanceBook, okxBook]) {
    const book = await provider(symbol).catch(() => null);
    if (book && book.bids.length > 0 && book.asks.length > 0) return book;
  }
  throw new Error(`Carnet d'ordres indisponible pour ${symbol}`);
}
