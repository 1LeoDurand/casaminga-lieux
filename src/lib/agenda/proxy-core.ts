/**
 * Cœur du proxy de l'agenda public (`/api/agenda/[fonction]`) : fonctions
 * pures et petites structures en mémoire, sans Next ni Supabase, pour rester
 * vérifiables hors serveur (`node scripts/agenda-proxy-check.mjs`).
 *
 * Conception : 08 Import evenements/Conception/T2-5-limitation-de-debit.md
 * (option 2). Tout repose sur le fait que l'admin tourne sur une seule
 * instance Node : cache, coalescence et sémaphore sont alors réellement
 * partagés entre tous les visiteurs.
 */

export const FONCTIONS = ["series", "compteurs", "epingles"] as const;
export type FonctionAgenda = (typeof FONCTIONS)[number];

export function estFonctionAgenda(v: string): v is FonctionAgenda {
  return (FONCTIONS as readonly string[]).includes(v);
}

/** Taille maximale du paramètre `p` une fois décodé. */
export const TAILLE_MAX_PARAMETRES = 8 * 1024;

// ── Décodage et validation des paramètres ──────────────────────

type Controle = (v: unknown) => unknown | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const texte = (max: number): Controle => (v) =>
  typeof v === "string" && v.length <= max ? v : undefined;
const booleen: Controle = (v) => (typeof v === "boolean" ? v : undefined);
const nombre = (min: number, max: number): Controle => (v) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
const entier = (min: number, max: number): Controle => (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
const uuid: Controle = (v) => (typeof v === "string" && UUID.test(v) ? v : undefined);
/** Tableau de textes, tronqué à `max` éléments comme le fait le SQL (0035). */
const textes = (max: number, longueur: number): Controle => (v) =>
  Array.isArray(v) && v.every((e) => typeof e === "string" && e.length <= longueur)
    ? v.slice(0, max)
    : undefined;
const parmi = (valeurs: string[]): Controle => (v) =>
  typeof v === "string" && valeurs.includes(v) ? v : undefined;
/** jsonb libre : objet ou tableau, borné par la taille totale de `p`. */
const json = (maxElements: number): Controle => (v) => {
  if (Array.isArray(v)) return v.slice(0, maxElements);
  return v !== null && typeof v === "object" ? v : undefined;
};

/** Paramètres communs aux trois fonctions (ParametresAgenda côté site). */
const COMMUNS: Record<string, Controle> = {
  p_debut: texte(40),
  p_fin: texte(40),
  p_creneau: texte(20),
  p_gratuit: booleen,
  p_types: textes(30, 60),
  p_termes_titre: textes(40, 80),
  p_duree_min_jours: entier(0, 3650),
  p_mots: textes(8, 80),
  p_lat: nombre(-90, 90),
  p_lng: nombre(-180, 180),
  p_rayon_km: entier(0, 2000),
  p_commune: texte(120),
  p_etablissement: uuid,
  p_organisation: uuid,
  p_en_cours: parmi(["apres", "exclure", "seulement"]),
};

const PAR_FONCTION: Record<FonctionAgenda, Record<string, Controle>> = {
  series: { ...COMMUNS, p_decalage: entier(0, 100_000), p_limite: entier(1, 60) },
  compteurs: { ...COMMUNS, p_moments: json(20), p_formats: json(20) },
  epingles: COMMUNS,
};

export type Parametres = Record<string, unknown>;

/**
 * Décode `p` (JSON en base64url) et le valide contre la liste blanche de la
 * fonction. Rend `null` au moindre écart : clé inconnue, type faux, taille.
 * Une valeur `null` est traitée comme une clé absente.
 */
export function lireParametres(fonction: FonctionAgenda, p: string | null): Parametres | null {
  if (p === null || p === "") return {};
  if (p.length > Math.ceil((TAILLE_MAX_PARAMETRES * 4) / 3) + 4) return null;
  let brut: unknown;
  try {
    const decode = Buffer.from(p, "base64url").toString("utf8");
    if (decode.length > TAILLE_MAX_PARAMETRES) return null;
    brut = JSON.parse(decode);
  } catch {
    return null;
  }
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) return null;

  const controles = PAR_FONCTION[fonction];
  const sortie: Parametres = {};
  for (const [cle, valeur] of Object.entries(brut)) {
    if (valeur === null || valeur === undefined) continue;
    const controle = controles[cle];
    if (!controle) return null;
    const propre = controle(valeur);
    if (propre === undefined) return null;
    sortie[cle] = propre;
  }
  return sortie;
}

/** JSON aux clés triées, à toute profondeur : deux visiteurs, une seule clé. */
function jsonTrie(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonTrie).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${jsonTrie(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export function cleCanonique(fonction: FonctionAgenda, params: Parametres): string {
  return `${fonction}|${jsonTrie(params)}`;
}

// ── Cache LRU à durée de vie ───────────────────────────────────

export class CacheLru<T> {
  private readonly entrees = new Map<string, { valeur: T; expire: number }>();

  constructor(private readonly max: number, private readonly dureeMs: number) {}

  lire(cle: string, maintenant = Date.now()): T | undefined {
    const e = this.entrees.get(cle);
    if (!e) return undefined;
    if (e.expire <= maintenant) {
      this.entrees.delete(cle);
      return undefined;
    }
    // Une Map garde l'ordre d'insertion : réinsérer met la clé en fin de file.
    this.entrees.delete(cle);
    this.entrees.set(cle, e);
    return e.valeur;
  }

  ecrire(cle: string, valeur: T, maintenant = Date.now()): void {
    this.entrees.delete(cle);
    this.entrees.set(cle, { valeur, expire: maintenant + this.dureeMs });
    while (this.entrees.size > this.max) {
      const plusAncienne = this.entrees.keys().next().value;
      if (plusAncienne === undefined) break;
      this.entrees.delete(plusAncienne);
    }
  }

  get taille(): number {
    return this.entrees.size;
  }
}

// ── Sémaphore à file bornée ────────────────────────────────────

export class FileSaturee extends Error {
  constructor() {
    super("file saturée");
  }
}

/**
 * Au plus `places` tâches en vol et `file` en attente. Une tâche qui trouve
 * la file pleine est refusée tout de suite (FileSaturee) : c'est ce refus
 * immédiat qui protège la base d'un script variant ses paramètres.
 */
export class Semaphore {
  private enVol = 0;
  private readonly attente: (() => void)[] = [];

  constructor(private readonly places: number, private readonly file: number) {}

  async executer<T>(tache: () => Promise<T>): Promise<T> {
    if (this.enVol >= this.places) {
      if (this.attente.length >= this.file) throw new FileSaturee();
      await new Promise<void>((resolve) => this.attente.push(resolve));
    }
    this.enVol += 1;
    try {
      return await tache();
    } finally {
      this.enVol -= 1;
      this.attente.shift()?.();
    }
  }
}

// ── Coalescence ────────────────────────────────────────────────

/** Deux demandes identiques simultanées partagent un seul appel. */
export class Coalescence<T> {
  private readonly enCours = new Map<string, Promise<T>>();

  executer(cle: string, tache: () => Promise<T>): Promise<T> {
    const deja = this.enCours.get(cle);
    if (deja) return deja;
    const promesse = tache().finally(() => this.enCours.delete(cle));
    this.enCours.set(cle, promesse);
    return promesse;
  }
}

// ── Adresse du client ──────────────────────────────────────────

function estPrivee(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  if (v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(v);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * L'adresse à limiter. `X-Forwarded-For` se lit de droite à gauche : chaque
 * relais ajoute à droite l'adresse qu'il a vue, alors que la gauche est écrite
 * par le client lui-même. On prend donc la première adresse publique en
 * partant de la droite (les relais internes de l'hébergeur sont privés).
 * Prendre le premier élément, comme le font d'autres routes, laisse un script
 * changer d'« adresse » à chaque requête.
 */
export function ipClient(xForwardedFor: string | null, xRealIp: string | null): string {
  const chaine = (xForwardedFor ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = chaine.length - 1; i >= 0; i -= 1) {
    if (!estPrivee(chaine[i])) return chaine[i];
  }
  return xRealIp?.trim() || chaine[chaine.length - 1] || "inconnue";
}
