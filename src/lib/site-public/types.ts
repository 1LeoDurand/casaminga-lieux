/** Structure du contenu éditable du site vitrine (stocké dans public_sites.content_blocks). */

export type SiteTheme = "chaleureux" | "galerie" | "editorial" | "brut";

export interface SiteContent {
  hero_tagline: string;        // accroche sous le nom du lieu
  hero_image_url: string | null;
  about_title: string;
  about_text: string;          // texte "À propos" (multi-paragraphes)
  gallery_urls: string[];      // photos de la galerie "Découvrir le lieu"
  accent_color: string;        // couleur d'accent du site (#hex)
  theme: SiteTheme;            // thème visuel du site
  sections: {                  // sections de la page d'accueil
    lieu: boolean;
    agenda: boolean;
    adherer: boolean;
    contact: boolean;
  };
  pages: {                     // pages dédiées (navigation générée)
    apropos: boolean;
    agenda: boolean;
    espaces: boolean;
    soutenir: boolean;
  };
  /** Texte d'appel aux dons de la page Soutenir (facultatif). */
  soutenir_text: string;
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
  theme: "chaleureux",
  sections: { lieu: true, agenda: true, adherer: true, contact: true },
  pages: { apropos: false, agenda: false, espaces: false, soutenir: false },
  soutenir_text: "",
};

const THEME_KEYS: SiteTheme[] = ["chaleureux", "galerie", "editorial", "brut"];

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
    theme: THEME_KEYS.includes(c.theme as SiteTheme) ? (c.theme as SiteTheme) : "chaleureux",
    sections: {
      lieu: c.sections?.lieu ?? true,
      agenda: c.sections?.agenda ?? true,
      adherer: c.sections?.adherer ?? true,
      contact: c.sections?.contact ?? true,
    },
    pages: {
      apropos: c.pages?.apropos ?? false,
      agenda: c.pages?.agenda ?? false,
      espaces: c.pages?.espaces ?? false,
      soutenir: c.pages?.soutenir ?? false,
    },
    soutenir_text: c.soutenir_text ?? "",
  };
}
