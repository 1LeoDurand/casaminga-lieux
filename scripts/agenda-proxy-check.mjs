// Checks the pure core of the public agenda proxy (src/lib/agenda/proxy-core.ts):
// parameter whitelist, canonical key, LRU cache, bounded semaphore, coalescing,
// client IP. No network, no database.
//
//   node scripts/agenda-proxy-check.mjs
//
// The project has no test runner: the module is transpiled on the fly, like
// scripts/outreach-parse-check.mjs.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const ts = require("typescript");
const outDir = join(root, "node_modules", ".cache", "agenda-proxy-check");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "package.json"), '{"type":"commonjs"}');
const src = readFileSync(join(root, "src", "lib", "agenda", "proxy-core.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: "commonjs", target: "es2022" } }).outputText;
writeFileSync(join(outDir, "proxy-core.js"), js);
const m = require(join(outDir, "proxy-core.js"));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`ok  ${name}`); };
const okAsync = async (name, fn) => { await fn(); n += 1; console.log(`ok  ${name}`); };

ok("empty p means no filter", () => assert.deepEqual(m.lireParametres("series", null), {}));
ok("valid series parameters pass", () => {
  const p = { p_types: ["concert"], p_commune: "Montpellier", p_limite: 24, p_decalage: 0, p_gratuit: true };
  assert.deepEqual(m.lireParametres("series", b64(p)), p);
});
ok("null values are dropped", () => assert.deepEqual(m.lireParametres("series", b64({ p_commune: null })), {}));
ok("unknown key is rejected", () => assert.equal(m.lireParametres("series", b64({ p_sql: "x" })), null));
ok("series key refused on epingles", () => assert.equal(m.lireParametres("epingles", b64({ p_limite: 10 })), null));
ok("limit above 60 is rejected", () => assert.equal(m.lireParametres("series", b64({ p_limite: 61 })), null));
ok("wrong type is rejected", () => assert.equal(m.lireParametres("series", b64({ p_gratuit: "oui" })), null));
ok("bad uuid is rejected", () => assert.equal(m.lireParametres("series", b64({ p_organisation: "1 or 1=1" })), null));
ok("arrays are truncated like SQL", () => {
  const mots = Array.from({ length: 12 }, (_, i) => `m${i}`);
  assert.equal(m.lireParametres("series", b64({ p_mots: mots })).p_mots.length, 8);
});
ok("oversized p is rejected", () => assert.equal(m.lireParametres("series", b64({ p_commune: "x".repeat(9000) })), null));
ok("garbage is rejected", () => assert.equal(m.lireParametres("series", "%%%"), null));
ok("array at top level is rejected", () => assert.equal(m.lireParametres("series", b64([1])), null));
ok("compteurs accepts moments and formats", () => {
  const p = { p_formats: [{ id: "concert", types: ["concert"], termes: [], duree_min_jours: null }], p_moments: { we: ["a", "b"] } };
  assert.deepEqual(m.lireParametres("compteurs", b64(p)), p);
});
ok("canonical key ignores key order, at any depth", () => {
  const a = m.cleCanonique("compteurs", { p_commune: "X", p_moments: { b: 1, a: 2 } });
  const b = m.cleCanonique("compteurs", { p_moments: { a: 2, b: 1 }, p_commune: "X" });
  assert.equal(a, b);
  assert.notEqual(a, m.cleCanonique("series", { p_commune: "X", p_moments: { b: 1, a: 2 } }));
});
ok("LRU expires and evicts the oldest", () => {
  const c = new m.CacheLru(2, 1000);
  c.ecrire("a", 1, 0); c.ecrire("b", 2, 0);
  assert.equal(c.lire("a", 10), 1);          // "a" becomes the most recent
  c.ecrire("c", 3, 20);                       // evicts "b"
  assert.equal(c.lire("b", 30), undefined);
  assert.equal(c.lire("a", 30), 1);
  assert.equal(c.lire("a", 2000), undefined); // expired
});
ok("client IP: rightmost public address wins over a spoofed left one", () => {
  assert.equal(m.ipClient("1.2.3.4, 203.0.113.9, 10.0.0.5", null), "203.0.113.9");
  assert.equal(m.ipClient("203.0.113.9", null), "203.0.113.9");
  assert.equal(m.ipClient(null, "198.51.100.7"), "198.51.100.7");
  assert.equal(m.ipClient("10.0.0.1", null), "10.0.0.1");
  assert.equal(m.ipClient(null, null), "inconnue");
});

await okAsync("semaphore: 2 in flight, 1 queued, the 4th is refused at once", async () => {
  const s = new m.Semaphore(2, 1);
  let enVol = 0, max = 0;
  const tache = () => s.executer(async () => { enVol += 1; max = Math.max(max, enVol); await new Promise((r) => setTimeout(r, 30)); enVol -= 1; return 1; });
  const t = [tache(), tache(), tache()];
  await assert.rejects(tache(), m.FileSaturee);
  assert.deepEqual(await Promise.all(t), [1, 1, 1]);
  assert.equal(max, 2);
  assert.equal(await tache(), 1);             // free again afterwards
});
await okAsync("semaphore releases its slot when the task throws", async () => {
  const s = new m.Semaphore(1, 0);
  await assert.rejects(s.executer(async () => { throw new Error("boom"); }), /boom/);
  assert.equal(await s.executer(async () => 2), 2);
});
await okAsync("coalescing: identical concurrent calls share one run, errors are not kept", async () => {
  const c = new m.Coalescence();
  let appels = 0;
  const tache = async () => { appels += 1; await new Promise((r) => setTimeout(r, 10)); return "x"; };
  const [a, b] = await Promise.all([c.executer("k", tache), c.executer("k", tache)]);
  assert.equal(a, "x"); assert.equal(b, "x"); assert.equal(appels, 1);
  await c.executer("k", tache); assert.equal(appels, 2);
  await assert.rejects(c.executer("e", async () => { throw new Error("no"); }));
  assert.equal(await c.executer("e", async () => "ok"), "ok");
});

console.log(`\n${n} checks passed`);
