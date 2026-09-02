import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDepth } from "@/lib/market/hooks";
import { formatPrice, orderBook } from "@/lib/mock/data";

export function DepthChart({ symbol }: { symbol: string }) {
  const { data, isFetching } = useDepth(symbol);
  const fallback = orderBook(symbol);
  const rows = data?.rows.length ? data.rows : fallback.rows;
  const imbalance = data ? data.imbalance : fallback.imbalance;
  const source = data?.source;

  return (
    <div className="glass glass-hover p-5">
      <div className="flex items-center justify-between">
        <span className="label-mono">
          Carnet d'ordres{source === "estimated" ? " (estimé)" : ""}
          {isFetching ? " ·" : ""}
        </span>
        <span
          className="font-mono text-xs"
          style={{ color: imbalance >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}
        >
          imbalance {imbalance > 0 ? "+" : ""}
          {imbalance}%
        </span>
      </div>
      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="bidsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-buy)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-buy)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="asksFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-sell)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-sell)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="level" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
              labelFormatter={(v) => `Niveau ${formatPrice(Number(v))}`}
            />
            <Area
              type="stepAfter"
              dataKey="bids"
              stroke="var(--color-buy)"
              fill="url(#bidsFill)"
              strokeWidth={1.5}
              name="Bids"
            />
            <Area
              type="stepBefore"
              dataKey="asks"
              stroke="var(--color-sell)"
              fill="url(#asksFill)"
              strokeWidth={1.5}
              name="Asks"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>Bids cumulés</span>
        <span>Asks cumulés</span>
      </div>
    </div>
  );
}
