/**
 * Système newsletter Casa Minga — types partagés.
 * Une campagne est une liste ordonnée de blocs.
 * Les blocs dynamiques (événements, adhésion, espaces) se résolvent au moment de l'envoi.
 */

// ─── Blocs ─────────────────────────────────────────────────────────────────────

export interface BlockTexte {
  id: string;
  type: "texte";
  content: string; // texte brut, \n\n = paragraphe
}

export interface BlockTitre {
  id: string;
  type: "titre";
  text: string;
  level: 1 | 2;
}

export interface BlockEvenements {
  id: string;
  type: "evenements";
  title: string;    // ex. "Nos prochains événements"
  count: number;    // nb max à afficher (1–6)
}

export interface BlockAdhesion {
  id: string;
  type: "adhesion";
  title: string;    // ex. "Rejoignez le lieu"
  show_all: boolean;
  campaign_id: string | null; // null = toutes les campagnes actives
}

export interface BlockEspaces {
  id: string;
  type: "espaces";
  title: string;
  count: number;
}

export interface BlockImage {
  id: string;
  type: "image";
  url: string;
  alt: string;
  link?: string;
}

export interface BlockBouton {
  id: string;
  type: "bouton";
  text: string;
  url: string;
}

export interface BlockSeparateur {
  id: string;
  type: "separateur";
}

export type NewsletterBlock =
  | BlockTexte
  | BlockTitre
  | BlockEvenements
  | BlockAdhesion
  | BlockEspaces
  | BlockImage
  | BlockBouton
  | BlockSeparateur;

export type NewsletterBlockType = NewsletterBlock["type"];

// ─── Campagne ──────────────────────────────────────────────────────────────────

export type CampaignStatus = "brouillon" | "programmee" | "envoyee";

export interface NewsletterCampaign {
  id: string;
  organization_id: string;
  sujet: string;
  statut: CampaignStatus;
  blocs: NewsletterBlock[];
  html_archive: string | null;
  programmee_pour: string | null;
  envoyee_le: string | null;
  nb_envoyes: number | null;
  nb_echecs: number | null;
  segment_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Paramètres de cadence ─────────────────────────────────────────────────────

export type NewsletterMode = "manuel" | "recurrent" | "sur_evenement";

export interface NewsletterSettings {
  id: string;
  organization_id: string;
  actif: boolean;
  mode: NewsletterMode;
  frequence_semaines: number;
  jour_envoi: string;
  heure_envoi: string;
  segment_id: string | null;
  blocs_template: NewsletterBlock[];
  prochain_envoi_le: string | null;
  dernier_envoi_le: string | null;
  nb_evenements_declencheur: number;
  garde_fou_jours: number;
  created_at: string;
  updated_at: string;
}

// ─── Labels UI ─────────────────────────────────────────────────────────────────

export const BLOCK_META: Record<NewsletterBlockType, { label: string; emoji: string; description: string }> = {
  texte:       { label: "Texte libre",      emoji: "✍️",  description: "Paragraphe(s) de texte" },
  titre:       { label: "Titre",            emoji: "🔤",  description: "Titre de section" },
  evenements:  { label: "Événements",       emoji: "📅",  description: "Prochains événements (automatique)" },
  adhesion:    { label: "Adhésion",         emoji: "🤝",  description: "Campagnes d'adhésion actives" },
  espaces:     { label: "Espaces / services", emoji: "🏠", description: "Vos espaces réservables" },
  image:       { label: "Image",            emoji: "🖼️",  description: "Photo ou illustration" },
  bouton:      { label: "Bouton",           emoji: "🔘",  description: "Appel à l'action cliquable" },
  separateur:  { label: "Séparateur",       emoji: "➖",  description: "Ligne de séparation" },
};

export const JOURS_SEMAINE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
