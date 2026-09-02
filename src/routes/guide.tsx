import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  Gauge,
  LineChart,
  ShieldAlert,
  Target,
  TriangleAlert,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Mode d'emploi & règles d'entrée — Smartrade" },
      {
        name: "description",
        content:
          "Guide complet Smartrade : comment générer un signal IA, lire la carte de signal, et les règles d'entrée (confiance > 75 %, order flow confirmé, gestion du risque).",
      },
      { property: "og:title", content: "Mode d'emploi & règles d'entrée — Smartrade" },
      {
        property: "og:description",
        content:
          "Apprenez à utiliser Smartrade : génération de signaux, lecture des niveaux, checklist d'entrée et money management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuidePage,
});

const STEPS = [
  {
    title: "1. Choisissez le marché",
    body: "Crypto, Forex, Matières premières ou Indices. Les cours affichés sont réels et rafraîchis en continu — aucune donnée simulée.",
  },
  {
    title: "2. Sélectionnez le symbole",
    body: "Le prix courant et la variation 24 h s'affichent à côté du sélecteur. Vérifiez que le marché est ouvert (Forex/Indices : hors week-end).",
  },
  {
    title: "3. Choisissez le mode",
    body: "Scalping (minutes/heures), Day trading (intraday), Swing (plusieurs jours). Le mode change les timeframes analysés et l'amplitude des objectifs.",
  },
  {
    title: "4. Générez le signal",
    body: "L'IA analyse la structure ICT/SMC (BOS, FVG, POI), le multi-timeframe et l'order flow, puis renvoie entrée, stop loss et 3 take profits.",
  },
  {
    title: "5. Suivez et archivez",
    body: "Chaque signal est enregistré. Historique et Statistiques calculent votre win rate et votre PnL réels.",
  },
];

const READ = [
  {
    icon: Gauge,
    title: "Score de confiance",
    body: "Note IA sur 100 combinant alignement multi-timeframe, qualité de la structure et order flow. C'est le premier filtre à regarder.",
  },
  {
    icon: Target,
    title: "Entrée / SL / TP1-2-3",
    body: "Le pourcentage à droite de chaque niveau indique la distance depuis l'entrée. Un bon signal a un TP1 au moins égal à 1× le risque du stop.",
  },
  {
    icon: LineChart,
    title: "Order flow",
    body: '"Confirme" = le carnet et les flux vont dans le sens du signal. "Contredit" = attendre, même si le score est élevé.',
  },
  {
    icon: BookOpen,
    title: "Analyse multi-timeframe",
    body: "Tendance, structure, niveaux clés et zones FVG par unité de temps. Un alignement 4 h + 1 h dans le même sens renforce fortement le signal.",
  },
];

const RULES = [
  "Confiance ≥ 75 % : entrée normale. Entre 60 et 74 % : demi-position seulement. En dessous de 60 % : on ne prend pas.",
  "Order flow obligatoire : n'entrez que si l'order flow confirme la direction avec une force « moyenne » ou « forte ».",
  "Alignement des timeframes : au moins deux unités de temps supérieures doivent partager la même tendance que le signal.",
  "Risque fixe : 1 % du capital par trade maximum (2 % si confiance ≥ 85 % et order flow fort). Jamais plus.",
  "Ratio minimum : refusez le trade si la distance entrée → TP1 est inférieure à la distance entrée → stop loss.",
  "Stop loss toujours placé au marché, jamais mental, et jamais élargi après l'entrée.",
  "Sécurisation : sortez 50 % à TP1, déplacez le stop à l'entrée (break-even), 25 % à TP2, laissez courir 25 % jusqu'à TP3.",
  "Évitez les 15 minutes avant/après une annonce macro majeure (CPI, FOMC, NFP) et les week-ends sur le Forex.",
  "Maximum 3 positions ouvertes simultanément, et pas deux fois le même sous-jacent (BTC + ETH = corrélation).",
  "Stop journalier : après 2 pertes consécutives ou -3 % sur la journée, on arrête de trader.",
  "Un avertissement marché affiché sur la carte = volatilité anormale : réduisez la taille de moitié ou passez votre tour.",
];

function GuidePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <header className="mx-auto max-w-2xl text-center">
          <span className="label-mono">Mode d'emploi</span>
          <h1 className="mt-3 font-display text-3xl font-black tracking-tight sm:text-4xl">
            Comment utiliser Smartrade
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            De la génération d'un signal IA jusqu'à la gestion de la position : le déroulé complet,
            la lecture des indicateurs et les règles d'entrée à respecter.
          </p>
        </header>

        <section className="glass p-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand-text" />
            <span className="label-mono">Parcours en 5 étapes</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.title} className="rounded-2xl bg-muted p-4">
                <p className="font-mono text-xs tracking-wide text-brand-text">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {READ.map((r) => (
            <div key={r.title} className="glass p-5">
              <div className="flex items-center gap-2">
                <r.icon className="h-4 w-4 text-brand-text" />
                <span className="label-mono">{r.title}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </section>

        <section className="glass p-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-brand-text" />
            <span className="label-mono">Règles d'entrée & money management</span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {RULES.map((rule) => (
              <li key={rule} className="flex items-start gap-3 rounded-2xl bg-muted px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-buy" />
                <span className="text-sm leading-relaxed text-muted-foreground">{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass p-6">
          <span className="label-mono">Grille de décision rapide</span>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                    Confiance
                  </th>
                  <th className="pb-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                    Order flow
                  </th>
                  <th className="pb-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                    Action
                  </th>
                  <th className="pb-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                    Risque
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {[
                  ["≥ 85", "Confirme (fort)", "Entrée pleine", "2 %", "var(--color-buy)"],
                  ["75 – 84", "Confirme", "Entrée normale", "1 %", "var(--color-buy)"],
                  ["60 – 74", "Confirme", "Demi-position", "0,5 %", "var(--color-confidence)"],
                  ["< 60", "Peu importe", "On ne prend pas", "0 %", "var(--color-sell)"],
                  ["Peu importe", "Contredit", "On attend", "0 %", "var(--color-sell)"],
                ].map((row) => (
                  <tr
                    key={row[0] + String(row[1])}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-3">{row[0]}</td>
                    <td className="py-3 text-muted-foreground">{row[1]}</td>
                    <td className="py-3" style={{ color: row[4] }}>
                      {row[2]}
                    </td>
                    <td className="py-3 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass flex flex-wrap items-start gap-3 border border-confidence/30 p-5">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-confidence" />
          <p className="max-w-3xl text-sm leading-relaxed text-confidence">
            Smartrade fournit une aide à la décision, pas un conseil en investissement. Le trading
            comporte un risque de perte en capital. N'investissez que ce que vous pouvez perdre et
            testez toujours les règles ci-dessus en compte démo avant de passer en réel.
          </p>
        </section>

        <div className="flex justify-center">
          <Link
            to="/dashboard"
            className="brand-gradient glow-brand rounded-full px-6 py-3 font-mono text-xs tracking-widest uppercase text-white transition-opacity duration-200 hover:opacity-90"
          >
            Générer mon premier signal
          </Link>
        </div>
      </main>
    </div>
  );
}
