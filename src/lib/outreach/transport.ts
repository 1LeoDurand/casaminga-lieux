/**
 * Deterministic classification of the "transport" nature of an incoming mail
 * (spec 6.6), before any AI: bounce (DSN), complaint (ARF), automatic reply,
 * bulk mail, spam, or human. Pure functions over ParsedInbound.
 */
import type { ParsedInbound } from "./parse";

export type BounceSeverity = "hard" | "soft";

export type TransportInfo =
  | { nature: "humain"; bulk: boolean; spam: boolean }
  | { nature: "auto"; header: string; bulk: boolean; spam: boolean }
  | {
      nature: "rebond";
      severity: BounceSeverity;
      /** Enhanced status code, e.g. "5.1.1". */
      status: string;
      /** Final-Recipient, lower-cased, when the DSN carries one. */
      recipient: string | null;
      /** Message-ID of the mail that bounced (without brackets). */
      originalMessageId: string | null;
      diagnostic: string;
    }
  | { nature: "plainte"; originalMessageId: string | null; recipient: string | null };

const AUTO_SUBJECT =
  /^\s*(?:(?:re|réf|ref|tr|fw|fwd|aw)\s*:\s*)*(?:absence(?:\s*(?::|-|–|—|du bureau|temporaire)|\s*$)|absent(?:e)?\s+du bureau|r[ée]ponse automatique|out of office|automatic reply|auto[- ]?reply|abwesenheit|fuera de la oficina)/i;

function h(p: ParsedInbound, name: string): string | undefined {
  return p.headers[name.toLowerCase()];
}

/** Header that makes the mail automatic, or null. */
export function autoReplyHeader(p: ParsedInbound): string | null {
  const auto = h(p, "auto-submitted");
  if (auto !== undefined && auto.trim().toLowerCase() !== "no") return "Auto-Submitted";
  for (const name of ["x-autoreply", "x-autorespond", "x-auto-response-suppress"]) {
    if (h(p, name) !== undefined) return name;
  }
  const prec = h(p, "precedence")?.trim().toLowerCase();
  if (prec && ["bulk", "junk", "auto_reply"].includes(prec)) return "Precedence";
  if (AUTO_SUBJECT.test(p.subject)) return "subject";
  return null;
}

export function isBulk(p: ParsedInbound): boolean {
  if (h(p, "list-id") !== undefined) return true;
  const prec = h(p, "precedence")?.trim().toLowerCase();
  return prec === "bulk" || prec === "list" || prec === "junk";
}

export function isSpam(p: ParsedInbound): boolean {
  const flag = h(p, "x-spam-flag")?.trim().toLowerCase();
  if (flag === "yes" || flag === "true") return true;
  const status = h(p, "x-spam-status")?.trim().toLowerCase();
  return !!status && /^yes\b/.test(status);
}

function attText(p: ParsedInbound, type: string): string {
  return p.attachments
    .filter((a) => a.contentType === type && a.content)
    .map((a) => a.content!.toString("utf8"))
    .join("\n");
}

/** Message-ID of the original mail found in attached rfc822 parts. */
function originalId(p: ParsedInbound, dsnText: string): string | null {
  const blobs = [
    attText(p, "message/rfc822"),
    attText(p, "text/rfc822-headers"),
    attText(p, "message/global"),
    dsnText,
  ];
  for (const b of blobs) {
    const m = b.match(/^Message-ID:\s*<([^<>\s]+)>/im);
    if (m) return m[1];
  }
  const env = dsnText.match(/^Original-Envelope-Id:\s*(\S+)/im);
  return env ? env[1].replace(/^<|>$/g, "") : null;
}

function fieldOf(text: string, name: string): string | null {
  // Fields may be folded on the next line (continuation starts with whitespace).
  const tab = String.fromCharCode(9);
  const m = text.match(new RegExp("^" + name + ":[ " + tab + "]*([^\\n]*(?:\\n[ " + tab + "]+[^\\n]*)*)", "im"));
  return m ? m[1].replace(/\s*\n\s*/g, " ").trim() : null;
}

const MAILER = /^(mailer-daemon|postmaster)@/i;
const BOUNCE_SUBJECT = /(undeliver|delivery (status )?(notification|failure)|returned mail|failure notice|mail delivery (failed|subsystem)|non remis|non délivré|échec de (la )?distribution|impossible de distribuer)/i;

function parseDsn(p: ParsedInbound): TransportInfo | null {
  const isReport = p.contentType === "multipart/report" && p.reportType === "delivery-status";
  // mailparser folds a message/delivery-status part into the text body, so the
  // fields are read from the attachment when present, else from the text.
  const dsn = attText(p, "message/delivery-status") || p.text;
  const fromDaemon = !!p.fromEmail && MAILER.test(p.fromEmail);
  const looksLikeBounce = isReport || (fromDaemon && (BOUNCE_SUBJECT.test(p.subject) || /^Final-Recipient:/im.test(dsn)));
  if (!looksLikeBounce) return null;

  // Per-recipient block: the last block of the delivery-status carries Final-Recipient.
  const status =
    fieldOf(dsn, "Status") ??
    // Fallback for text-only bounces: first enhanced status code in the body.
    (p.text.match(/\b([45]\.\d{1,3}\.\d{1,3})\b/)?.[1] ?? null);
  if (!status || !/^[245]\.\d{1,3}\.\d{1,3}$/.test(status)) {
    return isReport ? { nature: "rebond", severity: "soft", status: "4.0.0", recipient: null,
      originalMessageId: originalId(p, dsn), diagnostic: "" } : null;
  }
  const action = (fieldOf(dsn, "Action") ?? "").toLowerCase();
  const rcpt = (fieldOf(dsn, "Final-Recipient") ?? fieldOf(dsn, "Original-Recipient"))
    ?.replace(/^rfc822;\s*/i, "").replace(/^<|>$/g, "").toLowerCase() ?? null;
  const diag = (fieldOf(dsn, "Diagnostic-Code") ?? "").replace(/^smtp;\s*/i, "").slice(0, 200);
  // A 2.x.x status is a delivery receipt: not a bounce.
  if (status.startsWith("2.") || action === "delivered" || action === "relayed" || action === "expanded") {
    return null;
  }
  return {
    nature: "rebond",
    severity: status.startsWith("5.") ? "hard" : "soft",
    status,
    recipient: rcpt && /^[^@\s]+@[^@\s]+$/.test(rcpt) ? rcpt : null,
    originalMessageId: originalId(p, dsn),
    diagnostic: diag,
  };
}

function parseArf(p: ParsedInbound): TransportInfo | null {
  if (!(p.contentType === "multipart/report" && p.reportType === "feedback-report")) return null;
  const fb = attText(p, "message/feedback-report");
  const rcpt = (fieldOf(fb, "Original-Rcpt-To") ?? fieldOf(fb, "Removal-Recipient"))
    ?.replace(/^<|>$/g, "").toLowerCase() ?? null;
  return { nature: "plainte", originalMessageId: originalId(p, fb), recipient: rcpt };
}

export function classifyTransport(p: ParsedInbound): TransportInfo {
  const arf = parseArf(p);
  if (arf) return arf;
  const dsn = parseDsn(p);
  if (dsn) return dsn;
  const bulk = isBulk(p);
  const spam = isSpam(p);
  const auto = autoReplyHeader(p);
  if (auto) return { nature: "auto", header: auto, bulk, spam };
  return { nature: "humain", bulk, spam };
}
