import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Smartrade" },
      {
        name: "description",
        content: "Connectez-vous à Smartrade pour accéder à vos signaux de trading IA.",
      },
      { property: "og:title", content: "Connexion — Smartrade" },
      { property: "og:description", content: "Accédez à vos signaux de trading IA." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <div className="glass p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Connexion</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Accédez à vos signaux, votre historique et vos statistiques.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email.includes("@") || password.length < 6) {
                toast.error("Email invalide ou mot de passe trop court (6 caractères min).");
                return;
              }
              setBusy(true);
              const { error } = await signIn(email, password);
              setBusy(false);
              if (error) {
                toast.error(
                  error.includes("Invalid login credentials")
                    ? "Email ou mot de passe incorrect."
                    : error,
                );
                return;
              }
              toast.success("Connexion réussie");
              void navigate({ to: "/dashboard" });
            }}
          >
            <div>
              <label htmlFor="email" className="label-mono">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                maxLength={255}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-muted px-4 py-3 font-mono text-sm outline-none transition-colors duration-200 focus:border-brand"
                placeholder="vous@exemple.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="label-mono">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                maxLength={128}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-muted px-4 py-3 font-mono text-sm outline-none transition-colors duration-200 focus:border-brand"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="brand-gradient glow-brand w-full rounded-full py-3 font-mono text-xs tracking-widest uppercase text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { error } = await signInWithGoogle();
              setBusy(false);
              if (error) toast.error(error);
            }}
            className="mt-3 w-full rounded-full border border-border bg-muted py-3 font-mono text-[11px] tracking-widest uppercase text-muted-foreground transition-colors duration-200 hover:text-foreground disabled:opacity-60"
          >
            Continuer avec Google
          </button>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-brand-text">
              Créer un compte
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
