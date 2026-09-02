import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BellRing,
  BookOpen,
  Download,
  Gauge,
  History,
  Loader2,
  Percent,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { DepthChart } from "@/components/DepthChart";
import { MarketTicker } from "@/components/MarketTicker";
import { Navbar } from "@/components/Navbar";
import { PillGroup } from "@/components/PillGroup";
import { SignalCard } from "@/components/SignalCard";
import { StatCard } from "@/components/StatCard";
import { TimeframePanel } from "@/components/TimeframePanel";
import { PnlText, StatusBadge } from "@/components/status";
import { useQuotes } from "@/lib/market/hooks";
import { useAuth } from "@/lib/auth/auth";
import { generateSignal, listMySignals } from "@/lib/signals/signals.functions";
import { buildDetailedStats } from "@/lib/signals/derive";
import { CATEGORIES, SYMBOLS, TRADING_MODES, formatPrice } from "@/lib/mock/data";
import type { MarketCategory, TradingMode, TradingSignal } from "@/lib/mock/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Smartrade" },
      {
        name: "description",
        content:
          "Générez un signal de trading IA : sélection du marché, du symbole et du mode, order flow et analyse multi-timeframe en direct.",
      },
      { property: "og:title", content: "Dashboard — Smartrade" },
      {
        property: "og:description",
        content: "Génération de signaux IA avec order flow et ICT/SMC.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [category, setCategory] = useState<MarketCategory>("crypto");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [mode, setMode] = useState<TradingMode>("day_trading");
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, ready, refresh } = useAuth();
  const requestSignal = useServerFn(generateSignal);
  const fetchSignals = useServerFn(listMySignals);
  const queryClient = useQueryClient();
  const symbols = SYMBOLS[category];
  const categorySymbols = useMemo(() => symbols.map((s) => s.symbol), [symbols]);
  const { data: quotes, isPending: quotesPending } = useQuotes(categorySymbols);
  const { data: mine } = useQuery({
    queryKey: ["my-signals"],
    queryFn: () => fetchSignals(),
    enabled: ready && !!user,
  });

  // Real market quotes only — no simulated fallback.
  const live = quotes?.quotes.find((q) => q.symbol === symbol);
  const priceOf = (s: string) => quotes?.quotes.find((q) => q.symbol === s)?.price;
  const mySignals = mine?.signals ?? [];
  const recent = mySignals.slice(0, 6);
  const stats = useMemo(() => buildDetailedStats(mySignals), [mySignals]);
  const current = signal ?? mySignals[0] ?? null;

  const generate = async () => {
    if (!user) {
      toast.error("Connectez-vous pour générer un signal.");
      return;
    }
    setLoading(true);
    toast.info("Analyse IA multi-timeframe et order flow en cours…");
    try {
      const result = await requestSignal({ data: { symbol, mode } });
      if (result.error || !result.signal) {
        toast.error(result.error?.message ?? "Analyse impossible.");
        return;
      }
      setSignal(result.signal);
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["my-signals"] })]);
      toast.success(`Signal IA généré sur ${symbol}`);
    } catch (error) {
      toast.error((error as Error).message || "Analyse impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <MarketTicker />

        <Link
          to="/guide"
          className="glass flex flex-wrap items-center justify-between gap-3 p-4 transition-colors duration-200 hover:border-brand"
        >
          <span className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-brand" />
            <span className="text-sm">
              <span className="font-semibold">Mode d'emploi & règles d'entrée</span>
              <span className="block text-xs text-muted-foreground">
                Confiance ≥ 75 % = entrée normale · risque 1 % · sorties 50/25/25
              </span>
            </span>
          </span>
          <span className="font-mono text-xs tracking-widest uppercase text-brand">
            Ouvrir le guide →
          </span>
        </Link>

        <section className="glass p-5">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="space-y-4">
              <div>
                <span className="label-mono">Marché</span>
                <div className="mt-2">
                  <PillGroup
                    options={CATEGORIES}
                    value={category}
                    onChange={(id) => {
                      setCategory(id);
                      setSymbol(SYMBOLS[id][0]!.symbol);
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-5">
                <div>
                  <label htmlFor="symbol" className="label-mono">
                    Symbole
                  </label>
                  <select
                    id="symbol"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="mt-2 block rounded-xl border border-border bg-muted px-4 py-2.5 font-mono text-sm outline-none transition-colors duration-200 focus:border-brand"
                  >
                    {symbols.map((s) => (
                      <option key={s.symbol} value={s.symbol} className="bg-popover">
                        {s.symbol} — {s.label}
                        {priceOf(s.symbol) !== undefined
                          ? ` · ${formatPrice(priceOf(s.symbol)!)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label-mono">Prix actuel</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    {live ? (
                      <>
                        <span className="font-mono text-xl font-semibold tabular-nums">
                          {formatPrice(live.price)}
                        </span>
                        <span
                          className="font-mono text-xs"
                          style={{
                            color: live.change_24h >= 0 ? "var(--color-buy)" : "var(--color-sell)",
                          }}
                        >
                          {live.change_24h >= 0 ? "+" : ""}
                          {live.change_24h.toFixed(2)}%
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-sm text-muted-foreground">
                        {quotesPending ? "chargement…" : "indisponible"}
                      </span>
                    )}
                  </div>
                  {live ? (
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      temps réel ·{" "}
                      {live.provider === "twelvedata"
                        ? "Twelve Data"
                        : live.provider === "yahoo"
                          ? "Yahoo"
                          : live.provider === "spot"
                            ? "spot métaux"
                            : "spot crypto"}
                      {" · maj "}
                      {new Date(live.ts).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}
                    </div>
                  ) : null}
                </div>
                <div>
                  <span className="label-mono">Mode</span>
                  <div className="mt-2">
                    <PillGroup options={TRADING_MODES} value={mode} onChange={setMode} />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="brand-gradient glow-brand flex items-center gap-2 rounded-full px-6 py-3.5 font-mono text-xs tracking-widest uppercase text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Analyse…" : "Générer signal"}
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Win rate"
            value={`${stats.win_rate} %`}
            icon={Percent}
            hint={`${mySignals.filter((s) => s.pnl_percent !== null).length} trades clôturés`}
            color="var(--color-buy)"
          />
          <StatCard
            label="PnL total"
            value={`${stats.total_pnl > 0 ? "+" : ""}${stats.total_pnl} %`}
            icon={TrendingUp}
            hint="sur vos signaux"
            color={stats.total_pnl >= 0 ? "var(--color-buy)" : "var(--color-sell)"}
          />
          <StatCard
            label="Confiance moyenne"
            value={`${stats.avg_confidence}`}
            icon={Gauge}
            hint="score IA sur 100"
            color="var(--color-confidence)"
          />
          <StatCard
            label="Signaux aujourd'hui"
            value={user ? `${user.signals_used_today} / ${user.signals_limit}` : "—"}
            icon={Zap}
            hint={`${stats.total_signals} au total`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {current ? (
              <>
                <SignalCard signal={current} />
                <TimeframePanel items={current.timeframe_analysis} />
              </>
            ) : (
              <div className="glass p-10 text-center">
                <p className="font-mono text-sm text-muted-foreground">
                  {user
                    ? "Aucun signal encore : choisissez un symbole et lancez l'analyse IA."
                    : "Connectez-vous pour générer vos signaux IA."}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4 lg:col-span-4">
            <div className="glass p-5">
              <span className="label-mono">Trades récents</span>
              <div className="mt-3 space-y-2">
                {recent.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5"
                  >
                    <div>
                      <p className="font-mono text-xs">{s.symbol}</p>
                      <p
                        className="font-mono text-[10px] tracking-widest uppercase"
                        style={{
                          color: s.direction === "BUY" ? "var(--color-buy)" : "var(--color-sell)",
                        }}
                      >
                        {s.direction}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PnlText value={s.pnl_percent} />
                      <StatusBadge status={s.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DepthChart symbol={symbol} />

            <div className="glass p-5">
              <span className="label-mono">Actions rapides</span>
              <div className="mt-3 grid gap-2">
                <Link
                  to="/history"
                  className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <History className="h-3.5 w-3.5" /> Historique complet
                </Link>
                <Link
                  to="/stats"
                  className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Statistiques détaillées
                </Link>
                <Link
                  to="/guide"
                  className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Mode d'emploi & règles
                </Link>
                <button
                  type="button"
                  onClick={() => toast.success("Alerte de prix créée sur " + symbol)}
                  className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <BellRing className="h-3.5 w-3.5" /> Créer une alerte
                </button>
                <button
                  type="button"
                  onClick={() => toast.success("Export CSV préparé")}
                  className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" /> Exporter mes trades
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
