/**
 * Extracts the new part of a reply, without the quoted history (spec 6.7).
 * Home-made heuristic, no dependency, FR/EN (plus a few ES/DE/IT markers).
 * The full body stays stored; this is for display and to keep the AI from
 * classifying quoted text. Tuned on scripts/outreach-fixtures/*.eml.
 */

const ATTR_START = /^\s*(le|on|el|am|il|em)\s+\S/i;
const ATTR_END = /(a écrit|à écrit|a ecrit|wrote|ha escrito|schrieb|ha scritto|escreveu)\s*:?\s*$/i;

const SEPARATOR =
  /^\s*[-_=*]{2,}\s*(original message|message d['’]origine|message original|message initial|forwarded message|message transf[ée]r[ée]|mensaje original|urspr[üu]ngliche nachricht|message r[ée]exp[ée]di[ée])\s*[-_=*]{2,}\s*$/i;

const UNDERSCORE_RULE = /^\s*_{10,}\s*$/;

// Outlook header block: "De :" then one of the other fields within the next lines.
const HDR_FROM = /^[\s*>]*(de|from|von|da|d[ée])\s*:\s*\S/i;
const HDR_OTHER = /^[\s*>]*(envoy[ée]|sent|date|[àa]|to|cc|objet|subject|sujet|betreff|an|gesendet)\s*:/i;

// Mobile / client footers appended below the answer.
const MOBILE_FOOTER =
  /^\s*(envoy[ée] (de mon|depuis mon|d['’]un|à partir de|depuis|avec)\b.*|sent from my .*|sent from (outlook|mail|yahoo|proton|gmail|samsung).*|sent with .*|get outlook for .*|obtenez outlook pour .*|t[ée]l[ée]charger outlook pour .*|sent via .*)\s*$/i;

const SIG_DELIM = /^--\s?$/;

/** Index of the first line that starts the quoted history, or -1. */
function findCut(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (SEPARATOR.test(l)) return i;
    if (UNDERSCORE_RULE.test(l) && HDR_FROM.test(lines[i + 1] ?? "")) return i;
    if (HDR_FROM.test(l)) {
      const next = lines.slice(i + 1, i + 5);
      if (next.some((n) => HDR_OTHER.test(n)) && !l.trim().startsWith(">")) {
        // "De :" alone in a sentence is not enough: needs a sibling field.
        return i;
      }
    }
    if (ATTR_START.test(l) && !l.trim().startsWith(">")) {
      // The attribution wraps over up to three lines in some clients.
      let joined = l.trim();
      for (let k = 0; k < 3; k++) {
        if (ATTR_END.test(joined)) return i;
        const nxt = lines[i + 1 + k];
        if (nxt === undefined || nxt.trim() === "") break;
        joined += " " + nxt.trim();
      }
      if (ATTR_END.test(joined)) return i;
    }
  }
  return -1;
}

function isQuoted(line: string): boolean {
  return /^\s*>/.test(line);
}

function cutSignature(lines: string[]): string[] {
  const idx = lines.findIndex((l) => SIG_DELIM.test(l));
  return idx >= 0 ? lines.slice(0, idx) : lines;
}

function dropMobileFooter(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0) {
    const last = out[out.length - 1];
    if (last.trim() === "" || MOBILE_FOOTER.test(last)) out.pop();
    else break;
  }
  return out;
}

function tidy(lines: string[]): string {
  return lines.join("\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractReply(text: string): { reply: string; hadQuote: boolean } {
  const all = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
  let hadQuote = false;
  let kept: string[];

  const cut = findCut(all);
  if (cut >= 0) {
    hadQuote = true;
    const before = all.slice(0, cut);
    if (tidy(before) !== "") {
      kept = before;
    } else {
      // Bottom posting: the answer follows the quoted block.
      const tail = all.slice(cut + 1);
      const lastQuoted = tail.map(isQuoted).lastIndexOf(true);
      const after = lastQuoted >= 0 ? tail.slice(lastQuoted + 1) : [];
      kept = tidy(after) !== "" ? after : [];
    }
  } else if (all.some(isQuoted)) {
    hadQuote = true;
    const firstQ = all.findIndex(isQuoted);
    const rest = all.slice(firstQ);
    const trailingOnlyQuote = rest.every((l) => isQuoted(l) || l.trim() === "");
    // Interleaved answers are kept, only the quoted lines are dropped.
    kept = trailingOnlyQuote ? all.slice(0, firstQ) : all.filter((l) => !isQuoted(l));
  } else {
    kept = all;
  }

  kept = cutSignature(kept);
  kept = dropMobileFooter(kept);
  return { reply: tidy(kept), hadQuote };
}

// ---- Opt-out keywords (spec 6.6), applied to the extracted reply ----------

const OPT_OUT_PATTERNS: RegExp[] = [
  /^\s*stop\s*[.!]*\s*$/im,
  /d[ée]sinscri/i,
  /\bunsubscribe\b/i,
  /\bne\s+plus\s+(m['’]|nous\s+)?[ée]crire\b/i,
  /\bretirez[- ](moi|nous|mon adresse|notre adresse)\b/i,
  /\bne\s+(me|nous)\s+contactez\s+plus\b/i,
];

export function hasOptOutKeyword(reply: string): boolean {
  return OPT_OUT_PATTERNS.some((re) => re.test(reply));
}
