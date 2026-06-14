import { notFound } from "next/navigation";
import { verifyPortalToken } from "@/lib/portal/token";
import { getPortalDataByEmail } from "@/lib/portal/data";
import { renderMembershipCertificatePdf } from "@/lib/portal/membership-certificate-pdf";

export const dynamic = "force-dynamic";

/**
 * Attestation d'adhésion (PDF) pour l'adhérent connecté à son espace.
 *
 *   GET /espace/<token>/attestation/<orgSlug>
 *
 * Le token HMAC garantit l'identité par email ; on ne génère l'attestation que
 * pour une adhésion rattachée à cet email et en cours de validité.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; org: string }> }
) {
  const { token, org: orgSlug } = await params;

  const email = verifyPortalToken(token);
  if (!email) return notFound();

  const data = await getPortalDataByEmail(email);
  if (!data) return notFound();

  const org = data.orgs.find((o) => o.orgSlug === orgSlug);
  const adhesion = org?.adhesion;
  if (!org || !adhesion) return notFound();

  // Attestation seulement pour une adhésion en cours (active ou expirant bientôt).
  if (!["active", "expire_bientot"].includes(adhesion.derivedStatus)) {
    return new Response("Aucune adhésion en cours.", { status: 403 });
  }

  const buffer = await renderMembershipCertificatePdf({
    orgName: org.orgName,
    memberName: org.displayName,
    tierName: adhesion.tierName,
    membershipStart: adhesion.membershipStart,
    membershipEnd: adhesion.membershipEnd,
    reference: adhesion.id.slice(0, 8).toUpperCase(),
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="attestation-adhesion-${orgSlug}.pdf"`,
    },
  });
}
