import { NextResponse } from "next/server";
import { createRequest, getOrganizationBySlug, getPublicSiteBySlug } from "@/lib/data";
import { sendMail, adminEmail } from "@/lib/mail";
import { tplDemandeRecue, tplDemandeAlerteEquipe } from "@/lib/mail-templates";

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
  void Promise.all([
    // Email au demandeur
    sendMail({
      to: email,
      subject: `✓ Votre demande a bien été reçue — ${org.name}`,
      html: tplDemandeRecue({ orgName: org.name, personName: name, type, message }),
    }),
    // Alerte équipe
    adminEmail()
      ? sendMail({
          to: adminEmail(),
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
        })
      : Promise.resolve(false),
  ]);

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
