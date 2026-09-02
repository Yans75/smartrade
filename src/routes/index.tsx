import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BellRing,
  Check,
  Globe2,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { MarketTicker } from "@/components/MarketTicker";
import { SignalCard } from "@/components/SignalCard";
import { ACTIVE_SIGNAL } from "@/lib/mock/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smartrade — Signaux de trading IA ICT/SMC" },
      {
        name: "description",
        content:
          "Signaux d'achat et de vente générés par IA avec entrée, stop loss et take profits. ICT/SMC, order flow et multi-timeframe sur crypto, forex, matières premières et indices.",
      },
      { property: "og:title", content: "Smartrade — Signaux de trading IA ICT/SMC" },
      {
        property: "og:description",
        content: "3 signaux gratuits par jour. Analyse IA, order flow et ICT/SMC.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Layers,
    title: "Analyse multi-timeframe",
    text: "Structure de marché lue du 15m au daily : BOS, Fair Value Gaps, ATR et points d'intérêt calculés sur les vraies bougies avant chaque signal.",
  },
  {
    icon: Activity,
    title: "Order Flow",
    text: "Carnet d'ordres réel sur 100 niveaux en crypto (Binance / OKX). Sur forex, matières premières et indices, un proxy volumétrique clairement identifié comme tel.",
  },
  {
    icon: Globe2,
    title: "4 classes d'actifs",
    text: "Crypto, Forex, matières premières et indices boursiers — 36 instruments couverts en continu.",
  },
  {
    icon: BarChart3,
    title: "Statistiques réelles",
    text: "Win rate, PnL cumulé, performance par symbole et par mode de trading, export CSV de tout l'historique.",
  },
  {
    icon: BellRing,
    title: "Suivi automatique",
    text: "Chaque signal ouvert est rejoué sur les bougies réelles : TP et SL détectés, statut et PnL mis à jour sans intervention.",
  },
  {
    icon: ShieldCheck,
    title: "Garde-fou sur les niveaux",
    text: "Entrée, stop et take profits sont revalidés après l'IA : tout jeu de niveaux incohérent est recalculé sur l'ATR avant de vous être servi.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <section className="mx-auto grid max-w-6xl items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-brand-text">
              <Sparkles className="h-3 w-3" /> DeepSeek · ICT/SMC · Order Flow
            </span>
            <h1 className="mt-6 font-display text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Signaux de trading IA —{" "}
              <span className="brand-text-gradient">ICT/SMC + Order Flow</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Smartrade analyse les marchés en continu, croise la structure Smart Money avec le
              carnet d'ordres et livre des signaux prêts à exécuter : entrée, stop loss et trois
              take profits, avec le raisonnement complet en français.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="brand-gradient glow-brand rounded-full px-6 py-3 font-mono text-xs tracking-widest uppercase text-white transition-opacity duration-200 hover:opacity-90"
              >
                Commencer gratuitement
              </Link>
              <Link
                to="/dashboard"
                className="rounded-full border border-border bg-muted px-6 py-3 font-mono text-xs tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:border-white/15 hover:text-foreground"
              >
                Voir la démo
              </Link>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                { k: "Instruments", v: "36" },
                { k: "Timeframes", v: "4" },
                { k: "Signaux offerts / jour", v: "3" },
              ].map((s) => (
                <div key={s.k}>
                  <p className="font-mono text-xl font-semibold">{s.v}</p>
                  <p className="label-mono mt-1">{s.k}</p>
                </div>
              ))}
            </div>
          </div>
          <SignalCard signal={ACTIVE_SIGNAL} />
        </section>

        <div className="mx-auto max-w-6xl">
          <MarketTicker />
        </div>

        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="label-mono">Fonctionnalités</span>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Une lecture institutionnelle du marché
            </h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="glass glass-hover p-6">
                <f.icon className="h-5 w-5 text-brand-text" />
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="label-mono">Tarifs</span>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Commencez gratuitement</h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
            <div className="glass p-6">
              <h3 className="font-mono text-sm tracking-widest uppercase text-muted-foreground">
                Free
              </h3>
              <p className="mt-4 font-mono text-4xl font-semibold">0 €</p>
              <p className="label-mono mt-1">par mois</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {[
                  "3 signaux par jour",
                  "Crypto, forex, matières premières, indices",
                  "Analyse multi-timeframe",
                  "Historique et statistiques",
                ].map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-buy" /> {i}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-8 block rounded-full border border-border bg-muted py-3 text-center font-mono text-xs tracking-widest uppercase transition-colors duration-200 hover:border-white/15"
              >
                Créer un compte
              </Link>
            </div>
            <div className="glass glow-brand relative overflow-hidden border-brand/40 p-6">
              <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
              <h3 className="font-mono text-sm tracking-widest uppercase text-brand-text">Pro</h3>
              <p className="mt-4 font-mono text-4xl font-semibold">29 €</p>
              <p className="label-mono mt-1">par mois</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {[
                  "Signaux illimités",
                  "Order flow et depth chart complets",
                  "Suivi automatique des TP et SL",
                  "Statistiques détaillées et courbe de PnL",
                  "Export CSV de l'historique",
                ].map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-buy" /> {i}
                  </li>
                ))}
              </ul>
              <Link
                to="/settings"
                className="brand-gradient mt-8 block rounded-full py-3 text-center font-mono text-xs tracking-widest uppercase text-white transition-opacity duration-200 hover:opacity-90"
              >
                Passer Pro
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <p className="font-mono text-[11px] text-muted-foreground">
            © 2026 Smartrade. Le trading comporte un risque de perte en capital.
          </p>
          <div className="flex gap-4 font-mono text-[11px] text-muted-foreground">
            <Link to="/login">Connexion</Link>
            <Link to="/register">Inscription</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
