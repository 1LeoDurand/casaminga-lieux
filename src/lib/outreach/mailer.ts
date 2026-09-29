import "server-only";
/**
 * Transport of the contacts module (spec 5.2 and 5.4): one SMTP transport per
 * mailbox (distinct from src/lib/mail.ts, which sends as noreply@ with
 * MAIL_SMTP_*), the raw message built once with nodemailer's MailComposer and
 * sent as is, then filed as is in "Envoyés" by IMAP APPEND.
 *
 * Credentials come from the mailbox's env prefix and never leave this file:
 * every text returned to a caller goes through scrub().
 */
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { cleanAddress, cleanHeader } from "./compose";
import { imapConfigFor, safeMessage, withImap, type ImapConfig } from "./imap";
import type { Mailbox } from "./types";

export interface MailboxConfig {
  key: string;
  address: string;
  /** Domain of the mailbox address: the right-hand side of our Message-IDs. */
  domain: string;
  smtp: { host: string; port: number; user: string; pass: string };
  /** null: no copy in "Envoyés" (spec 11). */
  imap: ImapConfig | null;
}

/**
 * SMTP (and IMAP) settings of a mailbox from the environment, or null when a
 * required SMTP variable is missing: nothing then leaves this mailbox.
 */
export function outreachMailConfig(mb: Pick<Mailbox, "key" | "address" | "env_prefix">): MailboxConfig | null {
  const e = process.env;
  const p = mb.env_prefix;
  const host = e[`${p}SMTP_HOST`]?.trim();
  const user = e[`${p}SMTP_USER`]?.trim();
  const pass = e[`${p}SMTP_PASS`];
  if (!host || !user || !pass) return null;
  const port = Number(e[`${p}SMTP_PORT`]?.trim() || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const domain = mb.address.split("@")[1];
  if (!domain) return null;
  return { key: mb.key, address: mb.address, domain, smtp: { host, port, user, pass }, imap: imapConfigFor(p) };
}

/** True when the variables of a mailbox allow sending (cheap check for the health screens). */
export function smtpConfigured(mb: Pick<Mailbox, "key" | "address" | "env_prefix">): boolean {
  return outreachMailConfig(mb) !== null;
}

/** Removes anything credential-like or address-like from a text before it is stored or logged. */
export function scrub(text: string, cfg?: MailboxConfig | null): string {
  let t = String(text ?? "");
  if (cfg) {
    for (const secret of [cfg.smtp.pass, cfg.smtp.user, cfg.imap?.pass, cfg.imap?.user]) {
      if (secret && secret.length >= 4) t = t.split(secret).join("<masqué>");
    }
  }
  return t
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[\w.+-]+@[\w.-]+/g, "<adresse>")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 300);
}

export interface ComposeInput {
  /** Without angle brackets. */
  messageId: string;
  fromName: string;
  fromAddress: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  inReplyTo?: string | null;
  /** Without angle brackets. */
  references?: string[];
  /** RFC 8058: https URL that accepts a POST. */
  unsubscribeUrl?: string | null;
  unsubscribeMailto?: string | null;
  date: Date;
}

/**
 * Builds the raw RFC 5322 message, once. Every value that becomes a header is
 * cleaned of control characters here (CR/LF injection), whatever the caller did.
 */
export async function composeRaw(i: ComposeInput): Promise<Buffer> {
  const to = cleanAddress(i.to);
  const from = cleanAddress(i.fromAddress);
  if (!to || !from) throw new Error("compose: invalid address");
  const headers: Record<string, string> = {};
  if (i.unsubscribeUrl) {
    const parts = [`<${i.unsubscribeUrl}>`];
    if (i.unsubscribeMailto) parts.push(`<mailto:${i.unsubscribeMailto}?subject=unsubscribe>`);
    headers["List-Unsubscribe"] = cleanHeader(parts.join(", "));
    // Exact value required by RFC 8058 section 3.1.
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const refs = (i.references ?? []).map((r) => cleanHeader(r)).filter(Boolean).map((r) => `<${r}>`);
  const composer = new MailComposer({
    from: { name: cleanHeader(i.fromName, { display: true }), address: from },
    to,
    subject: cleanHeader(i.subject),
    text: i.text,
    html: i.html,
    date: i.date,
    messageId: `<${cleanHeader(i.messageId)}>`,
    inReplyTo: i.inReplyTo ? `<${cleanHeader(i.inReplyTo)}>` : undefined,
    references: refs.length > 0 ? refs : undefined,
    headers,
  });
  return await new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((err, msg) => (err ? reject(err) : resolve(msg)));
  });
}

export interface SendOutcome {
  ok: boolean;
  /** SMTP reply code when there is one. */
  code?: number;
  /** Scrubbed server reply. */
  response?: string;
  /**
   * temporary: 4xx or network, try again later. recipient: the address itself
   * is refused (550, 551, 553, 5.1.x). permanent: refused for another reason
   * (policy, size, reputation): the address is NOT at fault. auth: our
   * credentials are refused, nothing else will pass either.
   */
  kind?: "temporary" | "recipient" | "permanent" | "auth";
}

function classify(err: unknown): { code?: number; response: string; kind: NonNullable<SendOutcome["kind"]> } {
  const e = err as {
    code?: string; responseCode?: number; response?: string;
    rejectedErrors?: { responseCode?: number; response?: string }[];
  };
  const inner = e.rejectedErrors?.[0];
  const code = inner?.responseCode ?? e.responseCode;
  const response = inner?.response ?? e.response ?? "";
  if (e.code === "EAUTH" || (code !== undefined && [530, 534, 535, 538].includes(code))) {
    return { code, response, kind: "auth" };
  }
  if (code !== undefined && code >= 500) {
    const enhanced = /\b5\.(\d)\.(\d+)\b/.exec(response);
    const recipient = enhanced ? enhanced[1] === "1" : [550, 551, 553].includes(code);
    return { code, response, kind: recipient ? "recipient" : "permanent" };
  }
  return { code, response: response || (e.code ?? ""), kind: "temporary" };
}

/** Sends a raw message. Never throws: the outcome says what happened. */
export async function sendRaw(
  cfg: MailboxConfig,
  raw: Buffer,
  envelope: { from: string; to: string[] },
): Promise<SendOutcome> {
  const transporter = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    requireTLS: cfg.smtp.port !== 465,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  try {
    const info = await transporter.sendMail({ envelope, raw });
    const rejected = Array.isArray(info.rejected) ? info.rejected.length : 0;
    if (rejected > 0) return { ok: false, kind: "recipient", response: scrub(String(info.response ?? ""), cfg) };
    return { ok: true, response: scrub(String(info.response ?? ""), cfg) };
  } catch (err) {
    const c = classify(err);
    return { ok: false, code: c.code, response: scrub(c.response, cfg), kind: c.kind };
  } finally {
    transporter.close();
  }
}

export interface AppendItem {
  id: string;
  raw: Buffer;
  date: Date;
}

/**
 * Files copies in "Envoyés" over one IMAP connection. Returns the ids that were
 * filed. A failure is reported, never thrown: the send itself is never
 * questioned by a failed copy (spec 5.4).
 */
export async function appendManyToSent(
  cfg: MailboxConfig,
  items: AppendItem[],
): Promise<{ done: string[]; folder: string | null; error?: string }> {
  if (!cfg.imap || items.length === 0) return { done: [], folder: null };
  const imap = cfg.imap;
  try {
    return await withImap(imap, async (s) => {
      const folder = await s.resolveSentFolder(imap.sentFolder);
      if (!folder) return { done: [], folder: null, error: "dossier Envoyés introuvable" };
      const done: string[] = [];
      let error: string | undefined;
      for (const it of items) {
        try {
          await s.append(folder, it.raw, it.date);
          done.push(it.id);
        } catch (err) {
          error = scrub(safeMessage(err), cfg);
        }
      }
      return { done, folder, error };
    });
  } catch (err) {
    return { done: [], folder: null, error: scrub(safeMessage(err), cfg) };
  }
}
