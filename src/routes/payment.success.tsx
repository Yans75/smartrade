import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth/auth";

export const Route = createFileRoute("/payment/success")({
  head: () => ({
    meta: [
      { title: "Paiement confirmé — Smartrade" },
      {
        name: "description",
        content: "Votre abonnement Smartrade Pro est actif : signaux illimités et alertes.",
      },
      { property: "og:title", content: "Paiement confirmé — Smartrade" },
      { property: "og:description", content: "Abonnement Pro activé." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentSuccessPage,
});

function PaymentSuccessPage() {
  const { update } = useAuth();
  const [status, setStatus] = useState<"checking" | "paid">("checking");

  useEffect(() => {
    const id = window.setTimeout(() => {
      void update({ subscription_tier: "premium" });
      setStatus("paid");
    }, 1200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-24">
        <div className="glass glow-brand p-8 text-center">
          {status === "checking" ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-text" />
              <h1 className="mt-6 text-2xl font-bold">Vérification du paiement…</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Nous confirmons votre session de paiement sécurisée.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-buy" />
              <h1 className="mt-6 text-2xl font-bold">Paiement confirmé</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Votre abonnement Pro est actif : signaux illimités, order flow complet et alertes
                Telegram.
              </p>
              <Link
                to="/dashboard"
                className="brand-gradient mt-8 block rounded-full py-3 font-mono text-xs tracking-widest uppercase text-white transition-opacity duration-200 hover:opacity-90"
              >
                Aller au dashboard
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
