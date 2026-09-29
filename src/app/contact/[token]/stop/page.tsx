import { headers } from "next/headers";
import { createAdminClient } from "@/lib/admin/guard";
import { clientIp, logLinkEvent, resolveContactToken } from "@/lib/outreach/link-token";
import { ContactShell, InvalidLink } from "../../_components/shell";
import { AutoStop } from "./auto-stop";

export const dynamic = "force-dynamic";

/**
 * Le chargement de cette page (GET) n'enregistre RIEN : c'est le composant
 * client qui envoie le POST, ou le bouton de secours. Les robots de messagerie
 * qui ouvrent les liens sans exécuter de JavaScript ne désinscrivent personne.
 */
export default async function StopPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r } = await searchParams;

  const link = await resolveContactToken(token, "stop", { ip: clientIp(await headers()) });
  if (!link) return <InvalidLink />;

  const admin = createAdminClient();
  if (admin) {
    await logLinkEvent(admin, {
      programId: link.program.id,
      threadId: link.thread.id,
      contactId: link.contact.id,
      type: "link.opened",
      data: { action: "stop" },
    });
  }

  if (r === "ok") {
    return (
      <ContactShell title="C'est noté">
        <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
          Nous ne vous écrirons plus. Vous n&apos;avez rien d&apos;autre à faire, et vous pouvez fermer cette page.
        </p>
      </ContactShell>
    );
  }

  return (
    <ContactShell title="Ne plus recevoir de messages">
      {r === "server" && (
        <p role="alert" className="mt-3 rounded-xl border border-[#E8714D]/30 bg-[#E8714D]/10 p-3 text-[13.5px] text-[#B4472A]">
          Une erreur est survenue. Merci de réessayer, ou de répondre simplement « stop » au message reçu.
        </p>
      )}
      <AutoStop token={token} />
    </ContactShell>
  );
}
