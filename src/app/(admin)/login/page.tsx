"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

const DEMO_SLUG = "bernard-kohn";

export default function LoginPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/dashboard/${DEMO_SLUG}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md gap-6 p-8">
        <div className="text-center">
          <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-coral font-heading text-base font-extrabold text-white">
            CM
          </span>
          <h1 className="font-heading text-2xl font-bold">Espace équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Casa Minga Lieux</p>
        </div>

        {configured ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Mot de passe
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              />
            </label>
            {error ? <p className="text-sm text-coral-dark">{error}</p> : null}
            <Button
              type="submit"
              disabled={loading}
              className="bg-coral text-white hover:bg-coral-dark"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-golden/40 bg-golden/10 p-4 text-sm text-[#92400e]">
              <strong>Mode démo.</strong> L’authentification s’active une fois Supabase
              configuré (variables <code>.env.local</code>). En attendant, entrez
              directement dans la démo.
            </div>
            <Button
              asChild
              className="bg-coral text-white hover:bg-coral-dark"
            >
              <Link href={`/dashboard/${DEMO_SLUG}`}>Entrer dans la démo</Link>
            </Button>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-coral-dark">
            ← Retour à l’accueil
          </Link>
        </p>
      </Card>
    </main>
  );
}
