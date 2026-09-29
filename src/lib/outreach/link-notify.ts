/**
 * Alerte à l'équipe après une action du lien signé (photos accordées, correction).
 * Règle « emails actionnables » : la notification ne bloque JAMAIS l'action du
 * visiteur (tout est dans un try/catch), et n'embarque ni adresse ni texte du
 * message : seulement le nom du lieu et le lien vers le fil dans l'admin.
 */
import "server-only";
import { adminEmail, sendMail } from "@/lib/mail";
import { PORTAL_ADMIN_BASE } from "@/lib/portal/url";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function notifyLinkAction(args: {
  threadId: string;
  placeName: string;
  headline: string;
  detail: string;
}): Promise<void> {
  try {
    const to = adminEmail();
    if (!to) return;
    const url = `${PORTAL_ADMIN_BASE}/admin/contacts/fils/${args.threadId}`;
    // Une seule ligne dans l'objet : le nom du lieu vient d'une base, pas d'un visiteur, mais on nettoie quand même.
    const subject = `${args.headline} : ${args.placeName}`.replace(/[\r\n]+/g, " ").slice(0, 150);
    await sendMail({
      to,
      subject,
      html:
        `<p>${esc(args.headline)} : <strong>${esc(args.placeName)}</strong>.</p>` +
        `<p>${esc(args.detail)}</p>` +
        `<p><a href="${esc(url)}">Ouvrir le fil dans l'admin</a></p>`,
      category: "prospection",
    });
  } catch {
    // Jamais bloquant.
  }
}
