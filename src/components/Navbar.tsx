import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth/auth";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/stats", label: "Statistiques" },
  { to: "/history", label: "Historique" },
  { to: "/settings", label: "Paramètres" },
] as const;

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="brand-gradient glow-brand flex h-8 w-8 items-center justify-center rounded-xl font-mono text-xs font-bold text-white">
            S
          </span>
          <span className="brand-text-gradient font-display text-lg font-black tracking-tight">
            Smartrade
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {user &&
            LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-wide uppercase text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-brand/25 text-brand-text" }}
              >
                {l.label}
              </Link>
            ))}

          <Link
            to="/guide"
            className="rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-wide uppercase text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
            activeProps={{ className: "bg-brand/25 text-brand-text" }}
          >
            Guide
          </Link>

          {user?.is_admin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-wide uppercase text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-brand/25 text-brand-text" }}
            >
              <ShieldCheck className="h-3 w-3" /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden font-mono text-[11px] tracking-wide text-muted-foreground sm:inline">
                {user.email}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 font-mono text-[10px] tracking-widest uppercase",
                  user.subscription_tier === "premium"
                    ? "brand-gradient text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {user.subscription_tier}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  void navigate({ to: "/" });
                }}
                aria-label="Se déconnecter"
                className="rounded-full p-2 text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-wide uppercase text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="brand-gradient glow-brand rounded-full px-4 py-2 font-mono text-[11px] tracking-wide uppercase text-white"
              >
                S'inscrire
              </Link>
            </>
          )}
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full p-2 text-muted-foreground transition-colors duration-200 hover:bg-accent md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden">
          {user &&
            LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 font-mono text-[11px] tracking-wide uppercase text-muted-foreground hover:bg-accent"
              >
                {l.label}
              </Link>
            ))}

          <Link
            to="/guide"
            onClick={() => setOpen(false)}
            className="rounded-xl px-3 py-2 font-mono text-[11px] tracking-wide uppercase text-muted-foreground hover:bg-accent"
          >
            Guide
          </Link>

          {user?.is_admin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 font-mono text-[11px] tracking-wide uppercase text-muted-foreground hover:bg-accent"
            >
              Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
