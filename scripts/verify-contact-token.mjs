#!/usr/bin/env node
/**
 * Vérification des jetons du lien signé (/contact/<jeton>) et des contrôles
 * purs du dépôt de photos et de la correction.
 *
 *   node scripts/verify-contact-token.mjs                 # secret lu dans PORTAL_LINK_SECRET
 *   node scripts/verify-contact-token.mjs <secret-d-essai> # si la variable est absente du shell
 *
 * Le secret n'est jamais affiché : le script dit seulement d'où il vient.
 * Transpile à la volée src/lib/portal/token.ts, src/lib/outreach/consent.ts et
 * correction.ts avec le compilateur TypeScript déjà installé (le dépôt n'a pas
 * de cadre de tests). Sortie non nulle au premier échec.
 */
import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = mkdtempSync(join(tmpdir(), "contact-token-"));

function transpile(rel) {
  const src = readFileSync(join(ROOT, "src", rel + ".ts"), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dest = join(OUT, rel + ".mjs");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, js);
  return pathToFileURL(dest).href;
}

let failures = 0;
let passes = 0;
function check(label, cond) {
  if (cond) {
    passes++;
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.log(`ECHEC ${label}`);
  }
}
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

// ---- Secret : environnement du shell, sinon valeur d'essai passée en argument.
let source;
if (process.env.PORTAL_LINK_SECRET) {
  source = "variable d'environnement PORTAL_LINK_SECRET du shell";
} else if (process.argv[2]) {
  process.env.PORTAL_LINK_SECRET = process.argv[2];
  source = "valeur d'ESSAI passée en argument (PORTAL_LINK_SECRET absente du shell)";
} else {
  console.error("PORTAL_LINK_SECRET absente du shell : passez un secret d'essai en argument.");
  process.exit(2);
}
console.log(`Secret : ${source}\n`);

try {
  const tokenUrl = transpile("lib/portal/token");
  const consentUrl = transpile("lib/outreach/consent");
  const correctionUrl = transpile("lib/outreach/correction");
  const SECRET = process.env.PORTAL_LINK_SECRET;

  const T = await import(tokenUrl + "?s=1");
  const C = await import(consentUrl);
  const R = await import(correctionUrl);

  const DAY = 86_400_000;
  const now = Date.parse("2026-09-29T12:00:00+02:00");
  const thread = "3f2b8c1e-9d4a-4e6b-8a7c-1234567890ab";
  const hex = thread.replaceAll("-", "");
  const flip = (s) => (s[0] === "A" ? "B" : "A") + s.slice(1);

  // ---- Jeton valide
  const tok = T.signScopedToken("o1", thread, now, "photos");
  const parts = tok.split(".");
  check("forme : quatre segments o1.<hex32>.<émission>.<signature>",
    parts.length === 4 && parts[0] === "o1" && parts[1] === hex && /^[0-9a-z]+$/.test(parts[2]));
  check("caractères sûrs pour une URL", /^[A-Za-z0-9_.-]+$/.test(tok));
  check("aucune donnée personnelle : ni tiret d'uuid, ni arobase", // The base64url signature may contain "-": only the readable segments are checked.
    !tok.includes("@") && !parts.slice(0, 3).join(".").includes("-"));
  const ok = T.verifyScopedToken("o1", tok, now, "photos");
  check("valide : sujet restitué avec ses tirets", ok?.subject === thread);
  check("valide : date d'émission restituée à la seconde", ok?.issuedAtMs === Math.floor(now / 1000) * 1000);
  check("valide : encore accepté 119 jours plus tard (la durée est jugée par le programme)",
    T.verifyScopedToken("o1", tok, now + 119 * DAY, "photos")?.subject === thread);

  // ---- Expiré (durée du programme, 120 jours par défaut)
  const ttl = 120 * DAY;
  check("expiré : à 120 jours pile, pas encore", T.scopedTokenAgeExceeded(ok.issuedAtMs, ttl, ok.issuedAtMs + ttl) === false);
  check("expiré : à 120 jours et une seconde, refusé", T.scopedTokenAgeExceeded(ok.issuedAtMs, ttl, ok.issuedAtMs + ttl + 1000) === true);
  check("expiré : délai plus court d'un autre programme (7 jours)", T.scopedTokenAgeExceeded(ok.issuedAtMs, 7 * DAY, now + 8 * DAY) === true);
  check("émis dans le futur (au-delà de 5 min) refusé",
    T.verifyScopedToken("o1", T.signScopedToken("o1", thread, now + 10 * 60_000, "photos"), now, "photos") === null);
  check("léger décalage d'horloge toléré",
    T.verifyScopedToken("o1", T.signScopedToken("o1", thread, now + 60_000, "photos"), now, "photos")?.subject === thread);

  // ---- Lien à l'action
  check("lié à l'action : refusé pour une autre action", T.verifyScopedToken("o1", tok, now, "stop") === null);
  check("lié à l'action : refusé sans action", T.verifyScopedToken("o1", tok, now) === null);
  const stopTok = T.signScopedToken("o1", thread, now, "stop");
  check("jeton stop valide pour stop", T.verifyScopedToken("o1", stopTok, now, "stop")?.subject === thread);
  check("jeton stop refusé pour photos", T.verifyScopedToken("o1", stopTok, now, "photos") === null);
  const free = T.signScopedToken("o1", thread, now);
  check("jeton sans action : valide sans action", T.verifyScopedToken("o1", free, now)?.subject === thread);
  check("jeton sans action : refusé si une action est exigée", T.verifyScopedToken("o1", free, now, "photos") === null);
  check("action invalide refusée à la signature", throws(() => T.signScopedToken("o1", thread, now, "Photos ../")));
  check("action invalide refusée à la vérification", T.verifyScopedToken("o1", tok, now, "PHOTOS") === null);

  // ---- Falsifié
  const [, h, iat, sig] = parts;
  check("falsifié : signature altérée", T.verifyScopedToken("o1", `o1.${h}.${iat}.${flip(sig)}`, now, "photos") === null);
  const otherThread = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee".replaceAll("-", "");
  check("falsifié : autre fil, même signature", T.verifyScopedToken("o1", `o1.${otherThread}.${iat}.${sig}`, now, "photos") === null);
  check("falsifié : émission rajeunie", T.verifyScopedToken("o1", `o1.${h}.${(parseInt(iat, 36) + 3600).toString(36)}.${sig}`, now, "photos") === null);
  check("falsifié : autre scope", T.verifyScopedToken("o1", `o2.${h}.${iat}.${sig}`, now, "photos") === null);
  check("falsifié : signature d'un autre secret", (() => {
    const other = createHmac("sha256", "autre-secret").update(`o1|${thread}|${iat}|photos`).digest("base64url");
    return T.verifyScopedToken("o1", `o1.${h}.${iat}.${other}`, now, "photos") === null;
  })());
  check("falsifié : signature sans l'action recyclée pour une action",
    T.verifyScopedToken("o1", `o1.${h}.${iat}.${free.split(".")[3]}`, now, "photos") === null);
  check("sujet qui n'est pas un uuid refusé à la signature", throws(() => T.signScopedToken("o1", "un-fil-quelconque", now)));
  for (const bad of ["", ".", "...", "o1...", "o1.zz.a.b", `o1.${h}..${sig}`, `o1.${h}.${iat}`, `o1.${h}.${iat}.${sig}.x`, "x".repeat(2000)]) {
    check(`entrée invalide refusée : ${JSON.stringify(bad.slice(0, 24))}`, T.verifyScopedToken("o1", bad, now, "photos") === null);
  }

  // ---- Croisé avec le portail, dans les deux sens
  const portalTok = T.signPortalToken("membre@example.invalid", now);
  check("portail -> contact : un jeton du portail ne vaut pas pour /contact", T.verifyScopedToken("o1", portalTok, now, "photos") === null);
  check("portail -> contact : même sans action", T.verifyScopedToken("o1", portalTok, now) === null);
  check("contact -> portail : un jeton /contact ne vaut pas pour l'espace", T.verifyPortalToken(tok, now) === null);
  check("contact -> portail : jeton sans action non plus", T.verifyPortalToken(free, now) === null);
  check("contact -> portail : découpé en trois segments non plus",
    T.verifyPortalToken(`${h}.${iat}.${sig}`, now) === null && T.verifyPortalToken(`o1.${h}.${sig}`, now) === null);
  const v1 = `${Buffer.from("membre@example.invalid").toString("base64url")}.${createHmac("sha256", SECRET).update("membre@example.invalid").digest("base64url")}`;
  check("jeton portail v1 : refusé pour /contact", T.verifyScopedToken("o1", v1, now, "photos") === null);
  check("le jeton du portail garde son comportement", T.verifyPortalToken(portalTok, now) === "membre@example.invalid");

  // ---- Sans secret : fermé
  delete process.env.PORTAL_LINK_SECRET;
  const T0 = await import(tokenUrl + "?s=0");
  check("sans secret : verify renvoie null", T0.verifyScopedToken("o1", tok, now, "photos") === null);
  check("sans secret : sign lève une erreur", throws(() => T0.signScopedToken("o1", thread, now, "photos")));
  process.env.PORTAL_LINK_SECRET = SECRET;

  // ---- Dépôt de fichiers
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
  const text = new TextEncoder().encode("<?php echo 1; ?>  faux jpeg");
  check("octets de tête : JPEG", C.sniffImage(jpeg)?.mime === "image/jpeg");
  check("octets de tête : PNG", C.sniffImage(png)?.mime === "image/png");
  check("octets de tête : WebP", C.sniffImage(webp)?.mime === "image/webp");
  check("octets de tête : GIF refusé", C.sniffImage(gif) === null);
  check("octets de tête : texte refusé", C.sniffImage(text) === null);
  check("octets de tête : fichier vide refusé", C.sniffImage(new Uint8Array(0)) === null);
  check("RIFF sans WEBP refusé (WAV)", C.sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45])) === null);

  const v = (files) => C.validatePhotoFiles(files);
  check("fichiers : trois images valides", v([{ name: "a.jpg", bytes: jpeg }, { name: "b.PNG", bytes: png }, { name: "c.webp", bytes: webp }]).ok === true);
  check("faux JPEG (contenu texte) refusé", v([{ name: "vacances.jpg", bytes: text }]).error === "bad_type");
  check("vrai JPEG sous extension .pdf refusé", v([{ name: "doc.pdf", bytes: jpeg }]).error === "bad_type");
  check("vrai JPEG sans extension refusé", v([{ name: "photo", bytes: jpeg }]).error === "bad_type");
  check("GIF déguisé en .jpg refusé", v([{ name: "a.jpg", bytes: gif }]).error === "bad_type");
  const big = new Uint8Array(11 * 1024 * 1024); big.set(jpeg);
  check("fichier de 11 Mo refusé", v([{ name: "grosse.jpg", bytes: big }]).error === "too_big");
  const exact = new Uint8Array(10 * 1024 * 1024); exact.set(jpeg);
  check("fichier de 10 Mo pile accepté", v([{ name: "limite.jpg", bytes: exact }]).ok === true);
  const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `p${i}.jpg`, bytes: jpeg }));
  check("onze fichiers refusés", v(eleven).error === "too_many");
  check("dix fichiers acceptés", v(eleven.slice(0, 10)).ok === true);
  check("fichier vide ignoré (champ file non rempli)", (() => {
    const r = v([{ name: "", bytes: new Uint8Array(0) }]);
    return r.ok === true && r.files.length === 0;
  })());
  check("nettoyage : chemin et accents", C.cleanFileName("../../etc/Été 2024 (final).JPG") === "ete-2024-final");
  check("nettoyage : nom vide", C.cleanFileName("....jpg") === "photo");
  check("nettoyage : 60 caractères au plus", C.cleanFileName("a".repeat(200) + ".jpg").length <= 60);
  check("nettoyage : aucun caractère hors [a-z0-9._-]", /^[a-z0-9._-]+$/.test(C.cleanFileName("é%00<script>\";.png")));
  check("nettoyage : nom \\ Windows", C.cleanFileName("C:\\Users\\x\\Ma photo.png") === "ma-photo");

  // ---- Accord photos
  const base = { licence: "CC-BY-4.0", credit: "Habitat des Lilas", name: "Camille Roux", role: "co-gérante", placeName: "Les Lilas", scope: "les_deux" };
  const t1 = C.buildConsentText(base);
  check("accord : version et licence dans le texte", t1.includes(C.CONSENT_VERSION) && t1.includes("CC BY 4.0") && t1.includes("Habitat des Lilas"));
  check("accord : empreinte SHA-256 de 64 caractères hexadécimaux", /^[0-9a-f]{64}$/.test(C.sha256Hex(t1)));
  check("accord : même texte, même empreinte", C.sha256Hex(t1) === C.sha256Hex(C.buildConsentText({ ...base })));
  check("accord : crédit différent, empreinte différente", C.sha256Hex(t1) !== C.sha256Hex(C.buildConsentText({ ...base, credit: "Autre" })));
  check("accord : licence CC BY-SA citée avec son adresse",
    C.buildConsentText({ ...base, licence: "CC-BY-SA-4.0" }).includes("creativecommons.org/licenses/by-sa/4.0"));
  check("accord : l'aperçu reprend les mêmes phrases", C.consentPreview("Les Lilas").includes("Être l'auteur des photos concernées"));
  const get = (o) => (k) => o[k];
  const good = { licence: "CC-BY-4.0", scope: "les_deux", name: "Camille", credit: "Les Lilas", accept: "on" };
  check("formulaire valide accepté", C.parsePhotoFields(get(good)).ok === true);
  for (const [field, value, err] of [
    ["licence", "CC0", "licence"], ["licence", "CC-BY-NC-4.0", "licence"], ["scope", "tout", "scope"],
    ["name", "C", "name"], ["credit", " ", "credit"], ["accept", undefined, "accept"],
  ]) {
    const r = C.parsePhotoFields(get({ ...good, [field]: value }));
    check(`formulaire refusé : ${field}=${JSON.stringify(value)}`, r.ok === false && r.error === err);
  }
  check("crédit : retours à la ligne écrasés (pas d'injection de ligne)",
    C.parsePhotoFields(get({ ...good, credit: "Les Lilas\r\nBcc: x@y.z" })).choices.credit === "Les Lilas Bcc: x@y.z");

  // ---- Correction
  check("correction : texte normal", R.cleanCorrectionText("Le nom du lieu est mal orthographié.").ok === true);
  check("correction : 4 000 caractères acceptés", R.cleanCorrectionText("a".repeat(4000)).ok === true);
  check("correction : 4 001 caractères refusés", R.cleanCorrectionText("a".repeat(4001)).error === "long");
  check("correction : vide ou trop court refusé", R.cleanCorrectionText("   ").error === "empty" && R.cleanCorrectionText("abcd").error === "empty");
  check("correction : caractères de contrôle retirés, sauts de ligne gardés",
    R.cleanCorrectionText("ligne un\r\nligne\u0000 deux").text === "ligne un\nligne deux");
} finally {
  rmSync(OUT, { recursive: true, force: true });
}

console.log(`\n${passes} réussis, ${failures} échec(s)`);
process.exit(failures ? 1 : 0);
