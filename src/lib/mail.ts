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
    await transporter.sendMail({
      from:
        process.env.MAIL_FROM ??
        `Casa Minga Lieux <${process.env.MAIL_SMTP_USER}>`,
      to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo,
      attachments: payload.attachments,
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
