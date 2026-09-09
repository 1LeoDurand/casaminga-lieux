import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createRequest, getOrganizationBySlug, getPublicSiteBySlug } from "@/lib/data";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { sendMail, adminEmail } from "@/lib/mail";
import { orgAdminEmails } from "@/lib/portal/notify";
import { tplDemandeRecue, tplDemandeAlerteEquipe } from "@/lib/mail-templates";

/**
 * À qui l'alerte doit parvenir.
 *
 * Elle partait vers `adminEmail()`, une adresse unique pour toute la
 * plateforme : la demande d'un visiteur adressée à une médiathèque atterrissait
 * dans la boîte de Léo, et le lieu n'en savait rien. Tolérable tant que le
 * réseau tenait en quatorze lieux et que Léo faisait suivre à la main ; absurde
 * dès qu'un lieu reprend sa page en pensant justement recevoir ses demandes.
 *
 * Ordre : les administrateurs du lieu, puis l'adresse d'accueil qu'il a
 * publiée, puis seulement l'adresse de la plateforme. La dernière n'est plus
 * un destinataire, c'est un filet.
 */
async function destinatairesAlerte(orgId: string, orgEmail: string | null): Promise<string[]> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (SUPABASE_URL && serviceRoleKey) {
    try {
      const admin = createServiceClient(SUPABASE_URL, serviceRoleKey, {
        auth: { persistSession: false },
      });
      const emails = await orgAdminEmails(admin, orgId);
      if (emails.length > 0) return emails;
    } catch (e) {
      console.error("destinatairesAlerte: lecture des admins impossible", e);
    }
  }
  if (orgEmail && /.+@.+\..+/.test(orgEmail)) return [orgEmail];
  const global = adminEmail();
  return global ? [global] : [];
}

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

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com"}/dashboard/${slug}/demandes`;

  // Emails en parallèle — on n'attend pas qu'ils soient envoyés pour répondre
  void (async () => {
    const equipe = await destinatairesAlerte(org.id, org.email ?? null);
    await Promise.all([
      // Email au demandeur
      sendMail({
        to: email,
        subject: `✓ Votre demande a bien été reçue — ${org.name}`,
        html: tplDemandeRecue({ orgName: org.name, personName: name, type, message }),
      }),
      // Alerte équipe
      equipe.length
        ? sendMail({
            to: equipe,
            subject: `🔔 Nouvelle demande de ${name} — ${org.name}`,
            html: tplDemandeAlerteEquipe({
              orgName: org.name,
              orgSlug: slug,
              personName: name,
              personEmail: email,
              type,
              message,
              dashboardUrl,
            }),
            replyTo: email,
            organizationId: org.id,
          })
        : Promise.resolve(false),
    ]);
  })();

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
