"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

const DEMO_SLUG = "bernard-kohn";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Récupère l'url de redirection après connexion (ex: /dashboard/mon-lieu)
  const redirectTo = searchParams.get("redirect") ?? null;
  const authError = searchParams.get("error");

  // Session déjà active → inutile de remontrer le formulaire, on renvoie
  // directement vers l'espace d'administration (ou l'URL demandée).
  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      if (redirectTo) { router.replace(redirectTo); return; }
      const { data } = await supabase
        .from("organization_members")
        .select("organizations(slug)")
        .eq("user_id", user.id)
        .eq("status", "actif")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const org = data?.organizations as unknown as { slug: string } | null;
      router.replace(org?.slug ? `/dashboard/${org.slug}` : "/onboarding");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Si une URL de redirection est fournie, on l'utilise directement
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }

    // Sinon, trouver l'org du user et rediriger vers son dashboard
    const userId = data.user?.id;
    if (userId) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organizations(slug)")
        .eq("user_id", userId)
        .eq("status", "actif")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      const org = membership?.organizations as unknown as { slug: string } | null;
      const slug = org?.slug;
      if (slug) { router.push(`/dashboard/${slug}`); return; }
    }
    // Compte authentifié mais rattaché à AUCUN espace (inscription interrompue
    // ou échec de création de l'org). On l'envoie finaliser la création de son
    // espace — surtout pas vers l'org démo « bernard-kohn », dont il n'est pas
    // membre : c'est ce qui produisait le faux « accès refusé ».
    router.push("/onboarding");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md gap-6 p-8">
        <div className="text-center">
          <img src="/logo-icon.webp" alt="Casa Minga Lieux" className="mx-auto mb-3 size-14 object-contain" />
          <h1 className="font-heading text-2xl font-bold">Espace équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Casa Minga Lieux</p>
        </div>

        {authError === "unauthorized" && (
          <div className="rounded-xl border border-coral/30 bg-coral/10 p-4 text-sm text-coral-dark">
            Vous n'êtes pas membre de cet espace. Contactez votre administrateur.
          </div>
        )}

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
              <strong>Mode démo.</strong> L'authentification s'active une fois Supabase
              configuré (variables <code>.env.local</code>). En attendant, entrez
              directement dans la démo.
            </div>
            <Button
              asChild
              className="bg-coral text-white hover:bg-coral-dark"
            >
              <Link href={redirectTo ?? `/dashboard/${DEMO_SLUG}`}>Entrer dans la démo</Link>
            </Button>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          {configured && (
            <p>
              Pas encore de compte ?{" "}
              <Link href="/signup" className="font-semibold text-coral-dark hover:underline">
                Créer mon espace
              </Link>
            </p>
          )}
          <Link href="/" className="hover:text-coral-dark">
            ← Retour à l'accueil
          </Link>
        </div>
      </Card>
    </main>
  );
}

// Suspense requis pour useSearchParams dans un "use client"
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
