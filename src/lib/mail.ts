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
}

/** Envoie un email. Silencieux si le SMTP n'est pas configuré (env manquant). */
export async function sendMail(payload: MailPayload): Promise<boolean> {
  if (!process.env.MAIL_SMTP_USER || !process.env.MAIL_SMTP_PASS) {
    console.warn("[mail] SMTP non configuré — email ignoré:", payload.subject);
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
    return true;
  } catch (err) {
    console.error("[mail] Erreur envoi:", err);
    return false;
  }
}

/** Email de l'admin (destinataire alertes équipe). */
export function adminEmail(): string {
  return process.env.MAIL_ADMIN ?? process.env.MAIL_SMTP_USER ?? "";
}
