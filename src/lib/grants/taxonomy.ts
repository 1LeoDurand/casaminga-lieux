/**
 * Taxonomie Aides-Territoires (thématiques) + helpers géographiques.
 *
 * ⚠️ Fondation du tri des ~1 400 aides. Les aides importées stockent dans
 * `grant_opportunities.themes[]` le LIBELLÉ COMPLET de leurs catégories AT
 * (ex. "Nature / environnement / Biodiversité"), copié tel quel depuis
 * `aid.categories`. Le profil du lieu doit donc sélectionner ces MÊMES
 * libellés pour que l'intersection (matching thématique) fonctionne.
 *
 * Le libellé complet = "<thème parent> / <feuille>" : la feuille est le
 * dernier segment après le dernier " / ", le thème parent est le préfixe.
 * On ne dépend d'AUCUN slug : le matching est une intersection de chaînes
 * exactes, robuste et sans référentiel externe à synchroniser.
 */

/** Tous les libellés de catégories AT (source : select public admin.casaminga.com). */
export const GRANT_CATEGORY_LABELS = [
  // Culture et identité collective / patrimoine / sports
  "Culture et identité collective / patrimoine / sports / Arts plastiques et photographie",
  "Culture et identité collective / patrimoine / sports / Bibliothèques et livres",
  "Culture et identité collective / patrimoine / sports / Culture et identité collective",
  "Culture et identité collective / patrimoine / sports / Médias et communication",
  "Culture et identité collective / patrimoine / sports / Musée",
  "Culture et identité collective / patrimoine / sports / Patrimoine et monuments historiques",
  "Culture et identité collective / patrimoine / sports / Spectacle vivant",
  "Culture et identité collective / patrimoine / sports / Sports et loisirs",
  // Développement économique / production et consommation
  "Développement économique / production et consommation / Agriculture et agroalimentaire",
  "Développement économique / production et consommation / Artisanat",
  "Développement économique / production et consommation / Attractivité économique",
  "Développement économique / production et consommation / Commerces et services",
  "Développement économique / production et consommation / Consommation et production",
  "Développement économique / production et consommation / Economie circulaire",
  "Développement économique / production et consommation / Economie locale et circuits courts",
  "Développement économique / production et consommation / Economie sociale et solidaire",
  "Développement économique / production et consommation / Emploi",
  "Développement économique / production et consommation / Fiscalité des entreprises",
  "Développement économique / production et consommation / Formation professionnelle",
  "Développement économique / production et consommation / Industrie",
  "Développement économique / production et consommation / Innovation, créativité et recherche",
  "Développement économique / production et consommation / International",
  "Développement économique / production et consommation / Revitalisation",
  "Développement économique / production et consommation / Technologies numériques et numérisation",
  "Développement économique / production et consommation / Tiers-lieux",
  "Développement économique / production et consommation / Tourisme",
  // Eau et milieux aquatiques
  "Eau et milieux aquatiques / Assainissement des eaux",
  "Eau et milieux aquatiques / Cours d'eau / canaux / plans d'eau",
  "Eau et milieux aquatiques / Eau pluviale",
  "Eau et milieux aquatiques / Eau potable",
  "Eau et milieux aquatiques / Eau souterraine",
  "Eau et milieux aquatiques / Mers et océans",
  // Énergies / Déchets
  "Énergies / Déchets / Economie d'énergie et rénovation énergétique",
  "Énergies / Déchets / Recyclage et valorisation des déchets",
  "Énergies / Déchets / Réduction de l'empreinte carbone",
  "Énergies / Déchets / Réseaux de chaleur",
  "Énergies / Déchets / Transition énergétique",
  // Fonctions support
  "Fonctions support / Animation et mise en réseau",
  "Fonctions support / Appui méthodologique",
  "Fonctions support / Prévention des risques",
  "Fonctions support / Valorisation d'actions",
  // Mobilité / transports
  "Mobilité / transports / Connaissance de la mobilité",
  "Mobilité / transports / Information voyageur, billettique multimodale",
  "Mobilité / transports / Limiter les déplacements subis",
  "Mobilité / transports / Logistique urbaine",
  "Mobilité / transports / Mobilité et véhicules autonomes",
  "Mobilité / transports / Mobilité fluviale",
  "Mobilité / transports / Mobilité partagée",
  "Mobilité / transports / Mobilité pour tous",
  "Mobilité / transports / Modes actifs : vélo, marche et aménagements associés",
  "Mobilité / transports / Transports collectifs et optimisation des trafics routiers",
  // Nature / environnement
  "Nature / environnement / Biodiversité",
  "Nature / environnement / Forêts",
  "Nature / environnement / Milieux humides",
  "Nature / environnement / Montagne",
  "Nature / environnement / Qualité de l'air",
  "Nature / environnement / Risques naturels",
  "Nature / environnement / Sols",
  "Nature / environnement / Solutions d'adaptation fondées sur la nature (SafN)",
  // Solidarités / lien social
  "Solidarités / lien social / Accès aux services",
  "Solidarités / lien social / Alimentation",
  "Solidarités / lien social / Citoyenneté",
  "Solidarités / lien social / Cohésion sociale et inclusion",
  "Solidarités / lien social / Education et renforcement des compétences",
  "Solidarités / lien social / Egalité des chances",
  "Solidarités / lien social / Famille et enfance",
  "Solidarités / lien social / Handicap",
  "Solidarités / lien social / Inclusion numérique",
  "Solidarités / lien social / Jeunesse",
  "Solidarités / lien social / Lutte contre la précarité",
  "Solidarités / lien social / Personnes âgées",
  "Solidarités / lien social / Protection animale",
  "Solidarités / lien social / Santé",
  "Solidarités / lien social / Sécurité",
  // Urbanisme / logement / aménagement
  "Urbanisme / logement / aménagement / Accessibilité",
  "Urbanisme / logement / aménagement / Architecture",
  "Urbanisme / logement / aménagement / Bâtiments et construction",
  "Urbanisme / logement / aménagement / Cimetières et funéraire",
  "Urbanisme / logement / aménagement / Equipement public",
  "Urbanisme / logement / aménagement / Espace public",
  "Urbanisme / logement / aménagement / Espaces verts",
  "Urbanisme / logement / aménagement / Foncier",
  "Urbanisme / logement / aménagement / Friche",
  "Urbanisme / logement / aménagement / Logement et habitat",
  "Urbanisme / logement / aménagement / Paysage",
  "Urbanisme / logement / aménagement / Réhabilitation",
  "Urbanisme / logement / aménagement / Voirie et réseaux",
] as const;

/** Découpe un libellé complet en { thème parent, feuille }. */
export function splitCategory(label: string): { theme: string; leaf: string } {
  const i = label.lastIndexOf(" / ");
  if (i === -1) return { theme: label, leaf: label };
  return { theme: label.slice(0, i), leaf: label.slice(i + 3) };
}

export interface CategoryGroup {
  theme: string;
  items: { label: string; leaf: string }[];
}

/** Les libellés regroupés par thème parent, pour un sélecteur à 2 niveaux. */
export const CATEGORY_GROUPS: CategoryGroup[] = (() => {
  const map = new Map<string, { label: string; leaf: string }[]>();
  for (const label of GRANT_CATEGORY_LABELS) {
    const { theme, leaf } = splitCategory(label);
    if (!map.has(theme)) map.set(theme, []);
    map.get(theme)!.push({ label, leaf });
  }
  return [...map.entries()].map(([theme, items]) => ({ theme, items }));
})();

/** Ensemble des thèmes parents présents dans une liste de libellés complets. */
export function parentThemes(labels: string[]): Set<string> {
  const s = new Set<string>();
  for (const l of labels) s.add(splitCategory(l).theme);
  return s;
}

// ─────────────────────────────────────────────────────────────
// Géographie : dérivation région depuis un code postal / département
// ─────────────────────────────────────────────────────────────

/** Département (2 ou 3 chiffres pour l'outre-mer) → région (libellés FRENCH_REGIONS). */
export const DEPARTMENT_TO_REGION: Record<string, string> = {
  // Auvergne-Rhône-Alpes
  "01": "Auvergne-Rhône-Alpes", "03": "Auvergne-Rhône-Alpes", "07": "Auvergne-Rhône-Alpes",
  "15": "Auvergne-Rhône-Alpes", "26": "Auvergne-Rhône-Alpes", "38": "Auvergne-Rhône-Alpes",
  "42": "Auvergne-Rhône-Alpes", "43": "Auvergne-Rhône-Alpes", "63": "Auvergne-Rhône-Alpes",
  "69": "Auvergne-Rhône-Alpes", "73": "Auvergne-Rhône-Alpes", "74": "Auvergne-Rhône-Alpes",
  // Bourgogne-Franche-Comté
  "21": "Bourgogne-Franche-Comté", "25": "Bourgogne-Franche-Comté", "39": "Bourgogne-Franche-Comté",
  "58": "Bourgogne-Franche-Comté", "70": "Bourgogne-Franche-Comté", "71": "Bourgogne-Franche-Comté",
  "89": "Bourgogne-Franche-Comté", "90": "Bourgogne-Franche-Comté",
  // Bretagne
  "22": "Bretagne", "29": "Bretagne", "35": "Bretagne", "56": "Bretagne",
  // Centre-Val de Loire
  "18": "Centre-Val de Loire", "28": "Centre-Val de Loire", "36": "Centre-Val de Loire",
  "37": "Centre-Val de Loire", "41": "Centre-Val de Loire", "45": "Centre-Val de Loire",
  // Corse
  "2A": "Corse", "2B": "Corse", "20": "Corse",
  // Grand Est
  "08": "Grand Est", "10": "Grand Est", "51": "Grand Est", "52": "Grand Est", "54": "Grand Est",
  "55": "Grand Est", "57": "Grand Est", "67": "Grand Est", "68": "Grand Est", "88": "Grand Est",
  // Hauts-de-France
  "02": "Hauts-de-France", "59": "Hauts-de-France", "60": "Hauts-de-France",
  "62": "Hauts-de-France", "80": "Hauts-de-France",
  // Île-de-France
  "75": "Île-de-France", "77": "Île-de-France", "78": "Île-de-France", "91": "Île-de-France",
  "92": "Île-de-France", "93": "Île-de-France", "94": "Île-de-France", "95": "Île-de-France",
  // Normandie
  "14": "Normandie", "27": "Normandie", "50": "Normandie", "61": "Normandie", "76": "Normandie",
  // Nouvelle-Aquitaine
  "16": "Nouvelle-Aquitaine", "17": "Nouvelle-Aquitaine", "19": "Nouvelle-Aquitaine",
  "23": "Nouvelle-Aquitaine", "24": "Nouvelle-Aquitaine", "33": "Nouvelle-Aquitaine",
  "40": "Nouvelle-Aquitaine", "47": "Nouvelle-Aquitaine", "64": "Nouvelle-Aquitaine",
  "79": "Nouvelle-Aquitaine", "86": "Nouvelle-Aquitaine", "87": "Nouvelle-Aquitaine",
  // Occitanie
  "09": "Occitanie", "11": "Occitanie", "12": "Occitanie", "30": "Occitanie", "31": "Occitanie",
  "32": "Occitanie", "34": "Occitanie", "46": "Occitanie", "48": "Occitanie", "65": "Occitanie",
  "66": "Occitanie", "81": "Occitanie", "82": "Occitanie",
  // Pays de la Loire
  "44": "Pays de la Loire", "49": "Pays de la Loire", "53": "Pays de la Loire",
  "72": "Pays de la Loire", "85": "Pays de la Loire",
  // Provence-Alpes-Côte d'Azur
  "04": "Provence-Alpes-Côte d'Azur", "05": "Provence-Alpes-Côte d'Azur", "06": "Provence-Alpes-Côte d'Azur",
  "13": "Provence-Alpes-Côte d'Azur", "83": "Provence-Alpes-Côte d'Azur", "84": "Provence-Alpes-Côte d'Azur",
  // Outre-mer
  "971": "Outre-mer", "972": "Outre-mer", "973": "Outre-mer", "974": "Outre-mer",
  "975": "Outre-mer", "976": "Outre-mer", "977": "Outre-mer", "978": "Outre-mer",
};

/** Déduit la région à partir d'un code postal français (métropole + DOM). */
export function regionFromPostalCode(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null;
  const pc = postalCode.trim();
  if (pc.length < 2) return null;
  // Outre-mer : les CP commencent par 97x / 98x → département sur 3 chiffres.
  if (pc.startsWith("97") || pc.startsWith("98")) {
    return DEPARTMENT_TO_REGION[pc.slice(0, 3)] ?? "Outre-mer";
  }
  // Corse : 20xxx → 2A/2B non distinguables par le CP, on renvoie "Corse".
  if (pc.startsWith("20")) return "Corse";
  return DEPARTMENT_TO_REGION[pc.slice(0, 2)] ?? null;
}

/** Normalise une chaîne géo (minuscules, sans accents, sans ponctuation superflue). */
export function normalizeGeo(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Marqueurs de périmètre « ouvert à tous » (national / Europe / France entière). */
const NATIONAL_TOKENS = ["france", "national", "nationale", "metropole", "toute la france", "europe", "union europeenne"];

/** Le périmètre d'une aide est-il national/européen (donc compatible partout) ? */
export function isNationalPerimeter(perimeterLabel: string): boolean {
  const n = normalizeGeo(perimeterLabel);
  if (!n) return true; // périmètre vide = pas de restriction connue → ouvert
  return NATIONAL_TOKENS.some((t) => n === t || n.includes(t));
}

/**
 * Le périmètre d'une aide couvre-t-il l'une des régions du lieu ?
 * Best-effort sur le libellé (Layer 1). La précision vient de region_code
 * quand la couche d'enrichissement AT est appliquée (Layer 2).
 */
export function perimeterMatchesRegions(perimeterLabel: string, orgRegions: string[]): boolean {
  if (orgRegions.length === 0) return false;
  const p = normalizeGeo(perimeterLabel);
  if (!p) return false;
  return orgRegions.some((r) => {
    const nr = normalizeGeo(r);
    return nr.length > 0 && (p.includes(nr) || nr.includes(p));
  });
}
