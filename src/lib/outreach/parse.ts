/**
 * MIME parsing of an incoming mail (spec 6.2). Wraps mailparser and returns a
 * flat, plain-data view (ParsedInbound) that the pure modules (transport,
 * reply-extract, match) work on. No database, no secret, no server-only import:
 * scripts/outreach-parse-check.mjs loads this file directly.
 */
import { simpleParser, type AddressObject, type HeaderValue, type ParsedMail } from "mailparser";

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  size: number;
  /** Kept for report parts (DSN, ARF) and for files small enough to be stored. */
  content: Buffer | null;
}

export interface ParsedInbound {
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  date: Date | null;
  /** Plain text; derived from the HTML part when the mail has no text part. */
  text: string;
  /** Lower-cased header name -> first value as a string. */
  headers: Record<string, string>;
  /** Top-level Content-Type, e.g. "multipart/report". */
  contentType: string;
  /** Parameter report-type of a multipart/report (delivery-status, feedback-report). */
  reportType: string | null;
  attachments: ParsedAttachment[];
}

/** Message-ID style token without angle brackets and whitespace. */
export function cleanId(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = v.match(/<([^<>\s]+)>/);
  const id = (m ? m[1] : v).trim();
  return id.length > 0 && id.length <= 998 ? id : null;
}

export function splitIds(v: string | string[] | undefined | null): string[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v.join(" ") : v;
  const out: string[] = [];
  for (const m of raw.matchAll(/<([^<>\s]+)>/g)) out.push(m[1]);
  if (out.length === 0) {
    for (const tok of raw.split(/\s+/)) if (tok) out.push(tok);
  }
  return [...new Set(out)];
}

function headerToString(v: HeaderValue | undefined): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) {
    const first = v[0] as unknown;
    return first === undefined ? null : headerToString(first as HeaderValue);
  }
  const o = v as unknown as { value?: unknown; text?: string };
  if (typeof o.value === "string") return o.value;
  if (typeof o.text === "string") return o.text;
  return null;
}

function addresses(a: AddressObject | AddressObject[] | undefined): { address: string; name: string }[] {
  if (!a) return [];
  const list = Array.isArray(a) ? a : [a];
  const out: { address: string; name: string }[] = [];
  for (const o of list) {
    for (const v of o.value ?? []) {
      if (v.address) out.push({ address: v.address.trim().toLowerCase(), name: (v.name ?? "").trim() });
    }
  }
  return out;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", eacute: "é", egrave: "è", agrave: "à",
};

/** Minimal HTML -> text, only used when a mail has no text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\n{3,}/g, "\n\n");
}

export function fromParsedMail(m: ParsedMail): ParsedInbound {
  const headers: Record<string, string> = {};
  for (const [k, v] of m.headers ?? []) {
    const s = headerToString(v);
    if (s !== null) headers[k.toLowerCase()] = s;
  }
  const ct = m.headers?.get("content-type") as { value?: string; params?: Record<string, string> } | undefined;
  const from = addresses(m.from)[0];
  const text = (m.text && m.text.trim().length > 0)
    ? m.text
    : (typeof m.html === "string" ? htmlToText(m.html) : "");
  const refs = splitIds(m.references as string | string[] | undefined);
  return {
    messageId: cleanId(m.messageId),
    inReplyTo: cleanId(m.inReplyTo),
    references: refs,
    fromEmail: from?.address ?? null,
    fromName: from?.name || null,
    toEmails: addresses(m.to).map((a) => a.address),
    ccEmails: addresses(m.cc).map((a) => a.address),
    subject: (m.subject ?? "").replace(/\s+/g, " ").trim(),
    date: m.date instanceof Date && !Number.isNaN(m.date.getTime()) ? m.date : null,
    text: text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " "),
    headers,
    contentType: (ct?.value ?? "text/plain").toLowerCase(),
    reportType: ct?.params?.["report-type"]?.toLowerCase() ?? null,
    attachments: (m.attachments ?? []).map((a) => ({
      filename: a.filename ?? "",
      contentType: (a.contentType ?? "application/octet-stream").toLowerCase(),
      size: a.size ?? a.content?.length ?? 0,
      content: a.content ?? null,
    })),
  };
}

/** Parses a raw RFC 822 source. Throws on unparseable input. */
export async function parseRaw(source: Buffer | string): Promise<ParsedInbound> {
  const m = await simpleParser(source, { skipImageLinks: true, skipHtmlToText: false });
  return fromParsedMail(m);
}
