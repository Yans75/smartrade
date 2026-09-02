import { Activity, Sparkles, TriangleAlert } from "lucide-react";
import { ConfidenceRing } from "./ConfidenceRing";
import { formatPrice } from "@/lib/mock/data";
import type { TradingSignal } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

function PriceRow({
  label,
  value,
  entry,
  color,
  emphasis,
}: {
  label: string;
  value: number;
  entry: number;
  color: string;
  emphasis?: boolean;
}) {
  const delta = ((value - entry) / entry) * 100;
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0">
      <span className="label-mono">{label}</span>
      <div className="flex items-baseline gap-3">
        <span
          className={cn("font-mono tabular-nums", emphasis ? "text-lg font-semibold" : "text-sm")}
          style={{ color }}
        >
          {formatPrice(value)}
        </span>
        <span className="w-16 text-right font-mono text-[11px] text-muted-foreground">
          {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`}
        </span>
      </div>
    </div>
  );
}

export function SignalCard({ signal }: { signal: TradingSignal }) {
  const isBuy = signal.direction === "BUY";
  const dirColor = isBuy ? "var(--color-buy)" : "var(--color-sell)";
  const of = signal.order_flow_confirmation;

  return (
    <div
      className={cn("glass relative overflow-hidden p-5 sm:p-6", isBuy ? "glow-buy" : "glow-sell")}
    >
      <div
        className="pointer-events-none absolute -top-28 -right-24 h-64 w-64 rounded-full blur-3xl"
        style={{ background: dirColor, opacity: 0.1 }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">
              {signal.symbol}
            </h2>
            <span
              className="rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-widest uppercase"
              style={{ background: `${dirColor}`, opacity: 0.95, color: "#06080f" }}
            >
              {signal.direction}
            </span>
            {signal.status === "active" && (
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full"
                    style={{ background: dirColor }}
                  />
                  <span
                    className="relative inline-flex h-1.5 w-1.5 rounded-full"
                    style={{ background: dirColor }}
                  />
                </span>
                Actif
              </span>
            )}
          </div>
          <p className="mt-2 font-mono text-[11px] tracking-wide uppercase text-muted-foreground">
            {signal.trading_mode.replace("_", " ")} · {signal.strategy.toUpperCase()} ·{" "}
            {new Date(signal.created_at).toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <ConfidenceRing score={signal.confidence_score} />
      </div>

      <div className="relative mt-5">
        <PriceRow
          label="Entrée"
          value={signal.entry_price}
          entry={signal.entry_price}
          color="var(--color-brand-text)"
          emphasis
        />
        <PriceRow
          label="Stop loss"
          value={signal.stop_loss}
          entry={signal.entry_price}
          color="var(--color-sell)"
        />
        <PriceRow
          label="Take profit 1"
          value={signal.take_profit_1}
          entry={signal.entry_price}
          color="var(--color-buy)"
        />
        <PriceRow
          label="Take profit 2"
          value={signal.take_profit_2}
          entry={signal.entry_price}
          color="var(--color-buy)"
        />
        <PriceRow
          label="Take profit 3"
          value={signal.take_profit_3}
          entry={signal.entry_price}
          color="var(--color-buy)"
        />
      </div>

      <div className="relative mt-5 rounded-2xl bg-muted p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-brand-text" />
          <span className="label-mono">Order flow</span>
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase"
            style={{
              background: of.confirms_direction ? "var(--color-buy)" : "var(--color-sell)",
              color: "#06080f",
            }}
          >
            {of.confirms_direction ? "Confirme" : "Contredit"}
          </span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            force : {of.strength}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{of.key_observation}</p>
      </div>

      <div className="relative mt-5 border-l-2 border-brand pl-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-brand-text" />
          <span className="label-mono">Analyse IA</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{signal.reasoning}</p>
        <p className="mt-3 text-sm leading-relaxed text-foreground/80">{signal.position_advice}</p>
      </div>

      {signal.market_warning && (
        <div className="relative mt-4 flex items-start gap-2 rounded-2xl border border-confidence/30 bg-confidence/10 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 text-confidence" />
          <p className="text-sm text-confidence">{signal.market_warning}</p>
        </div>
      )}
    </div>
  );
}
