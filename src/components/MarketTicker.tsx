import { useQuotes } from "@/lib/market/hooks";
import { SYMBOLS, formatPrice } from "@/lib/mock/data";

/** Live ticker across the four markets (20 symbols max per quotes request). */
const TICKER_SYMBOLS = [
  ...SYMBOLS.crypto.slice(0, 6),
  ...SYMBOLS.forex.slice(0, 5),
  ...SYMBOLS.commodities.slice(0, 4),
  ...SYMBOLS.indices.slice(0, 5),
].map((s) => s.symbol);

type Row = { symbol: string; price: number; change_24h: number; ts?: number; provider?: string };

function TickerRow({ rows }: { rows: Row[] }) {
  return (
    <div className="flex shrink-0 items-baseline">
      {rows.map((t) => (
        <div key={t.symbol} className="mx-6 flex items-baseline gap-2">
          <span className="font-mono text-xs text-muted-foreground">{t.symbol}</span>
          <span className="font-mono text-xs">{formatPrice(t.price)}</span>
          <span
            className="font-mono text-xs"
            style={{ color: t.change_24h >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}
          >
            {t.change_24h >= 0 ? "+" : ""}
            {t.change_24h.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function MarketTicker() {
  const { data, isPending } = useQuotes(TICKER_SYMBOLS);
  // Only real quotes are displayed — never simulated prices.
  const rows: Row[] = TICKER_SYMBOLS.flatMap((symbol) => {
    const q = data?.quotes.find((item) => item.symbol === symbol);
    return q ? [q as Row] : [];
  });

  if (rows.length === 0) {
    return (
      <div className="glass py-2.5 text-center font-mono text-xs text-muted-foreground">
        {isPending ? "Chargement des cours en direct…" : "Cours indisponibles"}
      </div>
    );
  }

  return (
    <div className="glass group overflow-hidden py-2.5">
      <div className="ticker-track flex w-max group-hover:[animation-play-state:paused]">
        <TickerRow rows={rows} />
        <TickerRow rows={rows} />
      </div>
    </div>
  );
}
