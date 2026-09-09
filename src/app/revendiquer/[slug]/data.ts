import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Ce que la page de revendication montre du lieu avant de rien demander.
 *
 * Lecture en clé de service et non avec la clé anonyme : la page s'adresse à
 * un visiteur non connecté, et le compte d'événements comme la présence d'une
 * adresse de contact ne franchissent pas la RLS publique. Rien de ce qui est
 * renvoyé ici n'est confidentiel — le nom, l'adresse postale et le site du
 * lieu sont déjà publics, et l'adresse de contact n'est PAS renvoyée, seule sa
 * présence l'est.
 */
export interface ClaimTarget {
  name: string;
  slug: string;
  address: string | null;
  website: string | null;
  /** Nombre d'événements à venir déjà repris sur casaminga.com. */
  nbEvenements: number;
  /** Vrai si le lieu a publié une adresse de contact : la vérification sera
   *  alors automatique, et la page doit le dire avant le formulaire. */
  verifiable: boolean;
  /** Pourquoi la revendication est impossible, le cas échéant. */
  refus: "inconnu" | "reseau" | "deja_revendique" | null;
  /** Titre de l'événement d'où vient le visiteur, s'il est bien de ce lieu. */
  eventTitre: string | null;
  eventId: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function loadClaimTarget(
  slug: string,
  eventId: string | null
): Promise<ClaimTarget | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) return null;

  const admin = createServiceClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: org } = await admin
    .from("organizations")
    .select("id, slug, name, address, website, email, source, claimed_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) {
    return {
      name: slug,
      slug,
      address: null,
      website: null,
      nbEvenements: 0,
      verifiable: false,
      refus: "inconnu",
      eventTitre: null,
      eventId: null,
    };
  }

  const refus: ClaimTarget["refus"] =
    org.source === "casaminga" ? "reseau" : org.claimed_at ? "deja_revendique" : null;

  const { count } = await admin
    .from("evenements")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .gte("start_at", new Date().toISOString());

  let eventTitre: string | null = null;
  let eventOk: string | null = null;
  if (eventId) {
    const { data: ev } = await admin
      .from("evenements")
      .select("id, title")
      .eq("id", eventId)
      .eq("organization_id", org.id)
      .maybeSingle();
    if (ev) {
      eventTitre = ev.title;
      eventOk = ev.id;
    }
  }

  return {
    name: org.name,
    slug: org.slug,
    address: org.address,
    website: org.website,
    nbEvenements: count ?? 0,
    verifiable: EMAIL_RE.test((org.email ?? "").trim()),
    refus,
    eventTitre,
    eventId: eventOk,
  };
}
