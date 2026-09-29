// Contacts module, step 6: checks parse + transport + reply-extract + the pure
// part of match against scripts/outreach-fixtures/*.eml (anonymised examples).
//
//   node scripts/outreach-parse-check.mjs
//
// The project has no test runner and no tsx: the four pure TypeScript modules
// are transpiled on the fly (typescript is already a dev dependency) into
// node_modules/.cache/outreach-check/, then loaded. No network, no database,
// no secret. Exit code 1 if a target is missed (>= 90 % on reply extraction,
// 100 % on automatic replies and bounces).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const ts = require("typescript");

const outDir = join(root, "node_modules", ".cache", "outreach-check");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "package.json"), '{"type":"commonjs"}');
for (const name of ["parse", "transport", "reply-extract", "match"]) {
  const src = readFileSync(join(root, "src", "lib", "outreach", `${name}.ts`), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  writeFileSync(join(outDir, `${name}.js`), js);
}
const { parseRaw } = require(join(outDir, "parse.js"));
const { classifyTransport } = require(join(outDir, "transport.js"));
const { extractReply, hasOptOutKeyword } = require(join(outDir, "reply-extract.js"));
const { normalizeSubject, decideByAddress, headerIds } = require(join(outDir, "match.js"));

// ---- Expectations per fixture -------------------------------------------------
// nature: humain | auto | rebond | plainte. For humans: strings the extracted
// reply must contain / must not contain (the quote, the signature).
const QUOTE_MARKERS = ["Pourrions-nous", "nouvelles photos", "Nous avons publié", "Nous avons publi"];
const EXPECT = {
  "gmail-fr.eml": { nature: "humain", has: ["jeudi après-midi", "Marie"], not: [...QUOTE_MARKERS, "Lieu Test, 1 rue"], irt: "out-001@casaminga.example.invalid" },
  "outlook-fr.eml": { nature: "humain", has: ["pas avant avril", "bâtiment", "Jean Test"], not: [...QUOTE_MARKERS, "Envoyé :"], irt: "out-002@casaminga.example.invalid" },
  "thunderbird.eml": { nature: "humain", has: ["ne prenons plus de visiteurs", "Paul"], not: [...QUOTE_MARKERS], irt: "out-003@casaminga.example.invalid" },
  "infomaniak-webmail.eml": { nature: "humain", has: ["photo de la façade", "Claire"], not: [...QUOTE_MARKERS, "Léo"], irt: "out-004@casaminga.example.invalid" },
  "iphone.eml": { nature: "humain", has: ["Appelez-moi lundi matin"], not: [...QUOTE_MARKERS, "iPhone"], irt: "out-005@casaminga.example.invalid" },
  "gmail-en.eml": { nature: "humain", has: ["Happy to help", "Emily"], not: ["Could we use", "shared housing that mentions", "wrote:"], irt: "out-012@casaminga.example.invalid" },
  "intercale.eml": { nature: "humain", has: ["Habitat Test", "extérieur uniquement"], not: ["Pourriez-vous nous confirmer", "seriez-vous d'accord"] },
  "opposition.eml": { nature: "humain", has: ["ne plus m'écrire"], not: ["nous avons publié"], optOut: true },
  "transfert-sans-irt.eml": { nature: "humain", has: ["la bonne personne pour les photos", "Hélène"], not: ["Nous avons publié", "Message transféré"], noHeaders: true },
  "sans-rapport.eml": { nature: "auto", bulk: true, noHeaders: true },
  "absence-auto.eml": { nature: "auto", header: "Auto-Submitted", irt: "out-006@casaminga.example.invalid" },
  "absence-sans-entete.eml": { nature: "auto", header: "subject" },
  "dsn-511.eml": { nature: "rebond", severity: "hard", status: "5.1.1", recipient: "inconnu@lieu-disparu.example.invalid", orig: "out-008@casaminga.example.invalid" },
  "dsn-422.eml": { nature: "rebond", severity: "soft", status: "4.2.2", recipient: "boite-pleine@lieu-test.example.invalid", orig: "out-009@casaminga.example.invalid" },
  "arf-plainte.eml": { nature: "plainte", recipient: "plaintif@lieu-test.example.invalid", orig: "out-015@casaminga.example.invalid" },
};

const dir = join(root, "scripts", "outreach-fixtures");
const rows = [];
const bucket = { extraction: [0, 0], auto: [0, 0], bounce: [0, 0], other: [0, 0] };

function check(file, label, ok, expected, got, group) {
  rows.push({ fixture: file, controle: label, attendu: expected, obtenu: got, ok: ok ? "OK" : "ECHEC" });
  bucket[group][1]++;
  if (ok) bucket[group][0]++;
}

for (const file of readdirSync(dir).filter((f) => f.endsWith(".eml")).sort()) {
  const exp = EXPECT[file];
  if (!exp) { rows.push({ fixture: file, controle: "-", attendu: "(sans attendu)", obtenu: "", ok: "?" }); continue; }
  const p = await parseRaw(readFileSync(join(dir, file)));
  const tr = classifyTransport(p);

  const isAutoLike = exp.nature === "auto";
  const grpNature = exp.nature === "rebond" || exp.nature === "plainte" ? "bounce" : isAutoLike ? "auto" : "other";
  check(file, "nature", tr.nature === exp.nature, exp.nature, tr.nature, grpNature);
  if (exp.bulk !== undefined) check(file, "bulk", tr.bulk === exp.bulk, String(exp.bulk), String(tr.bulk), "other");
  if (exp.header) check(file, "en-tete auto", tr.header === exp.header, exp.header, String(tr.header), "auto");
  if (exp.nature === "rebond") {
    check(file, "gravite", tr.severity === exp.severity, exp.severity, String(tr.severity), "bounce");
    check(file, "statut", tr.status === exp.status, exp.status, String(tr.status), "bounce");
  }
  if (exp.nature === "rebond" || exp.nature === "plainte") {
    check(file, "destinataire", tr.recipient === exp.recipient, exp.recipient, String(tr.recipient), "bounce");
    check(file, "Message-ID d'origine", tr.originalMessageId === exp.orig, exp.orig, String(tr.originalMessageId), "bounce");
  }
  if (exp.irt) {
    const ids = headerIds(p);
    check(file, "In-Reply-To", ids.irt === exp.irt, exp.irt, String(ids.irt), "other");
  }
  if (exp.noHeaders) {
    const ids = headerIds(p);
    check(file, "sans en-tete de fil", ids.irt === null && ids.refs.length === 0, "aucun", `${ids.irt ?? "-"} / ${ids.refs.length} refs`, "other");
  }
  if (exp.nature === "humain") {
    const { reply, hadQuote } = extractReply(p.text);
    const missing = exp.has.filter((s) => !reply.includes(s));
    const leaked = exp.not.filter((s) => reply.includes(s));
    const ok = missing.length === 0 && leaked.length === 0;
    check(file, "extraction", ok,
      `contient ${exp.has.length} / exclut ${exp.not.length}`,
      ok ? `ok (citation vue: ${hadQuote})` : `manque [${missing.join("; ")}] reste [${leaked.join("; ")}]`, "extraction");
    if (exp.optOut !== undefined) {
      check(file, "opposition", hasOptOutKeyword(reply) === exp.optOut, String(exp.optOut), String(hasOptOutKeyword(reply)), "other");
    }
  }
}

// ---- Pure part of match ---------------------------------------------------------
const subj = [
  ["Re: Votre lieu dans notre article", "votre lieu dans notre article"],
  ["RE: RE : Fwd: Réf : Votre  Lieu", "votre lieu"],
  ["TR: Re[2]: Été à la ferme", "ete a la ferme"],
  ["Aw: Anfrage", "anfrage"],
];
for (const [inp, out] of subj) check("(match)", "normalizeSubject", normalizeSubject(inp) === out, out, normalizeSubject(inp), "other");

const now = new Date("2026-03-20T12:00:00Z");
const day = 86_400_000;
const cand = (id, subject, live, ageDays) => ({ threadId: id, emailSubject: subject, live, changedAt: new Date(now.getTime() - ageDays * day) });
const fwd = await parseRaw(readFileSync(join(dir, "transfert-sans-irt.eml")));
const cases = [
  ["adresse+objet (fil vivant)", [cand("A", "Votre lieu dans notre article sur l'habitat partagé", true, 5)], fwd.subject, "A:adresse_sujet"],
  ["adresse+objet (clos < 90 j)", [cand("A", "Votre lieu dans notre article sur l'habitat partagé", false, 30)], fwd.subject, "A:adresse_sujet"],
  ["adresse+objet (clos > 90 j)", [cand("A", "Votre lieu dans notre article sur l'habitat partagé", false, 120)], fwd.subject, "aucun"],
  ["un seul fil vivant, autre objet", [cand("B", "Autre sujet", true, 2)], "Question", "B:adresse"],
  ["deux fils vivants, autre objet", [cand("B", "Sujet 1", true, 2), cand("C", "Sujet 2", true, 1)], "Question", "aucun"],
  ["objet egal prefere le fil vivant", [cand("D", "Sujet", false, 10), cand("E", "Sujet", true, 20)], "Re: Sujet", "E:adresse_sujet"],
];
for (const [label, list, subject, expected] of cases) {
  const r = decideByAddress(list, subject, now);
  const got = r ? `${r.threadId}:${r.method}` : "aucun";
  check("(match)", label, got === expected, expected, got, "other");
}

// ---- Report ---------------------------------------------------------------------
console.table(rows);
const pct = ([ok, n]) => (n === 0 ? 100 : Math.round((100 * ok) / n));
const summary = {
  "extraction de la reponse": `${bucket.extraction[0]}/${bucket.extraction[1]} (${pct(bucket.extraction)} %, cible >= 90 %)`,
  "reponses automatiques": `${bucket.auto[0]}/${bucket.auto[1]} (${pct(bucket.auto)} %, cible 100 %)`,
  "rebonds et plaintes": `${bucket.bounce[0]}/${bucket.bounce[1]} (${pct(bucket.bounce)} %, cible 100 %)`,
  "autres controles": `${bucket.other[0]}/${bucket.other[1]}`,
};
console.log(summary);
const failed = pct(bucket.extraction) < 90 || pct(bucket.auto) < 100 || pct(bucket.bounce) < 100 || bucket.other[0] < bucket.other[1];
process.exit(failed ? 1 : 0);
