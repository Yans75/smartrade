import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TickersInput = z.object({ symbols: z.array(z.string().min(1)).min(1).max(20) });
const SymbolInput = z.object({ symbol: z.string().min(1) });

export const getQuotes = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TickersInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchQuotes } = await import("./market.server");
    try {
      return { quotes: await fetchQuotes(data.symbols) };
    } catch {
      return { quotes: [] };
    }
  });

export const getDepth = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => SymbolInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchDepth } = await import("./market.server");
    try {
      return await fetchDepth(data.symbol);
    } catch {
      // Order book is optional: the UI falls back to a simulated book.
      return { rows: [], imbalance: 0, source: "estimated" as const };
    }
  });
