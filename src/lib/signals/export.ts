import type { TradingSignal } from "@/lib/mock/types";

const HEADERS = [
  "date",
  "symbole",
  "direction",
  "mode",
  "strategie",
  "entree",
  "stop_loss",
  "tp1",
  "tp2",
  "tp3",
  "confiance",
  "statut",
  "prix_cloture",
  "date_cloture",
  "pnl_percent",
] as const;

/** Escapes a CSV field: quotes double up, anything risky gets wrapped. */
function cell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function signalsToCsv(signals: TradingSignal[]) {
  const rows = signals.map((s) => [
    s.created_at,
    s.symbol,
    s.direction,
    s.trading_mode,
    s.strategy,
    s.entry_price,
    s.stop_loss,
    s.take_profit_1,
    s.take_profit_2,
    s.take_profit_3,
    s.confidence_score,
    s.status,
    s.closed_price ?? "",
    s.closed_at ?? "",
    s.pnl_percent ?? "",
  ]);
  return [HEADERS, ...rows].map((row) => row.map(cell).join(";")).join("\n");
}

/** Triggers a browser download of the given text. */
export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens accented headers correctly.
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
