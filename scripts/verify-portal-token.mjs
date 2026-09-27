#!/usr/bin/env node
/**
 * Vérification du jeton de l'espace adhérent et des adresses de lien.
 *
 *   node scripts/verify-portal-token.mjs
 *
 * Le dépôt n'a pas de cadre de tests : ce script transpile à la volée
 * src/lib/portal/token.ts et src/lib/portal/url.ts avec le compilateur
 * TypeScript déjà installé, puis vérifie leur comportement. Il n'utilise
 * aucun secret réel : un secret de test est tiré au hasard à chaque lancement.
 * Sortie non nulle au premier échec.
 */
import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = mkdtempSync(join(tmpdir(), "portal-token-"));

/** Transpile un module de src/lib vers OUT, en résolvant l'alias "@/lib/...". */
function transpile(rel) {
  const src = readFileSync(join(ROOT, "src", rel + ".ts"), "utf8");
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  js = js.replace(/from "@\/(lib\/[^"]+)"/g, (_m, p) => `from "${pathToFileURL(join(OUT, p + ".mjs")).href}"`);
  const dest = join(OUT, rel + ".mjs");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, js);
  return dest;
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

const b64 = (s) => Buffer.from(s).toString("base64url");

try {
  const tokenPath = transpile("lib/portal/token");
  transpile("lib/site-public/url");
  const urlPath = transpile("lib/portal/url");

  const SECRET = randomBytes(32).toString("base64");
  process.env.PORTAL_LINK_SECRET = SECRET;
  delete process.env.NEXT_PUBLIC_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;

  const T = await import(pathToFileURL(tokenPath).href + "?s=1");
  const U = await import(pathToFileURL(urlPath).href + "?s=1");

  const email = "Test.Adherent@Exemple.org ";
  const norm = "test.adherent@exemple.org";
  const DAY = 86_400_000;
  const now = Date.parse("2026-09-27T12:00:00+02:00");

  // Format v2
  const tok = T.signPortalToken(email, now);
  check("v2 : trois segments", tok.split(".").length === 3);
  check("v2 : caractères sûrs pour une URL", /^[A-Za-z0-9_.-]+$/.test(tok));
  check("v2 : valide à l'émission, courriel normalisé", T.verifyPortalToken(tok, now) === norm);
  check("v2 : valide à J+29", T.verifyPortalToken(tok, now + 29 * DAY) === norm);
  check("v2 : refusé à J+30 et une seconde", T.verifyPortalToken(tok, now + 30 * DAY + 1000) === null);
  check("durée de vie = 30 jours", T.PORTAL_TOKEN_TTL_MS === 30 * DAY);

  const [e, iat, sig] = tok.split(".");
  const flip = (s) => (s[0] === "A" ? "B" : "A") + s.slice(1);
  check("v2 : signature altérée refusée", T.verifyPortalToken(`${e}.${iat}.${flip(sig)}`, now) === null);
  check("v2 : courriel substitué refusé", T.verifyPortalToken(`${b64("autre@exemple.org")}.${iat}.${sig}`, now) === null);
  const lateIat = (parseInt(iat, 36) + 3600).toString(36);
  check("v2 : date d'émission rajeunie refusée", T.verifyPortalToken(`${e}.${lateIat}.${sig}`, now) === null);
  check("v2 : émis dans le futur (au-delà de 5 min) refusé",
    T.verifyPortalToken(T.signPortalToken(norm, now + 10 * 60_000), now) === null);
  check("v2 : léger décalage d'horloge toléré",
    T.verifyPortalToken(T.signPortalToken(norm, now + 60_000), now) === norm);
  check("v2 : autre secret refusé", (() => {
    const other = createHmac("sha256", "autre").update(`v2|${norm}|${iat}`).digest("base64url");
    return T.verifyPortalToken(`${e}.${iat}.${other}`, now) === null;
  })());

  // Format v1 (liens déjà envoyés), accepté jusqu'à la fin de la transition
  const v1 = `${b64(norm)}.${createHmac("sha256", SECRET).update(norm).digest("base64url")}`;
  check("v1 : accepté pendant la transition", T.verifyPortalToken(v1, now) === norm);
  check("v1 : accepté le 31/12/2026 à 23 h 59 (Paris)",
    T.verifyPortalToken(v1, Date.parse("2026-12-31T23:59:00+01:00")) === norm);
  check("v1 : refusé à partir du 01/01/2027 (Paris)",
    T.verifyPortalToken(v1, Date.parse("2027-01-01T00:00:00+01:00")) === null);
  const v1sig = v1.split(".")[1];
  check("v1 : signature altérée refusée", T.verifyPortalToken(`${b64(norm)}.${flip(v1sig)}`, now) === null);

  // Une signature v1 ne se recycle pas en v2, ni l'inverse
  check("v1 recyclé en v2 refusé", T.verifyPortalToken(`${b64(norm)}.${iat}.${v1sig}`, now) === null);
  const forged = `v2|${norm}|${iat}`;
  check("v2 recyclé en v1 refusé", T.verifyPortalToken(`${b64(forged)}.${sig}`, now) === null);

  // Entrées dégénérées
  for (const bad of ["", ".", "..", "a.b.c.d", "abc", `${e}..${sig}`, `${e}.ZZ.${sig}`, "x".repeat(2000)]) {
    check(`entrée invalide refusée : ${JSON.stringify(bad.slice(0, 20))}`, T.verifyPortalToken(bad, now) === null);
  }

  // Adresses de lien
  const pub = U.portalUrlFor(tok, "public");
  check("public : https://casaminga.com/mon-espace#<jeton>", pub === `https://casaminga.com/mon-espace#${tok}`);
  check("public : pas de ? (jeton hors de la requête)", !pub.includes("?"));
  check("public : le jeton n'est que dans le fragment", new URL(pub).pathname === "/mon-espace" && new URL(pub).hash === `#${tok}`);
  check("admin : https://admin.casaminga.com/espace/<jeton>",
    U.portalUrlFor(tok, "admin") === `https://admin.casaminga.com/espace/${tok}`);
  const signedPub = U.portalUrlForEmail(email, "public");
  check("portalUrlForEmail(public) porte un jeton v2 valide",
    T.verifyPortalToken(new URL(signedPub).hash.slice(1)) === norm);

  // Sans secret : signature impossible, vérification fermée
  delete process.env.PORTAL_LINK_SECRET;
  const T0 = await import(pathToFileURL(tokenPath).href + "?s=0");
  check("sans secret : verify renvoie null", T0.verifyPortalToken(tok, now) === null);
  check("sans secret : sign lève une erreur", (() => {
    try { T0.signPortalToken(norm); return false; } catch { return true; }
  })());
} finally {
  rmSync(OUT, { recursive: true, force: true });
}

console.log(`\n${passes} réussis, ${failures} échec(s)`);
process.exit(failures ? 1 : 0);
