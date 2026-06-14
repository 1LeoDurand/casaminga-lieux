import Link from "next/link";
import { verifyOptinToken } from "@/lib/newsletter/optin-token";
import { getOrganizationBySlug } from "@/lib/data";
import { createAdminClient } from "@/lib/admin/guard";
import { publicSiteUrl } from "@/lib/site-public/url";

export const dynamic = "force-dynamic";

/**
 * Confirmation d'inscription newsletter — étape 2/2 (double opt-in).
 * Vérifie le token signé, puis crée (ou ré-active) la fiche `persons` avec
 * `newsletter_opt_out=false` via le client service_role. Le résolveur de
 * destinataires de la newsletter la prend alors en compte.
 */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins', sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 32px rgba(28,28,28,0.08)", border: "1px solid #E5DDD6", textAlign: "center" }}>
        {children}
      </div>
    </main>
  );
}

export default async function NewsletterConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = verifyOptinToken(token);

  if (!parsed) {
    return (
      <Shell>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Lien invalide ou expiré</h1>
        <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6 }}>
          Ce lien de confirmation n&apos;est pas valide. Réessayez de vous inscrire depuis le site du lieu.
        </p>
      </Shell>
    );
  }

  const org = await getOrganizationBySlug(parsed.slug);
  const admin = createAdminClient();

  if (!org || !admin) {
    return (
      <Shell>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Confirmation impossible</h1>
        <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6 }}>
          Une erreur est survenue. Merci de réessayer plus tard.
        </p>
      </Shell>
    );
  }

  // Déjà inscrit ? On ré-active simplement le consentement.
  const { data: existing } = await admin
    .from("persons")
    .select("id")
    .eq("organization_id", org.id)
    .ilike("email", parsed.email)
    .is("anonymized_at", null)
    .limit(1);

  if (existing && existing.length > 0) {
    await admin.from("persons").update({ newsletter_opt_out: false }).eq("id", existing[0].id);
  } else {
    await admin.from("persons").insert({
      organization_id: org.id,
      name: parsed.email.split("@")[0],
      email: parsed.email,
      phone: null,
      role: "prospect",
      status: "actif",
      tags: ["newsletter"],
      notes: "Inscription newsletter via le site public.",
      newsletter_opt_out: false,
    });
  }

  return (
    <Shell>
      <div style={{ fontSize: 44, marginBottom: 14 }}>🎉</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Inscription confirmée&nbsp;!</h1>
      <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6, marginBottom: 20 }}>
        Vous recevrez désormais la newsletter de <strong>{org.name}</strong>. Vous pourrez vous
        désinscrire à tout moment depuis n&apos;importe quel email reçu.
      </p>
      <Link
        href={publicSiteUrl(org.slug)}
        style={{ display: "block", padding: 12, borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
      >
        Retour au site →
      </Link>
    </Shell>
  );
}
