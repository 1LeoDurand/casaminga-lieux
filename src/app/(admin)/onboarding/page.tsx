import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { OnboardingForm } from "./onboarding-form";

/**
 * Page de récupération / finalisation d'espace.
 *
 * Destinée aux comptes AUTHENTIFIÉS mais rattachés à aucun espace
 * (inscription interrompue, ou échec de création de l'org au signup).
 * La page login y redirige ces comptes au lieu de les envoyer vers une
 * org démo dont ils ne sont pas membres (ce qui produisait un faux
 * « accès refusé »).
 *
 * Garde :
 *  - non connecté          → /login?redirect=/onboarding
 *  - déjà membre d'un lieu → /dashboard/<son lieu> (rien à finaliser)
 *  - sinon                 → formulaire de création d'espace
 */
export default async function OnboardingPage() {
  // En démo (pas de backend), l'onboarding n'a pas lieu d'être.
  if (!isSupabaseConfigured()) redirect("/login");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/onboarding");

  // Déjà rattaché à un espace ? On l'y emmène directement.
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organizations(slug)")
    .eq("user_id", user.id)
    .eq("status", "actif")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const org = membership?.organizations as unknown as { slug: string } | null;
  if (org?.slug) redirect(`/dashboard/${org.slug}`);

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <OnboardingForm
      userId={user.id}
      email={user.email ?? ""}
      fullName={fullName}
    />
  );
}
