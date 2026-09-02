import type { MarketCategory } from "@/lib/mock/types";
import { SYMBOLS } from "@/lib/mock/data";

/** Yahoo Finance ticker for every non-crypto symbol we expose. */
const YAHOO_OVERRIDES: Record<string, string[]> = {
  // Metals: the =X FX tickers have no intraday chart data, futures do.
  "XAU/USD": ["GC=F", "XAUUSD=X"],
  "XAG/USD": ["SI=F", "XAGUSD=X"],
  "XPT/USD": ["PL=F"],
  BRENT: ["BZ=F"],
  WTI: ["CL=F"],
  NG: ["NG=F"],
};

/**
 * Live-price tickers. For metals we want the SPOT quote (XAUUSD=X), which is
 * continuous and matches broker pricing, instead of the futures contract that
 * trades at a premium and is delayed on the free feed.
 */
const YAHOO_QUOTE_OVERRIDES: Record<string, string[]> = {
  "XAU/USD": ["GC=F"],
  "XAG/USD": ["SI=F"],
};

export function categoryOf(symbol: string): MarketCategory {
  for (const [category, list] of Object.entries(SYMBOLS)) {
    if (list.some((s) => s.symbol === symbol)) return category as MarketCategory;
  }
  return "crypto";
}

export function isCrypto(symbol: string) {
  return categoryOf(symbol) === "crypto";
}

/** Candidate Yahoo tickers, tried in order until one returns data. */
export function toYahooSymbols(symbol: string): string[] {
  const override = YAHOO_OVERRIDES[symbol];
  if (override) return override;
  if (symbol.includes("/")) return [`${symbol.replace("/", "")}=X`];
  return [symbol];
}

export function toYahooSymbol(symbol: string) {
  return toYahooSymbols(symbol)[0]!;
}

/** Candidate Yahoo tickers for live quotes (spot first when relevant). */
export function toYahooQuoteSymbols(symbol: string): string[] {
  return YAHOO_QUOTE_OVERRIDES[symbol] ?? toYahooSymbols(symbol);
}

export type Timeframe = "15m" | "1h" | "4h" | "1d";
export const TIMEFRAMES: Timeframe[] = ["15m", "1h", "4h", "1d"];

export function decimalsFor(price: number) {
  return price >= 1000 ? 2 : price >= 1 ? 4 : 5;
}

export function roundTo(price: number, reference: number) {
  return Number(price.toFixed(decimalsFor(reference)));
}
