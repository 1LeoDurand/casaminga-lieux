// Contacts module, step 3: checks the pure scheduling functions of
// src/lib/outreach/schedule.ts (sending window, next slot, ramp) and the pure
// composition helpers of src/lib/outreach/compose.ts (header cleaning, action block).
//
//   node scripts/outreach-schedule-check.mjs
//
// Same approach as outreach-parse-check.mjs: the pure TypeScript modules are
// transpiled on the fly into node_modules/.cache/outreach-check/. No network,
// no database, no secret. Exit code 1 if an expectation fails.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const ts = require("typescript");

const outDir = join(root, "node_modules", ".cache", "outreach-check");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "package.json"), '{"type":"commonjs"}');
for (const name of ["schedule", "compose"]) {
  const src = readFileSync(join(root, "src", "lib", "outreach", `${name}.ts`), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  writeFileSync(join(outDir, `${name}.js`), js);
}
const { sendWindowOpen, nextSendSlot, coldCapForDay, startOfLocalDay, spreadSlots } = require(join(outDir, "schedule.js"));
const { cleanHeader, actionBlock, buildBodies } = require(join(outDir, "compose.js"));

let failed = 0;
let total = 0;
function eq(label, got, want) {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failed++;
    console.log(`FAIL ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
}
const iso = (d) => d.toISOString();

const win = { send_days: [1, 2, 3, 4, 5], send_start: "09:00:00", send_end: "17:30:00", timezone: "Europe/Paris" };

// ---- Window ---------------------------------------------------------------
// 2026-09-29 is a Tuesday (CEST, UTC+2).
eq("mardi 10h Paris ouvert", sendWindowOpen(new Date("2026-09-29T08:00:00Z"), win), true);
eq("mardi 8h59 Paris ferme", sendWindowOpen(new Date("2026-09-29T06:59:00Z"), win), false);
eq("mardi 9h00 Paris ouvert", sendWindowOpen(new Date("2026-09-29T07:00:00Z"), win), true);
eq("mardi 17h29 ouvert", sendWindowOpen(new Date("2026-09-29T15:29:00Z"), win), true);
eq("mardi 17h30 ferme (fin exclue)", sendWindowOpen(new Date("2026-09-29T15:30:00Z"), win), false);
eq("mardi 17h31 ferme", sendWindowOpen(new Date("2026-09-29T15:31:00Z"), win), false);
eq("samedi 11h ferme", sendWindowOpen(new Date("2026-10-03T09:00:00Z"), win), false);
eq("dimanche 11h ferme", sendWindowOpen(new Date("2026-10-04T09:00:00Z"), win), false);
eq("lundi 23h30 UTC (= mardi 1h30 Paris) ferme", sendWindowOpen(new Date("2026-09-28T23:30:00Z"), win), false);

// ---- Next slot ------------------------------------------------------------
eq("ouvert : le creneau est l'instant meme", iso(nextSendSlot(new Date("2026-09-29T08:00:00Z"), win)), "2026-09-29T08:00:00.000Z");
eq("avant ouverture : 9h le meme jour", iso(nextSendSlot(new Date("2026-09-29T06:00:00Z"), win)), "2026-09-29T07:00:00.000Z");
eq("17h31 mardi : mercredi 9h", iso(nextSendSlot(new Date("2026-09-29T15:31:00Z"), win)), "2026-09-30T07:00:00.000Z");
eq("samedi : lundi 9h", iso(nextSendSlot(new Date("2026-10-03T09:00:00Z"), win)), "2026-10-05T07:00:00.000Z");
eq("vendredi 17h31 : lundi 9h", iso(nextSendSlot(new Date("2026-10-02T15:31:00Z"), win)), "2026-10-05T07:00:00.000Z");

// ---- Change of hour: last Sunday of October 2026 = 25 October (CEST -> CET) ----
eq("vendredi 23/10 avant le changement : UTC+2", sendWindowOpen(new Date("2026-10-23T07:00:00Z"), win), true);
eq("samedi 24/10 : lundi 26/10 9h Paris = 08:00Z (UTC+1)", iso(nextSendSlot(new Date("2026-10-24T09:00:00Z"), win)), "2026-10-26T08:00:00.000Z");
eq("lundi 26/10 07:59Z = 8h59 Paris ferme", sendWindowOpen(new Date("2026-10-26T07:59:00Z"), win), false);
eq("lundi 26/10 08:00Z = 9h00 Paris ouvert", sendWindowOpen(new Date("2026-10-26T08:00:00Z"), win), true);
eq("lundi 26/10 16:29Z = 17h29 Paris ouvert", sendWindowOpen(new Date("2026-10-26T16:29:00Z"), win), true);
eq("lundi 26/10 16:30Z = 17h30 Paris ferme", sendWindowOpen(new Date("2026-10-26T16:30:00Z"), win), false);
const sun = { ...win, send_days: [7] }; // a window on the change day itself
eq("dimanche 25/10 9h Paris = 08:00Z (apres le passage de 3h a 2h)", iso(nextSendSlot(new Date("2026-10-24T20:00:00Z"), sun)), "2026-10-25T08:00:00.000Z");
eq("dimanche 25/10 08:00Z ouvert", sendWindowOpen(new Date("2026-10-25T08:00:00Z"), sun), true);
eq("dimanche 25/10 07:59Z ferme", sendWindowOpen(new Date("2026-10-25T07:59:00Z"), sun), false);
// Spring change: 29 March 2026.
eq("lundi 30/03 9h Paris = 07:00Z (UTC+2)", iso(nextSendSlot(new Date("2026-03-28T12:00:00Z"), win)), "2026-03-30T07:00:00.000Z");
// The local day starts at 22:00Z the evening before in summer, 23:00Z in winter.
eq("debut de journee locale, ete", iso(startOfLocalDay(new Date("2026-09-29T12:00:00Z"), "Europe/Paris")), "2026-09-28T22:00:00.000Z");
eq("debut de journee locale, hiver", iso(startOfLocalDay(new Date("2026-11-03T12:00:00Z"), "Europe/Paris")), "2026-11-02T23:00:00.000Z");
eq("jour du changement d'heure : minuit en heure d'ete", iso(startOfLocalDay(new Date("2026-10-25T12:00:00Z"), "Europe/Paris")), "2026-10-24T22:00:00.000Z");

// ---- Batch slots ------------------------------------------------------------
const slots = spreadSlots(new Date("2026-09-29T15:00:00Z"), 4, 15, win); // Tuesday 17:00 Paris, window ends 17:30
eq("lot : 17h00, 17h15, puis mercredi 9h et 9h15", slots.map(iso), [
  "2026-09-29T15:00:00.000Z", "2026-09-29T15:15:00.000Z", "2026-09-30T07:00:00.000Z", "2026-09-30T07:15:00.000Z",
]);

// ---- Ramp -----------------------------------------------------------------
// Ramp started Monday 2026-09-07: week 1 = 7..13 Sep, 2 = 14..20, 3 = 21..27, 4 = 28 Sep..4 Oct, 5 = 5..11 Oct.
const ramp = { daily_cap: 30, ramp_steps: [5, 10, 20, 30], ramp_started_on: "2026-09-07", timezone: "Europe/Paris" };
eq("jour 1 de la rampe (lundi)", coldCapForDay(new Date("2026-09-07T10:00:00Z"), ramp), 5);
eq("jour 7 de la rampe (dimanche) : encore semaine 1", coldCapForDay(new Date("2026-09-13T10:00:00Z"), ramp), 5);
eq("semaine 2", coldCapForDay(new Date("2026-09-14T10:00:00Z"), ramp), 10);
eq("semaine 3", coldCapForDay(new Date("2026-09-24T10:00:00Z"), ramp), 20);
eq("semaine 4", coldCapForDay(new Date("2026-09-29T10:00:00Z"), ramp), 30);
eq("semaine 5 : le dernier palier tient", coldCapForDay(new Date("2026-10-06T10:00:00Z"), ramp), 30);
eq("semaine 9 : le dernier palier tient", coldCapForDay(new Date("2026-11-03T10:00:00Z"), ramp), 30);
eq("avant le debut de la rampe", coldCapForDay(new Date("2026-09-06T10:00:00Z"), ramp), 0);
eq("rampe non demarree", coldCapForDay(new Date("2026-09-29T10:00:00Z"), { ...ramp, ramp_started_on: null }), 0);
eq("daily_cap plus bas que le palier", coldCapForDay(new Date("2026-09-29T10:00:00Z"), { ...ramp, daily_cap: 12 }), 12);
eq("22h30Z le dimanche = lundi local : semaine 2", coldCapForDay(new Date("2026-09-13T22:30:00Z"), ramp), 10);

// ---- Composition helpers ---------------------------------------------------
eq("objet : CR/LF retires", cleanHeader("Bonjour\r\nBcc: x@y.z"), "Bonjour Bcc: x@y.z");
eq("objet : U+2028 retire", cleanHeader("a\u2028b"), "a b");
eq("nom d'expediteur : guillemets et chevrons neutralises", cleanHeader('Leo "<x>"', { display: true }), "Leo x");
const links = { photos: "https://a.example/contact/T1/photos", stop: "https://a.example/contact/T3/stop", correction: null };
const tu = actionBlock({ address_form: "tu", link_actions: ["photos", "correction", "stop"] }, links);
eq("bloc tu : 2 lignes (correction sans lien ignoree)", tu.length, 2);
eq("bloc tu : formule de desinscription", tu[1].label.startsWith("Ne plus m'écrire"), true);
const vous = actionBlock({ address_form: "vous", link_actions: ["stop", "resolu"] }, { stop: "https://a.example/s", resolu: "https://a.example/r" });
eq("bloc vous : stop puis resolu", vous.map((l) => l.action), ["stop", "resolu"]);
eq("bloc vous : formule", vous[0].label, "Ne plus recevoir nos messages : un clic suffit");
const b = buildBodies({ body: "Bonjour\n\nVoici <b>un test</b>.", block: tu, signature: "Léo\nCasa Minga", identityLine: "Tu reçois ce mail parce que X." });
eq("texte : lien present", b.text.includes("https://a.example/contact/T1/photos"), true);
eq("texte : signature apres le bloc", b.text.indexOf("Casa Minga") > b.text.indexOf("Ne plus m'écrire"), true);
eq("html : balise du corps echappee", b.html.includes("&lt;b&gt;") && !b.html.includes("<b>un test"), true);
eq("html : aucun pixel ni image", /<img/i.test(b.html), false);

console.log(`${total - failed}/${total} controles reussis`);
process.exit(failed === 0 ? 0 : 1);
