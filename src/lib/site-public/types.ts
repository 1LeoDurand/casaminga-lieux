/** Structure du contenu éditable du site vitrine (stocké dans public_sites.content_blocks). */
export interface SiteContent {
  hero_tagline: string;        // accroche sous le nom du lieu
  hero_image_url: string | null;
  about_title: string;
  about_text: string;          // texte "À propos" (multi-paragraphes)
  gallery_urls: string[];      // photos de la galerie "Découvrir le lieu"
  accent_color: string;        // couleur d'accent du site (#hex)
  sections: {
    lieu: boolean;
    agenda: boolean;
    adherer: boolean;
    contact: boolean;
  };
}

export interface SitePublicConfig {
  organization_id: string;
  slug: string;
  title: string;
  status: "brouillon" | "publie";
  seo_description: string | null;
  content: SiteContent;
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero_tagline: "",
  hero_image_url: null,
  about_title: "Découvrir le lieu",
  about_text: "",
  gallery_urls: [],
  accent_color: "#FF8A65",
  sections: { lieu: true, agenda: true, adherer: true, contact: true },
};

/** Fusionne le contenu stocké (potentiellement partiel) avec les valeurs par défaut. */
export function mergeSiteContent(raw: unknown): SiteContent {
  const c = (raw ?? {}) as Partial<SiteContent>;
  return {
    hero_tagline: c.hero_tagline ?? DEFAULT_SITE_CONTENT.hero_tagline,
    hero_image_url: c.hero_image_url ?? null,
    about_title: c.about_title ?? DEFAULT_SITE_CONTENT.about_title,
    about_text: c.about_text ?? DEFAULT_SITE_CONTENT.about_text,
    gallery_urls: Array.isArray(c.gallery_urls) ? c.gallery_urls : [],
    accent_color: c.accent_color ?? DEFAULT_SITE_CONTENT.accent_color,
    sections: {
      lieu: c.sections?.lieu ?? true,
      agenda: c.sections?.agenda ?? true,
      adherer: c.sections?.adherer ?? true,
      contact: c.sections?.contact ?? true,
    },
  };
}
