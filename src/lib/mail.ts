/**
 * Transport email via SMTP Infomaniak.
 * Variables d'environnement requises dans .env.local :
 *   MAIL_SMTP_HOST=mail.infomaniak.com
 *   MAIL_SMTP_PORT=587
 *   MAIL_SMTP_USER=noreply@casaminga.com
 *   MAIL_SMTP_PASS=votre_mot_de_passe_smtp
 *   MAIL_FROM=Casa Minga Lieux <noreply@casaminga.com>
 *   MAIL_ADMIN=votre@email.com   (destinataire des alertes équipe)
 */

import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOST ?? "mail.infomaniak.com",
    port: Number(process.env.MAIL_SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.MAIL_SMTP_USER,
      pass: process.env.MAIL_SMTP_PASS,
    },
  });
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: MailAttachment[];
  /** Catégorie pour la traçabilité (facture, rappel, bienvenue, recu…). */
  category?: string;
  /** Organisation émettrice (pour le journal email_log). */
  organizationId?: string | null;
  /**
   * Version texte brut. Si omise, elle est dérivée du HTML.
   * Un email HTML sans alternative texte est pénalisé par les filtres anti-spam.
   */
  text?: string;
  /**
   * Envois de masse uniquement (newsletter, bulletin). Ajoute les en-têtes
   * `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058), exigés par Gmail
   * et Yahoo depuis 2024 pour tout expéditeur en volume.
   *
   * L'URL doit accepter un POST sans confirmation : passer l'endpoint
   * `/api/unsubscribe/<token>`, jamais la page de désabonnement.
   */
  unsubscribeUrl?: string;
}

/** Entités nommées qu'un template français rencontre réellement. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", laquo: "«", raquo: "»", ndash: "–", mdash: "—",
  rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', euro: "€", deg: "°",
  agrave: "à", acirc: "â", ccedil: "ç", egrave: "è", eacute: "é",
  ecirc: "ê", euml: "ë", icirc: "î", iuml: "ï", ocirc: "ô", oelig: "œ",
  ugrave: "ù", ucirc: "û", uuml: "ü", Agrave: "À", Ccedil: "Ç", Eacute: "É",
};

const ENTITY_RE = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;

/**
 * Décodage en UNE passe : indispensable pour ne pas ré-interpréter ce qui vient
 * d'être décodé. `&amp;lt;` doit rester le texte littéral « &lt; », pas devenir
 * un « < ».
 */
function decodeEntity(match: string, body: string): string {
  if (body[0] === "#") {
    const code = body[1]?.toLowerCase() === "x"
      ? parseInt(body.slice(2), 16)
      : parseInt(body.slice(1), 10);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
    try {
      return String.fromCodePoint(code);
    } catch {
      return match;
    }
  }
  return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match;
}

/**
 * Convertit un HTML d'email en texte lisible, pour la partie `text/plain` du
 * multipart. On ne cherche pas la fidélité typographique : on cherche qu'un
 * lecteur en mode texte — et un filtre anti-spam — trouvent le même message et
 * les mêmes liens que dans la version HTML.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Les liens deviennent « libellé (url) » : en texte brut, une ancre sans
    // son URL est un cul-de-sac.
    .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (!text) return href;
      return text === href ? href : `${text} (${href})`;
    })
    .replace(/<img\b[^>]*\balt=["']([^"']+)["'][^>]*>/gi, "[$1]")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n———\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(td|li)>/gi, "\n")
    .replace(/<\/(p|div|tr|table|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(ENTITY_RE, decodeEntity)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Journalise l'envoi dans email_log (service_role, best-effort, jamais bloquant). */
async function logEmail(payload: MailPayload, status: "sent" | "failed", error?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, key, { auth: { persistSession: false } });
    await admin.from("email_log").insert({
      organization_id: payload.organizationId ?? null,
      recipient: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      subject: payload.subject,
      category: payload.category ?? "autre",
      status,
      error: error ?? null,
    });
  } catch {
    /* le journal ne doit jamais casser l'envoi */
  }
}

/**
 * Court-circuit : vérifie si l'org est une org de démo.
 * Les orgs démo ne reçoivent jamais d'emails réels.
 */
async function isDemoOrg(orgId: string | null | undefined): Promise<boolean> {
  if (!orgId) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await admin
      .from("organizations")
      .select("is_demo")
      .eq("id", orgId)
      .maybeSingle();
    return data?.is_demo === true;
  } catch {
    return false;
  }
}

/** Envoie un email. Silencieux si le SMTP n'est pas configuré ou si l'org est en démo. */
export async function sendMail(payload: MailPayload): Promise<boolean> {
  // Court-circuit démo : aucun vrai email pour les orgs de démonstration
  if (await isDemoOrg(payload.organizationId)) {
    console.info("[mail] Org démo — email simulé (non envoyé):", payload.subject);
    void logEmail(payload, "failed", "Org démo — email non envoyé");
    return true; // on renvoie true pour ne pas perturber les flux UI
  }

  if (!process.env.MAIL_SMTP_USER || !process.env.MAIL_SMTP_PASS) {
    console.warn("[mail] SMTP non configuré — email ignoré:", payload.subject);
    void logEmail(payload, "failed", "SMTP non configuré");
    return false;
  }
  try {
    const transporter = createTransport();
    // RFC 8058 : la désinscription en un clic n'est valable que si l'URL
    // accepte un POST. `List-Unsubscribe-Post` promet exactement cela.
    const headers = payload.unsubscribeUrl
      ? {
          "List-Unsubscribe": `<${payload.unsubscribeUrl}>`,
          // Exact value required by RFC 8058 section 3.1 ("List=One-Click" is ignored by Gmail/Yahoo).
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined;
    await transporter.sendMail({
      from:
        process.env.MAIL_FROM ??
        `Casa Minga Lieux <${process.env.MAIL_SMTP_USER}>`,
      to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? htmlToText(payload.html),
      replyTo: payload.replyTo,
      attachments: payload.attachments,
      headers,
    });
    void logEmail(payload, "sent");
    return true;
  } catch (err) {
    console.error("[mail] Erreur envoi:", err);
    void logEmail(payload, "failed", err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Email de l'admin (destinataire alertes équipe). */
export function adminEmail(): string {
  return process.env.MAIL_ADMIN ?? process.env.MAIL_SMTP_USER ?? "";
}
