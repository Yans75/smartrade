import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDepth, getQuotes } from "./market.functions";

/** Live quotes, refreshed every 4s (server-side cache protects provider quotas). */
export function useQuotes(symbols: string[]) {
  const fetchQuotes = useServerFn(getQuotes);
  return useQuery({
    queryKey: ["quotes", symbols],
    queryFn: () => fetchQuotes({ data: { symbols } }),
    refetchInterval: 4_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

export function useDepth(symbol: string) {
  const fetchDepth = useServerFn(getDepth);
  return useQuery({
    queryKey: ["depth", symbol],
    queryFn: () => fetchDepth({ data: { symbol } }),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
}
