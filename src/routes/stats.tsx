import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText, Gauge, Percent, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { ConfidenceRing } from "@/components/ConfidenceRing";
import { PnlText } from "@/components/status";
import { useAuth } from "@/lib/auth/auth";
import { listMySignals } from "@/lib/signals/signals.functions";
import { buildDetailedStats, buildPnlCurve } from "@/lib/signals/derive";
import { downloadCsv, signalsToCsv } from "@/lib/signals/export";
import { formatPrice } from "@/lib/mock/data";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Statistiques de performance — Smartrade" },
      {
        name: "description",
        content:
          "Win rate, PnL cumulé, performance par symbole et par mode de trading, meilleur et pire trade, export CSV.",
      },
      { property: "og:title", content: "Statistiques de performance — Smartrade" },
      { property: "og:description", content: "Analysez la performance de vos signaux IA." },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const { user, ready } = useAuth();
  const fetchSignals = useServerFn(listMySignals);
  const { data } = useQuery({
    queryKey: ["my-signals"],
    queryFn: () => fetchSignals(),
    enabled: ready && !!user,
  });
  const signals = data?.signals ?? [];
  const s = useMemo(() => buildDetailedStats(signals), [signals]);
  const curve = useMemo(() => buildPnlCurve(signals), [signals]);
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="label-mono">Performance</span>
            <h1 className="mt-2 text-3xl font-bold">Statistiques</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (signals.length === 0) {
                  toast.error("Aucun signal à exporter");
                  return;
                }
                downloadCsv(
                  `smartsignal-${new Date().toISOString().slice(0, 10)}.csv`,
                  signalsToCsv(signals),
                );
                toast.success(`${signals.length} signaux exportés`);
              }}
              className="flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Win rate"
            value={`${s.win_rate} %`}
            icon={Percent}
            color="var(--color-buy)"
          />
          <StatCard
            label="PnL cumulé"
            value={`${s.total_pnl > 0 ? "+" : ""}${s.total_pnl} %`}
            icon={TrendingUp}
            color={s.total_pnl >= 0 ? "var(--color-buy)" : "var(--color-sell)"}
          />
          <StatCard
            label="Confiance moyenne"
            value={`${s.avg_confidence}`}
            icon={Gauge}
            color="var(--color-confidence)"
          />
          <StatCard
            label="TP / SL"
            value={`${s.tp_hits} / ${s.sl_hits}`}
            icon={Zap}
            hint={`${s.total_signals} signaux au total`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-12">
          <div className="glass p-5 lg:col-span-8">
            <span className="label-mono">PnL cumulé (%)</span>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curve}>
                  <defs>
                    <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--color-muted-foreground)"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="var(--color-brand-alt)"
                    strokeWidth={2}
                    fill="url(#pnlFill)"
                    name="PnL cumulé"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass flex flex-col items-center justify-center gap-4 p-5 lg:col-span-4">
            <span className="label-mono">Taux de réussite</span>
            <ConfidenceRing score={s.win_rate} size={160} label="win rate" />
            <div className="grid w-full grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-muted p-3">
                <p className="label-mono">Meilleur</p>
                <p className="mt-1 font-mono text-xs">{s.best?.symbol ?? "—"}</p>
                <PnlText value={s.best?.pnl_percent ?? null} />
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <p className="label-mono">Pire</p>
                <p className="mt-1 font-mono text-xs">{s.worst?.symbol ?? "—"}</p>
                <PnlText value={s.worst?.pnl_percent ?? null} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="glass overflow-x-auto p-5">
            <span className="label-mono">Par symbole</span>
            <table className="mt-4 w-full min-w-[380px]">
              <thead>
                <tr className="border-b border-border">
                  {["Symbole", "Trades", "Win rate", "PnL"].map((h) => (
                    <th key={h} className="label-mono px-2 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.by_symbol.map((r) => (
                  <tr key={r.symbol} className="border-b border-border/50 last:border-0">
                    <td className="px-2 py-2.5 font-mono text-xs">{r.symbol}</td>
                    <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">
                      {r.trades}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs">{r.win_rate} %</td>
                    <td className="px-2 py-2.5">
                      <PnlText value={r.pnl} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass p-5">
            <span className="label-mono">Par mode de trading</span>
            <div className="mt-4 space-y-3">
              {s.by_mode.map((m) => (
                <div key={m.mode} className="rounded-2xl bg-muted p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{m.mode}</span>
                    <PnlText value={m.pnl} />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="brand-gradient h-full rounded-full"
                        style={{ width: `${m.win_rate}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {m.win_rate} % · {m.trades} trades
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-muted p-4">
              <p className="label-mono">Meilleur trade</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {s.best
                  ? `${s.best.symbol} · entrée ${formatPrice(s.best.entry_price)} · clôture ${formatPrice(s.best.closed_price ?? s.best.entry_price)}`
                  : "Aucun trade clôturé pour l'instant."}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
