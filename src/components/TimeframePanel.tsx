import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { formatPrice } from "@/lib/mock/data";
import type { TimeframeAnalysis } from "@/lib/mock/types";

const trendIcon = {
  haussier: ArrowUpRight,
  baissier: ArrowDownRight,
  range: ArrowRight,
} as const;

const trendColor = {
  haussier: "var(--color-buy)",
  baissier: "var(--color-sell)",
  range: "var(--color-neutral)",
} as const;

export function TimeframePanel({ items }: { items: TimeframeAnalysis[] }) {
  return (
    <div className="glass p-5">
      <span className="label-mono">Analyse multi-timeframe</span>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((tf) => {
          const Icon = trendIcon[tf.trend];
          return (
            <div key={tf.timeframe} className="rounded-2xl bg-muted p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{tf.timeframe}</span>
                <span
                  className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase"
                  style={{ color: trendColor[tf.trend] }}
                >
                  <Icon className="h-3 w-3" />
                  {tf.trend}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tf.structure}</p>
              <div className="mt-3 space-y-1 font-mono text-[10px] text-muted-foreground">
                <p>Niveaux clés : {tf.key_levels.map((l) => formatPrice(l)).join(" · ")}</p>
                <p>
                  FVG :{" "}
                  {tf.fvg_zones
                    .map((z) => `${formatPrice(z.start)}–${formatPrice(z.end)} (${z.type})`)
                    .join(" · ")}
                </p>
                <p>POI : {tf.poi_levels.map((l) => formatPrice(l)).join(" · ")}</p>
                <p style={{ color: tf.bos_detected ? "var(--color-buy)" : undefined }}>
                  BOS {tf.bos_detected ? "détecté" : "non détecté"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
