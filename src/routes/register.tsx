import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Créer un compte — Smartrade" },
      {
        name: "description",
        content: "Créez votre compte Smartrade et recevez 3 signaux de trading IA par jour.",
      },
      { property: "og:title", content: "Créer un compte — Smartrade" },
      { property: "og:description", content: "3 signaux IA gratuits par jour." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [busy, setBusy] = useState(false);

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div>
      <label htmlFor={key} className="label-mono">
        {label}
      </label>
      <input
        id={key}
        type={type}
        value={form[key]}
        maxLength={255}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-border bg-muted px-4 py-3 font-mono text-sm outline-none transition-colors duration-200 focus:border-brand"
      />
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <div className="glass p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Créer un compte</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            3 signaux gratuits par jour, sans carte bancaire.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                !form.email.includes("@") ||
                form.name.trim().length < 2 ||
                form.password.length < 6
              ) {
                toast.error(
                  "Vérifiez l'email, le nom (2 caractères min) et le mot de passe (6 min).",
                );
                return;
              }
              setBusy(true);
              const { error, needsConfirmation } = await signUp(
                form.email,
                form.password,
                form.name,
              );
              setBusy(false);
              if (error) {
                toast.error(
                  error.includes("already registered")
                    ? "Un compte existe déjà avec cet email."
                    : error,
                );
                return;
              }
              if (needsConfirmation) {
                toast.success("Compte créé — confirmez votre email pour vous connecter.");
                void navigate({ to: "/login" });
                return;
              }
              toast.success("Compte créé — bienvenue sur Smartrade");
              void navigate({ to: "/dashboard" });
            }}
          >
            {field("email", "Email", "email", "vous@exemple.com")}
            {field("name", "Nom", "text", "Jean Dupont")}
            {field("password", "Mot de passe", "password", "••••••••")}
            <button
              type="submit"
              disabled={busy}
              className="brand-gradient glow-brand w-full rounded-full py-3 font-mono text-xs tracking-widest uppercase text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Création…" : "Créer mon compte"}
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
            Déjà inscrit ?{" "}
            <Link to="/login" className="text-brand-text">
              Se connecter
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
