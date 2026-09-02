import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RotateCcw, ShieldCheck, Trash2, Users, Eye } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { PnlText, StatusBadge } from "@/components/status";
import { useAuth } from "@/lib/auth/auth";
import {
  addBonusSignals,
  deleteUser,
  getAdminOverview,
  resetUserUsage,
  setUserRole,
  setUserTier,
} from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Smartrade" },
      {
        name: "description",
        content:
          "Panneau d'administration Smartrade : statistiques globales, gestion des utilisateurs et signaux récents.",
      },
      { property: "og:title", content: "Administration — Smartrade" },
      { property: "og:description", content: "Statistiques globales et gestion des comptes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const fetchOverview = useServerFn(getAdminOverview);
  const changeTier = useServerFn(setUserTier);
  const resetUsage = useServerFn(resetUserUsage);
  const addBonus = useServerFn(addBonusSignals);
  const removeUser = useServerFn(deleteUser);
  const changeRole = useServerFn(setUserRole);

  const { data, refetch } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    enabled: ready && !!user?.is_admin,
  });

  const users = data?.users ?? [];
  const stats = data?.stats ?? { users: 0, premium: 0, signals_today: 0, signals_total: 0, mrr: 0 };
  const recent = data?.recent ?? [];

  const rows = useMemo(
    () =>
      users.filter((u) => (u.email + u.name).toLowerCase().includes(search.trim().toLowerCase())),
    [users, search],
  );

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      await refetch();
      toast.success(message);
    } catch (error) {
      toast.error((error as Error).message || "Action impossible.");
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Accès réservé</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {ready
              ? "Cette page est réservée aux comptes ayant le rôle administrateur."
              : "Vérification de vos droits…"}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <div>
          <span className="label-mono">Administration</span>
          <h1 className="mt-2 text-3xl font-bold">Vue globale</h1>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Utilisateurs"
            value={`${stats.users}`}
            icon={Users}
            hint={`${stats.premium} Pro`}
          />
          <StatCard label="Signaux aujourd'hui" value={`${stats.signals_today}`} icon={Plus} />
          <StatCard label="Signaux au total" value={`${stats.signals_total}`} icon={Eye} />
          <StatCard
            label="MRR"
            value={`${stats.mrr} €`}
            icon={RotateCcw}
            color="var(--color-buy)"
          />
        </section>

        <section className="glass p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="label-mono">Utilisateurs</span>
            <input
              value={search}
              maxLength={80}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un email ou un nom"
              className="w-64 rounded-xl border border-border bg-muted px-4 py-2 font-mono text-xs outline-none transition-colors duration-200 focus:border-brand"
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-border">
                  {["Nom", "Email", "Plan", "Signaux", "Rôle", "Inscrit le", "Actions"].map((h) => (
                    <th key={h} className="label-mono px-3 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-3 font-mono text-xs">{u.name}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          void run(
                            () =>
                              changeTier({
                                data: {
                                  userId: u.id,
                                  tier: u.tier === "premium" ? "free" : "premium",
                                },
                              }),
                            `Plan de ${u.name} modifié`,
                          )
                        }
                        title={
                          u.tier === "premium"
                            ? "Repasser ce compte en Free (3 signaux/jour)"
                            : "Passer ce compte en Pro (signaux illimités)"
                        }
                        className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-widest uppercase ${u.tier === "premium" ? "brand-gradient text-white" : "bg-muted text-muted-foreground"}`}
                      >
                        {u.tier === "premium" ? "premium · illimité" : "free"}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {u.signals_used_today} / {u.tier === "premium" ? "∞" : u.signals_limit}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          void run(
                            () => changeRole({ data: { userId: u.id, makeAdmin: !u.is_admin } }),
                            u.is_admin
                              ? `Accès admin retiré à ${u.name}`
                              : `${u.name} est maintenant administrateur`,
                          )
                        }
                        title={u.is_admin ? "Retirer l'accès admin" : "Donner l'accès admin"}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-widest uppercase ${u.is_admin ? "bg-brand/25 text-brand-text" : "bg-muted text-muted-foreground"}`}
                      >
                        <ShieldCheck className="h-3 w-3" /> {u.is_admin ? "admin" : "user"}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label="Réinitialiser le compteur"
                          onClick={() =>
                            void run(
                              () => resetUsage({ data: { userId: u.id } }),
                              "Compteur réinitialisé",
                            )
                          }
                          className="rounded-lg bg-muted p-2 text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Ajouter 5 signaux bonus"
                          onClick={() =>
                            void run(
                              () => addBonus({ data: { userId: u.id, amount: 5 } }),
                              `5 signaux bonus ajoutés à ${u.name}`,
                            )
                          }
                          className="rounded-lg bg-muted p-2 text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Supprimer"
                          onClick={() =>
                            void run(
                              () => removeUser({ data: { userId: u.id } }),
                              "Utilisateur supprimé",
                            )
                          }
                          className="rounded-lg bg-muted p-2 text-muted-foreground hover:text-sell"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="px-3 py-10 text-center font-mono text-xs text-muted-foreground">
                Aucun utilisateur trouvé.
              </p>
            )}
          </div>
        </section>

        <section className="glass p-5">
          <span className="label-mono">Signaux récents (tous les comptes)</span>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5"
              >
                <div>
                  <p className="font-mono text-xs">{s.symbol}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("fr-FR")} · conf {s.confidence_score}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PnlText value={s.pnl_percent} />
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
