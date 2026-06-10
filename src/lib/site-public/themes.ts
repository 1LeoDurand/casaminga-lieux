/**
 * Thèmes visuels du site public — 4 ambiances prédéfinies.
 * Un thème = un jeu de classes Tailwind consommé par le shell et les pages.
 * Le contenu reste identique ; seul le rendu change (zéro risque de site cassé).
 */
import type { SiteTheme } from "./types";

export interface ThemeDef {
  key: SiteTheme;
  label: string;
  description: string;
  /** Couleurs d'aperçu pour l'éditeur (fond, texte, accent par défaut). */
  preview: { bg: string; text: string; accent: string };
  dark: boolean;
  /** Variante de hero : split = texte+photo, full = photo plein écran, center = centré magazine. */
  hero: "split" | "full" | "center";
  classes: {
    page: string;        // <main>
    nav: string;         // header sticky
    navLink: string;
    heading: string;     // famille de titres (h1/h2)
    h1: string;
    h2: string;
    body: string;        // paragraphes
    muted: string;
    card: string;        // cartes (événements, campagnes, espaces)
    btn: string;         // bouton plein (couleur accent appliquée en style inline)
    image: string;       // arrondi des images
    footer: string;
  };
}

export const THEMES: Record<SiteTheme, ThemeDef> = {
  chaleureux: {
    key: "chaleureux",
    label: "Chaleureux",
    description: "Crème et coins doux — l'ambiance Casa Minga d'origine.",
    preview: { bg: "#FFFBF0", text: "#2C2C2C", accent: "#FF8A65" },
    dark: false,
    hero: "split",
    classes: {
      page: "bg-cream text-foreground",
      nav: "border-b border-border/60 bg-cream/80 backdrop-blur-md",
      navLink: "text-muted-foreground hover:opacity-70",
      heading: "font-heading",
      h1: "font-heading text-3xl font-extrabold leading-tight tracking-tight md:text-4xl",
      h2: "font-heading text-xl font-bold md:text-2xl",
      body: "text-[15px] leading-relaxed text-muted-foreground",
      muted: "text-muted-foreground",
      card: "rounded-2xl border border-border/60 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
      btn: "rounded-lg text-white",
      image: "rounded-2xl",
      footer: "border-t border-border/60 text-muted-foreground",
    },
  },
  galerie: {
    key: "galerie",
    label: "Galerie",
    description: "Fond sombre, photos en grand — pour les lieux très visuels.",
    preview: { bg: "#141414", text: "#F5F5F2", accent: "#E8B04B" },
    dark: true,
    hero: "full",
    classes: {
      page: "bg-[#141414] text-[#F5F5F2] [font-family:var(--font-dmsans),sans-serif]",
      nav: "border-b border-white/10 bg-[#141414]/80 backdrop-blur-md",
      navLink: "text-white/60 hover:text-white",
      heading: "[font-family:var(--font-dmsans),sans-serif]",
      h1: "text-4xl font-bold leading-tight tracking-tight md:text-5xl",
      h2: "text-xl font-bold tracking-tight md:text-2xl",
      body: "text-[15px] leading-relaxed text-white/70",
      muted: "text-white/50",
      card: "rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm",
      btn: "rounded-full text-[#141414] font-bold",
      image: "rounded-xl",
      footer: "border-t border-white/10 text-white/40",
    },
  },
  editorial: {
    key: "editorial",
    label: "Éditorial",
    description: "Serif élégante, esprit revue — pour les lieux culturels.",
    preview: { bg: "#FAF7F2", text: "#1F1D1A", accent: "#8A4B2D" },
    dark: false,
    hero: "center",
    classes: {
      page: "bg-[#FAF7F2] text-[#1F1D1A]",
      nav: "border-b border-[#1F1D1A]/15 bg-[#FAF7F2]/85 backdrop-blur-md",
      navLink: "text-[#1F1D1A]/60 hover:text-[#1F1D1A] tracking-wide uppercase text-[12px]",
      heading: "[font-family:var(--font-fraunces),serif]",
      h1: "[font-family:var(--font-fraunces),serif] text-4xl font-semibold leading-[1.1] md:text-5xl",
      h2: "[font-family:var(--font-fraunces),serif] text-2xl font-semibold md:text-3xl",
      body: "text-[16px] leading-[1.75] text-[#1F1D1A]/75",
      muted: "text-[#1F1D1A]/50",
      card: "rounded-none border border-[#1F1D1A]/15 bg-white",
      btn: "rounded-none text-white tracking-wide",
      image: "rounded-none",
      footer: "border-t border-[#1F1D1A]/15 text-[#1F1D1A]/50",
    },
  },
  brut: {
    key: "brut",
    label: "Brut",
    description: "Typo forte, contrastes francs — esprit friche / atelier.",
    preview: { bg: "#ECEAE6", text: "#111111", accent: "#D9480F" },
    dark: false,
    hero: "split",
    classes: {
      page: "bg-[#ECEAE6] text-[#111111]",
      nav: "border-b-2 border-[#111111] bg-[#ECEAE6]",
      navLink: "text-[#111111]/70 hover:text-[#111111] font-semibold uppercase text-[12px] tracking-wider",
      heading: "[font-family:var(--font-syne),sans-serif] uppercase",
      h1: "[font-family:var(--font-syne),sans-serif] text-3xl font-extrabold uppercase leading-[1.05] tracking-tight md:text-5xl",
      h2: "[font-family:var(--font-syne),sans-serif] text-xl font-extrabold uppercase md:text-2xl",
      body: "text-[15px] leading-relaxed text-[#111111]/75",
      muted: "text-[#111111]/55",
      card: "rounded-none border-2 border-[#111111] bg-white shadow-[4px_4px_0_#111111]",
      btn: "rounded-none font-extrabold uppercase tracking-wider text-white border-2 border-[#111111]",
      image: "rounded-none border-2 border-[#111111]",
      footer: "border-t-2 border-[#111111] text-[#111111]/60",
    },
  },
};

export function getTheme(key: SiteTheme): ThemeDef {
  return THEMES[key] ?? THEMES.chaleureux;
}
