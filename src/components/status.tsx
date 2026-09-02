import type { SignalStatus } from "@/lib/mock/types";

export const STATUS_LABELS: Record<SignalStatus, string> = {
  active: "Actif",
  tp1_hit: "TP1 atteint",
  tp2_hit: "TP2 atteint",
  tp3_hit: "TP3 atteint",
  sl_hit: "SL touché",
  cancelled: "Annulé",
};

export function StatusBadge({ status }: { status: SignalStatus }) {
  const color =
    status === "sl_hit"
      ? "var(--color-sell)"
      : status === "cancelled"
        ? "var(--color-neutral)"
        : status === "active"
          ? "var(--color-brand-text)"
          : "var(--color-buy)";
  return (
    <span
      className="rounded-full px-2.5 py-1 font-mono text-[10px] tracking-widest uppercase"
      style={{ color, background: "var(--color-muted)" }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PnlText({ value }: { value: number | null }) {
  if (value === null) return <span className="font-mono text-xs text-muted-foreground">—</span>;
  return (
    <span
      className="font-mono text-xs tabular-nums"
      style={{ color: value >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}
    >
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
