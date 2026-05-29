import { NextResponse } from "next/server";
import { createRequest, getOrganizationBySlug, getPublicSiteBySlug } from "@/lib/data";

/**
 * Réception d'une demande depuis un site public.
 * POST /api/orgs/[slug]/requests
 *
 * Résout l'organisation depuis le slug, vérifie que le site est publié,
 * puis insère une ligne dans `requests` (liée à organization_id).
 * Aucune clé service_role : Supabase est appelé côté serveur via le client
 * anon, l'insertion publique est autorisée par la policy RLS
 * `requests_insert_from_public_site` (site publié). Fallback démo sinon.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const type = String(body.type ?? "contact").trim() || "contact";
  const phone = String(body.phone ?? "").trim() || null;
  const organization_ext = String(body.structure ?? "").trim() || null;

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Nom, email et message sont requis." },
      { status: 400 }
    );
  }
  if (!/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  const [org, site] = await Promise.all([
    getOrganizationBySlug(slug),
    getPublicSiteBySlug(slug),
  ]);
  if (!org || !site) {
    return NextResponse.json({ error: "Lieu introuvable." }, { status: 404 });
  }

  const created = await createRequest({
    organization_id: org.id,
    name,
    email,
    phone,
    organization_ext,
    type,
    message,
  });

  if (!created) {
    return NextResponse.json(
      { error: "L'enregistrement a échoué. Réessayez." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
