import { promises as fs } from "node:fs";
import path from "node:path";
import { createAdminClient } from "./guard";

/**
 * Données de l'espace « Portail public », côté administration.
 *
 * Le portail casaminga.com lit la base et n'y écrit jamais : tout ce qui le
 * pilote se décide ici. Ces fonctions ne font que lire, et n'inventent rien :
 * un chiffre absent est renvoyé à zéro ou à null, jamais estimé.
 */

const PUBLIE = ["publie", "confirme", "planifie"];
const SOURCE_MAISON = "casaminga";

/** Même règle que `isImportedOrg` côté portail : moissonné et non revendiqué. */
function estImporte(org: { source: string | null; claimed_at: string | null }): boolean {
  return !!org.source && org.source !== SOURCE_MAISON && !org.claimed_at;
}

export interface CatalogueStats {
  aVenir: number;
  passes: number;
  lieuxAVenir: number;
  valides: number;
  duReseau: number;
  avecImage: number;
  gratuits: number;
  typeAutre: number;
  lieuxImportes: number;
  lieuxReseau: number;
  lieuxAvecEmail: number;
  dernierImport: string | null;
  importesDernierJour: number;
}

export async function getCatalogueStats(): Promise<CatalogueStats | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const [{ data: evenements }, { data: orgs }] = await Promise.all([
    admin
      .from("evenements")
      .select("id, organization_id, start_at, type, price, photos, portal_status, created_at")
      .eq("show_on_public_site", true)
      .in("status", PUBLIE),
    admin.from("organizations").select("id, source, claimed_at, email"),
  ]);

  const lignes = evenements ?? [];
  const structures = orgs ?? [];
  const maintenant = Date.now();
  const aVenir = lignes.filter((e) => new Date(e.start_at).getTime() >= maintenant);

  const importes = new Set(structures.filter(estImporte).map((o) => o.id));

  // Date du dernier import, et volume de ce jour-là : les imports se font par
  // vagues, la date seule ne dirait pas si c'était une fiche ou cent.
  const creations = lignes.map((e) => e.created_at).filter(Boolean).sort();
  const dernier = creations.length ? creations[creations.length - 1] : null;
  const jourDernier = dernier ? dernier.slice(0, 10) : null;

  return {
    aVenir: aVenir.length,
    passes: lignes.length - aVenir.length,
    lieuxAVenir: new Set(aVenir.map((e) => e.organization_id)).size,
    valides: aVenir.filter((e) => e.portal_status === "approved").length,
    duReseau: aVenir.filter((e) => !importes.has(e.organization_id)).length,
    avecImage: aVenir.filter((e) => Array.isArray(e.photos) && e.photos.length > 0).length,
    gratuits: aVenir.filter((e) => e.price === 0).length,
    typeAutre: aVenir.filter((e) => e.type === "autre").length,
    lieuxImportes: structures.filter(estImporte).length,
    lieuxReseau: structures.filter((o) => !estImporte(o)).length,
    lieuxAvecEmail: structures.filter((o) => estImporte(o) && !!o.email).length,
    dernierImport: dernier,
    importesDernierJour: jourDernier
      ? lignes.filter((e) => (e.created_at ?? "").slice(0, 10) === jourDernier).length
      : 0,
  };
}

export interface LieuListeBlanche {
  uid: string;
  canonique: string;
  nom: string;
  ville: string;
  recense: string;
  methode: string;
  /** Vu en base : l'organisation créée par l'import, si elle existe. */
  organisationId: string | null;
  slug: string | null;
  revendique: boolean;
  evenements: number;
  aVenir: number;
  dernierImport: string | null;
}

export interface ListeBlanche {
  note: string;
  lieux: LieuListeBlanche[];
  identifiants: number;
  lieuxReels: number;
}

/**
 * La liste blanche, lue dans le fichier du dépôt.
 *
 * Elle vit dans `scripts/lieux-tiers-lieux.json` parce que c'est le script
 * d'import qui la consomme, et qu'un fichier versionné garde la trace de
 * chaque élargissement. Cette page l'affiche, elle ne la modifie pas : la
 * modifier depuis le navigateur demanderait de la sortir du dépôt, donc de
 * perdre cet historique.
 */
export async function getListeBlanche(): Promise<ListeBlanche | null> {
  let brut: string;
  try {
    brut = await fs.readFile(
      path.join(process.cwd(), "scripts", "lieux-tiers-lieux.json"),
      "utf8",
    );
  } catch {
    return null;
  }

  const doc = JSON.parse(brut) as {
    _lecture: string;
    lieux: { uid: string; canonique?: string; nom: string; ville: string; recense: string; methode?: string }[];
  };

  const admin = createAdminClient();
  const lieux: LieuListeBlanche[] = doc.lieux.map((l) => ({
    uid: l.uid,
    canonique: l.canonique ?? l.uid,
    nom: l.nom,
    ville: l.ville,
    recense: l.recense,
    methode: l.methode ?? "nom + ville",
    organisationId: null,
    slug: null,
    revendique: false,
    evenements: 0,
    aVenir: 0,
    dernierImport: null,
  }));

  if (admin) {
    // Les identifiants OpenAgenda sont reliés aux organisations par la table
    // de provenance : c'est elle qui fait foi, pas le nom, qui peut différer.
    const { data: provenance } = await admin
      .from("evenements_import")
      .select("event_id, imported_at, evenements(organization_id, start_at)");

    const parLieu = new Map<string, { aVenir: boolean; importe: string | null }[]>();
    for (const p of (provenance ?? []) as unknown as {
      imported_at: string | null;
      evenements: { organization_id: string; start_at: string } | null;
    }[]) {
      if (!p.evenements) continue;
      const cle = p.evenements.organization_id;
      const liste = parLieu.get(cle) ?? [];
      liste.push({
        aVenir: new Date(p.evenements.start_at).getTime() >= Date.now(),
        importe: p.imported_at,
      });
      parLieu.set(cle, liste);
    }

    // Rapprochement par nom normalisé, faute d'identifiant OpenAgenda stocké
    // sur l'organisation elle-même.
    const { data: orgs } = await admin.from("organizations").select("id, name, slug, claimed_at, source");
    const parNom = new Map<string, { id: string; slug: string; claimed_at: string | null }>();
    for (const o of orgs ?? []) parNom.set(normaliser(o.name), o);

    for (const l of lieux) {
      const org = parNom.get(normaliser(l.nom));
      if (!org) continue;
      const evts = parLieu.get(org.id) ?? [];
      const dates = evts.map((e) => e.importe).filter(Boolean).sort() as string[];
      l.organisationId = org.id;
      l.slug = org.slug;
      l.revendique = !!org.claimed_at;
      l.evenements = evts.length;
      l.aVenir = evts.filter((e) => e.aVenir).length;
      l.dernierImport = dates.length ? dates[dates.length - 1] : null;
    }
  }

  return {
    note: doc._lecture,
    lieux,
    identifiants: doc.lieux.length,
    lieuxReels: new Set(doc.lieux.map((l) => l.canonique ?? l.uid)).size,
  };
}

function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface JourImport {
  jour: string;
  evenements: number;
  lieux: number;
  premier: string;
  dernier: string;
}

/** Historique des imports, reconstitué depuis la date de création des fiches. */
export async function getHistoriqueImports(limite = 40): Promise<JourImport[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("evenements_import")
    .select("event_id, imported_at, evenements(organization_id)")
    .order("imported_at", { ascending: false })
    .limit(5000);

  const parJour = new Map<string, { evenements: number; lieux: Set<string>; heures: string[] }>();
  for (const ligne of (data ?? []) as unknown as {
    imported_at: string | null;
    evenements: { organization_id: string } | null;
  }[]) {
    if (!ligne.imported_at) continue;
    const jour = ligne.imported_at.slice(0, 10);
    const entree = parJour.get(jour) ?? { evenements: 0, lieux: new Set<string>(), heures: [] };
    entree.evenements += 1;
    if (ligne.evenements) entree.lieux.add(ligne.evenements.organization_id);
    entree.heures.push(ligne.imported_at);
    parJour.set(jour, entree);
  }

  return [...parJour.entries()]
    .map(([jour, e]) => {
      const heures = e.heures.sort();
      return {
        jour,
        evenements: e.evenements,
        lieux: e.lieux.size,
        premier: heures[0],
        dernier: heures[heures.length - 1],
      };
    })
    .sort((a, b) => b.jour.localeCompare(a.jour))
    .slice(0, limite);
}

export interface PagePortail {
  chemin: string;
  role: string;
  indexation: "indexee" | "noindex" | "conditionnelle";
  note?: string;
  dansSitemap: boolean;
  code: number | null;
}

/**
 * Les pages du portail, leur rôle et leur règle d'indexation.
 *
 * Le code HTTP est presque toujours 200 : une application monopage sert le
 * même fichier pour toutes les adresses, la réécriture d'Apache s'en charge.
 * Il ne prouve donc que la réponse du serveur, pas l'existence de la page.
 * La colonne qui renseigne vraiment est la présence dans le sitemap.
 */
const PAGES: Omit<PagePortail, "dansSitemap" | "code">[] = [
  { chemin: "/", role: "Accueil : rendez-vous par moment, lieux, carte", indexation: "indexee" },
  { chemin: "/agenda", role: "Catalogue complet des rendez-vous", indexation: "indexee" },
  { chemin: "/lieux", role: "Annuaire des lieux du réseau", indexation: "indexee" },
  { chemin: "/association", role: "L'association éditrice", indexation: "indexee" },
  { chemin: "/nos-actions", role: "Actions de l'association", indexation: "indexee" },
  { chemin: "/contact", role: "Formulaire de contact", indexation: "indexee" },
  { chemin: "/recherche", role: "Recherche, tous types de résultats", indexation: "conditionnelle", note: "noindex dès qu'un filtre est posé" },
  { chemin: "/associations", role: "Recherche limitée aux structures", indexation: "conditionnelle", note: "noindex dès qu'un filtre est posé" },
  { chemin: "/activites", role: "Recherche limitée aux rendez-vous", indexation: "conditionnelle", note: "noindex dès qu'un filtre est posé" },
  { chemin: "/espace-particulier/comment-ca-marche", role: "Comment le site fonctionne", indexation: "indexee" },
  { chemin: "/espace-particulier/billets", role: "Retrouver une confirmation", indexation: "indexee" },
  { chemin: "/espace-particulier/compte", role: "Dit qu'aucun compte visiteur n'existe", indexation: "indexee" },
  { chemin: "/projets", role: "Projets de l'association", indexation: "indexee" },
  { chemin: "/aide", role: "Centre d'aide", indexation: "indexee" },
  { chemin: "/connexion", role: "Oriente vers le bon espace", indexation: "indexee" },
  { chemin: "/espace-association", role: "Repères pour les structures", indexation: "indexee" },
  { chemin: "/mentions-legales", role: "Mentions légales", indexation: "indexee" },
  { chemin: "/confidentialite", role: "Confidentialité", indexation: "indexee" },
  { chemin: "/evenement/:id", role: "Fiche d'un rendez-vous", indexation: "noindex", note: "importée ou passée : hors index, décision du 2026-09-22" },
  { chemin: "/:lieuSlug", role: "Vitrine d'un lieu du réseau", indexation: "indexee", note: "404 si le lieu est moissonné" },
];

const PORTAIL = "https://casaminga.com";

export async function getPagesPortail(): Promise<PagePortail[]> {
  let sitemap = "";
  try {
    const reponse = await fetch(`${PORTAIL}/sitemap.xml`, { cache: "no-store" });
    if (reponse.ok) sitemap = await reponse.text();
  } catch {
    sitemap = "";
  }

  return Promise.all(
    PAGES.map(async (page) => {
      const dynamique = page.chemin.includes(":");
      let code: number | null = null;
      if (!dynamique) {
        try {
          const reponse = await fetch(PORTAIL + page.chemin, { cache: "no-store", redirect: "manual" });
          code = reponse.status;
        } catch {
          code = null;
        }
      }
      return {
        ...page,
        dansSitemap: !dynamique && sitemap.includes(`<loc>${PORTAIL}${page.chemin === "/" ? "/" : page.chemin}</loc>`),
        code,
      };
    }),
  );
}
