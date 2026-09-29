/**
 * Message composition of the contacts module (spec 5.2). Pure functions: no
 * I/O, no secret, no server-only import (loaded as is by
 * scripts/outreach-schedule-check.mjs).
 *
 * v1 rules: the plain text is the source and the HTML is derived from it; no
 * pixel, no image, no link rewriting; the only links are the ones written in the
 * body plus the signed action links of the program.
 */

export type LinkAction = "photos" | "correction" | "stop" | "resolu" | "justificatif";

export interface ActionLine {
  action: LinkAction;
  label: string;
  url: string;
}

/** Wording of each action, by form of address (spec 5.2). */
const LABELS: Record<LinkAction, { tu: string; vous: string }> = {
  photos: {
    tu: "Photos : nous accorder l'usage des photos du lieu",
    vous: "Photos : nous accorder l'usage des photos du lieu",
  },
  correction: {
    tu: "Correction : signaler une erreur dans l'article",
    vous: "Correction : signaler une erreur dans l'article",
  },
  stop: {
    tu: "Ne plus m'écrire : un clic et je ne t'écris plus",
    vous: "Ne plus recevoir nos messages : un clic suffit",
  },
  resolu: {
    tu: "C'est réglé : fermer la demande",
    vous: "C'est réglé : fermer votre demande",
  },
  justificatif: {
    tu: "Déposer un justificatif",
    vous: "Déposer un justificatif",
  },
};

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;

/**
 * Makes a value safe for a mail header: every control character (CR, LF, tab,
 * NEL, line and paragraph separators...) becomes a space, so nothing can start
 * a new header line. `display: true` also drops what would break a
 * "Name" <address> display name (quotes, angle brackets, backslash, comma).
 */
export function cleanHeader(value: string, opts: { display?: boolean } = {}): string {
  let v = String(value ?? "").replace(CONTROL, " ");
  if (opts.display) v = v.replace(/["<>\\,;]/g, "");
  return v.replace(/\s{2,}/g, " ").trim();
}

/** A bare address for an envelope or a To header: no space, control character, quote or angle bracket. */
export function cleanAddress(value: string): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.length > 254 || /[\s\u0000-\u001f\u007f<>",;()\\]/.test(v)) return null;
  return /^[^@]+@[^@]+\.[^@]+$/.test(v) ? v : null;
}

/**
 * Action lines of the program, in the order of its `link_actions`. An action
 * without a URL (no signing secret, or not offered) is left out.
 */
export function actionBlock(
  program: { address_form: "tu" | "vous"; link_actions: string[] },
  links: Partial<Record<LinkAction, string | null>>,
): ActionLine[] {
  const out: ActionLine[] = [];
  for (const a of program.link_actions) {
    if (!(a in LABELS)) continue;
    const action = a as LinkAction;
    const url = links[action];
    if (!url) continue;
    out.push({ action, label: LABELS[action][program.address_form], url });
  }
  return out;
}

/** Readable origin of an address, for "how did you get my address?" (spec 5.2). */
export function sourceLabel(source: string | null, sourceUrl: string | null): string {
  const url = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? ` (${sourceUrl})` : "";
  switch (source) {
    case "site_web": return `le site web du lieu${url}`;
    case "annuaire": return `un annuaire public${url}`;
    case "organisation_admin": return "la fiche du lieu sur Casa Minga";
    case "sejour": return "la fiche du lieu sur Casa Minga Séjour";
    case "recommandation": return "une recommandation";
    case "mail_entrant": return "un message que vous nous avez envoyé";
    case "formulaire": return "un formulaire que vous avez rempli";
    case "leo": return "une prise de contact directe";
    default: return `une source publique${url}`;
  }
}

/** Identity line of a cold mail (outbound programs, first contact and follow-up only). */
export function identityLine(input: {
  form: "tu" | "vous";
  place: string;
  articleTitle: string | null;
  source: string | null;
  sourceUrl: string | null;
}): string {
  const tu = input.form === "tu";
  const why = input.articleTitle
    ? `${input.place} est cité dans l'article « ${input.articleTitle} »`
    : `${input.place} figure parmi les lieux que nous suivons`;
  const from = sourceLabel(input.source, input.sourceUrl);
  // "un message que vous nous avez envoyé" is written in the polite form: adapt for "tu".
  const fromForm = tu ? from.replace("que vous nous avez envoyé", "que tu nous as envoyé").replace("que vous avez rempli", "que tu as rempli") : from;
  return tu
    ? `Tu reçois ce mail parce que ${why}. Ton adresse vient de ${fromForm}.`
    : `Vous recevez ce mail parce que ${why}. Votre adresse vient de ${fromForm}.`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Escapes a text, turns its blank-line separated paragraphs into <p> and its bare http(s) URLs into links. */
function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      const safe = escapeHtml(para).replace(/(https?:\/\/[^\s<]+?)([.,;:!?)]*)(?=\s|$|<)/g, (_m, url: string, tail: string) => {
        return `<a href="${url}">${url}</a>${tail}`;
      });
      return `<p>${safe.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

/**
 * Text and HTML bodies: the text of the message, the action lines, the
 * signature of the program, then the identity line (cold mail only).
 */
export function buildBodies(input: {
  body: string;
  block: ActionLine[];
  signature: string;
  identityLine?: string | null;
}): { text: string; html: string } {
  const body = input.body.replace(/\r\n?/g, "\n").trim();
  const signature = input.signature.replace(/\r\n?/g, "\n").trim();
  const textParts = [body];
  if (input.block.length > 0) {
    textParts.push(input.block.map((l) => `${l.label}\n→ ${l.url}`).join("\n\n"));
  }
  textParts.push(signature);
  if (input.identityLine) textParts.push(input.identityLine);
  const text = textParts.join("\n\n") + "\n";

  const htmlParts = [textToHtml(body)];
  if (input.block.length > 0) {
    htmlParts.push(input.block.map((l) => `<p><a href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a></p>`).join("\n"));
  }
  htmlParts.push(textToHtml(signature));
  if (input.identityLine) htmlParts.push(`<p style="color:#666;font-size:12px">${escapeHtml(input.identityLine)}</p>`);
  const html =
    '<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222">' +
    htmlParts.join("\n") +
    "</body></html>";
  return { text, html };
}
