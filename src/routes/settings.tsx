import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, BadgeCheck, Bell, Check, Palette, User } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { PillGroup } from "@/components/PillGroup";
import { useAuth } from "@/lib/auth/auth";
import { TRADING_MODES } from "@/lib/mock/data";
import type { TradingMode } from "@/lib/mock/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — Smartrade" },
      {
        name: "description",
        content: "Gérez votre profil, votre abonnement Pro et vos préférences de trading.",
      },
      { property: "og:title", content: "Paramètres — Smartrade" },
      { property: "og:description", content: "Profil, abonnement et notifications." },
    ],
  }),
  component: SettingsPage,
});

const EVENTS = [
  { id: "new_signal", label: "Nouveau signal" },
  { id: "signal_closed", label: "Signal clôturé" },
  { id: "alert_triggered", label: "Alerte déclenchée" },
] as const;

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl bg-muted px-4 py-3 transition-colors duration-200 hover:bg-accent"
    >
      <span className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
        {label}
      </span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${checked ? "bg-brand" : "bg-white/10"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 ${checked ? "left-4.5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function SettingsPage() {
  const { user, update } = useAuth();
  const [mode, setMode] = useState<TradingMode>("day_trading");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1100px] space-y-4 px-4 py-8 sm:px-6">
        <div>
          <span className="label-mono">Compte</span>
          <h1 className="mt-2 text-3xl font-bold">Paramètres</h1>
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="glass p-5">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-brand-text" />
              <span className="label-mono">Profil</span>
            </div>
            <dl className="mt-4 space-y-3">
              <div className="flex justify-between">
                <dt className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
                  Nom
                </dt>
                <dd className="font-mono text-sm">{user?.name ?? "Invité"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
                  Email
                </dt>
                <dd className="font-mono text-sm">{user?.email ?? "non connecté"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
                  Signaux aujourd'hui
                </dt>
                <dd className="font-mono text-sm">
                  {user ? `${user.signals_used_today} / ${user.signals_limit}` : "—"}
                </dd>
              </div>
            </dl>
            {!user && (
              <Link
                to="/login"
                className="mt-5 block rounded-full border border-border bg-muted py-2.5 text-center font-mono text-[11px] tracking-widest uppercase"
              >
                Se connecter
              </Link>
            )}
          </div>

          <div className="glass glow-brand border-brand/30 p-5">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-brand-text" />
              <span className="label-mono">Abonnement</span>
            </div>
            <p className="mt-4 font-mono text-2xl font-semibold">
              {user?.subscription_tier === "premium" ? "Pro — 29 €/mois" : "Free"}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {["Signaux illimités", "Suivi automatique TP / SL", "Order flow complet"].map((i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-buy" /> {i}
                </li>
              ))}
            </ul>
            {user?.subscription_tier === "premium" ? (
              <p className="mt-5 font-mono text-[11px] text-muted-foreground">
                Abonnement actif — renouvellement le 18/09/2026.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  toast.info("Redirection vers le paiement sécurisé…");
                  void update({ subscription_tier: "premium" });
                  toast.success("Compte Pro activé (démo)");
                }}
                className="brand-gradient mt-5 w-full rounded-full py-3 font-mono text-xs tracking-widest uppercase text-white transition-opacity duration-200 hover:opacity-90"
              >
                Passer Pro — 29 €/mois
              </button>
            )}
          </div>
        </section>

        <section className="glass p-5">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-brand-text" />
            <span className="label-mono">Préférences de trading</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div>
              <span className="label-mono">Mode par défaut</span>
              <div className="mt-2">
                <PillGroup options={TRADING_MODES} value={mode} onChange={setMode} />
              </div>
            </div>
            <div>
              <span className="label-mono">Stratégie par défaut</span>
              <div className="mt-2">
                <PillGroup
                  options={[
                    { id: "ict_smc", label: "ICT / SMC" },
                    { id: "order_flow", label: "Order flow" },
                  ]}
                  value="ict_smc"
                  onChange={() => toast.info("Stratégie ICT/SMC conservée en démo")}
                />
              </div>
            </div>
            <div>
              <span className="label-mono">Apparence</span>
              <div className="mt-2">
                <PillGroup
                  options={[
                    { id: "dark", label: "Dark" },
                    { id: "light", label: "Light" },
                  ]}
                  value="dark"
                  onChange={() => toast.info("Le thème clair arrive bientôt")}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="glass p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-text" />
              <span className="label-mono">Suivi des positions</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Chaque signal ouvert est rejoué automatiquement sur les bougies réelles à chaque
              consultation de votre historique : take profits et stop loss sont détectés, le statut
              et le PnL sont mis à jour sans intervention de votre part.
            </p>
            <Link
              to="/history"
              className="mt-5 inline-block rounded-full border border-border bg-muted px-5 py-2.5 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Voir mon historique
            </Link>
          </div>

          <div className="glass p-5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-text" />
              <span className="label-mono">Notifications</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Les alertes Telegram et email ne sont pas encore actives. Elles arriveront une fois le
              suivi des positions basculé côté serveur, en tâche de fond.
            </p>
            <p className="mt-3 font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
              En développement
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
