import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { PillGroup } from "@/components/PillGroup";
import { SignalDetailModal } from "@/components/SignalDetailModal";
import { PnlText, StatusBadge } from "@/components/status";
import { useAuth } from "@/lib/auth/auth";
import { checkMySignals, listMySignals } from "@/lib/signals/signals.functions";
import { formatPrice } from "@/lib/mock/data";
import type { TradingSignal } from "@/lib/mock/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historique des signaux — Smartrade" },
      {
        name: "description",
        content:
          "Consultez tous vos signaux passés : direction, niveaux, PnL, order flow et raisonnement IA détaillé.",
      },
      { property: "og:title", content: "Historique des signaux — Smartrade" },
      { property: "og:description", content: "Tous vos trades et leur analyse complète." },
    ],
  }),
  component: HistoryPage,
});

const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "active", label: "Actifs" },
  { id: "win", label: "Gagnants" },
  { id: "loss", label: "Perdants" },
] as const;

function HistoryPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [selected, setSelected] = useState<TradingSignal | null>(null);
  const { user, ready } = useAuth();
  const fetchSignals = useServerFn(listMySignals);
  const checkSignals = useServerFn(checkMySignals);
  const [checking, setChecking] = useState(false);
  const { data, isPending, refetch } = useQuery({
    queryKey: ["my-signals"],
    queryFn: () => fetchSignals(),
    enabled: ready && !!user,
  });

  const rows = useMemo(
    () =>
      (data?.signals ?? []).filter((s) => {
        if (filter === "active") return s.closed_at === null && s.status !== "cancelled";
        if (filter === "win") return (s.pnl_percent ?? 0) > 0;
        if (filter === "loss") return (s.pnl_percent ?? 0) < 0;
        return true;
      }),
    [data, filter],
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="label-mono">Historique</span>
            <h1 className="mt-2 text-3xl font-bold">Mes signaux</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PillGroup options={[...FILTERS]} value={filter} onChange={setFilter} />
            <button
              type="button"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                try {
                  const { updated } = await checkSignals({ data: undefined });
                  await refetch();
                  toast.success(
                    updated > 0
                      ? `${updated} signal${updated > 1 ? "s" : ""} mis à jour (TP / SL atteints)`
                      : "Aucun changement sur vos positions ouvertes",
                  );
                } catch {
                  toast.error("Vérification impossible pour le moment");
                } finally {
                  setChecking(false);
                }
              }}
              className="rounded-full border border-border bg-muted px-4 py-2 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground disabled:opacity-50"
            >
              {checking ? "Vérification…" : "Vérifier TP / SL"}
            </button>
          </div>
        </div>

        <div className="glass mt-6 overflow-x-auto p-2">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Date",
                  "Symbole",
                  "Direction",
                  "Mode",
                  "Entrée",
                  "SL",
                  "TP1",
                  "Conf.",
                  "PnL",
                  "Statut",
                ].map((h) => (
                  <th key={h} className="label-mono px-3 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="cursor-pointer border-b border-border/50 transition-colors duration-200 last:border-0 hover:bg-accent"
                >
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{s.symbol}</td>
                  <td
                    className="px-3 py-3 font-mono text-xs"
                    style={{
                      color: s.direction === "BUY" ? "var(--color-buy)" : "var(--color-sell)",
                    }}
                  >
                    {s.direction}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                    {s.trading_mode.replace("_", " ")}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{formatPrice(s.entry_price)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-sell">
                    {formatPrice(s.stop_loss)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-buy">
                    {formatPrice(s.take_profit_1)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{s.confidence_score}</td>
                  <td className="px-3 py-3">
                    <PnlText value={s.pnl_percent} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-3 py-10 text-center font-mono text-xs text-muted-foreground">
              {!ready
                ? "Chargement…"
                : !user
                  ? "Connectez-vous pour voir votre historique."
                  : isPending
                    ? "Chargement de vos signaux…"
                    : "Aucun signal pour l'instant — générez votre premier signal depuis le dashboard."}
            </p>
          )}
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          Cliquez sur une ligne pour ouvrir l'analyse complète du signal.
        </p>
      </main>
      <SignalDetailModal signal={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
