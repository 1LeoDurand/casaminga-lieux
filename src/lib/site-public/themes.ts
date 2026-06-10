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
  botanique: {
    key: "botanique",
    label: "Botanique",
    description: "Vert tendre, coins très doux — jardins, lieux nature.",
    preview: { bg: "#F2F5EE", text: "#1F2A1C", accent: "#5B8C51" },
    dark: false,
    hero: "split",
    classes: {
      page: "bg-[#F2F5EE] text-[#1F2A1C]",
      nav: "border-b border-[#1F2A1C]/10 bg-[#F2F5EE]/85 backdrop-blur-md",
      navLink: "text-[#1F2A1C]/60 hover:text-[#1F2A1C]",
      heading: "font-heading",
      h1: "font-heading text-3xl font-extrabold leading-tight tracking-tight md:text-4xl",
      h2: "font-heading text-xl font-bold md:text-2xl",
      body: "text-[15px] leading-relaxed text-[#1F2A1C]/70",
      muted: "text-[#1F2A1C]/55",
      card: "rounded-3xl border border-[#1F2A1C]/10 bg-white shadow-[0_4px_24px_rgba(31,42,28,0.06)]",
      btn: "rounded-full text-white",
      image: "rounded-3xl",
      footer: "border-t border-[#1F2A1C]/10 text-[#1F2A1C]/55",
    },
  },
  nuit: {
    key: "nuit",
    label: "Nuit",
    description: "Bleu nuit, serif dorée — soirées, lieux culturels chics.",
    preview: { bg: "#14182B", text: "#ECEAF4", accent: "#C9A24B" },
    dark: true,
    hero: "center",
    classes: {
      page: "bg-[#14182B] text-[#ECEAF4]",
      nav: "border-b border-white/10 bg-[#14182B]/80 backdrop-blur-md",
      navLink: "text-white/55 hover:text-white tracking-wide",
      heading: "[font-family:var(--font-fraunces),serif]",
      h1: "[font-family:var(--font-fraunces),serif] text-4xl font-semibold leading-[1.1] md:text-5xl",
      h2: "[font-family:var(--font-fraunces),serif] text-2xl font-semibold md:text-3xl",
      body: "text-[16px] leading-[1.7] text-white/70",
      muted: "text-white/50",
      card: "rounded-2xl border border-white/10 bg-white/[0.04]",
      btn: "rounded-full text-[#14182B] font-bold",
      image: "rounded-2xl",
      footer: "border-t border-white/10 text-white/40",
    },
  },
  pastel: {
    key: "pastel",
    label: "Pastel",
    description: "Tons doux et ronds — MJC, lieux famille et jeunesse.",
    preview: { bg: "#FBF3FB", text: "#3A2E45", accent: "#C06FB0" },
    dark: false,
    hero: "split",
    classes: {
      page: "bg-[#FBF3FB] text-[#3A2E45]",
      nav: "border-b border-[#3A2E45]/10 bg-[#FBF3FB]/85 backdrop-blur-md",
      navLink: "text-[#3A2E45]/60 hover:text-[#3A2E45]",
      heading: "font-heading",
      h1: "font-heading text-3xl font-extrabold leading-tight tracking-tight md:text-4xl",
      h2: "font-heading text-xl font-bold md:text-2xl",
      body: "text-[15px] leading-relaxed text-[#3A2E45]/70",
      muted: "text-[#3A2E45]/55",
      card: "rounded-[28px] border border-[#3A2E45]/10 bg-white shadow-[0_6px_28px_rgba(58,46,69,0.07)]",
      btn: "rounded-full text-white",
      image: "rounded-[28px]",
      footer: "border-t border-[#3A2E45]/10 text-[#3A2E45]/55",
    },
  },
  minimal: {
    key: "minimal",
    label: "Minimal",
    description: "Blanc, lignes fines, grotesque — sobre et contemporain.",
    preview: { bg: "#FFFFFF", text: "#111111", accent: "#111111" },
    dark: false,
    hero: "split",
    classes: {
      page: "bg-white text-[#111111] [font-family:var(--font-space-grotesk),sans-serif]",
      nav: "border-b border-[#111111]/10 bg-white/85 backdrop-blur-md",
      navLink: "text-[#111111]/55 hover:text-[#111111] text-[13px]",
      heading: "[font-family:var(--font-space-grotesk),sans-serif]",
      h1: "[font-family:var(--font-space-grotesk),sans-serif] text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl",
      h2: "[font-family:var(--font-space-grotesk),sans-serif] text-xl font-bold tracking-tight md:text-2xl",
      body: "text-[15px] leading-relaxed text-[#111111]/65",
      muted: "text-[#111111]/45",
      card: "rounded-none border border-[#111111]/12 bg-white",
      btn: "rounded-none text-white",
      image: "rounded-none",
      footer: "border-t border-[#111111]/12 text-[#111111]/45",
    },
  },
  terre: {
    key: "terre",
    label: "Terre",
    description: "Terracotta et serif — céramique, artisanat, résidences.",
    preview: { bg: "#F3E7DC", text: "#3B2A20", accent: "#B5532A" },
    dark: false,
    hero: "split",
    classes: {
      page: "bg-[#F3E7DC] text-[#3B2A20]",
      nav: "border-b border-[#3B2A20]/12 bg-[#F3E7DC]/85 backdrop-blur-md",
      navLink: "text-[#3B2A20]/60 hover:text-[#3B2A20]",
      heading: "[font-family:var(--font-fraunces),serif]",
      h1: "[font-family:var(--font-fraunces),serif] text-4xl font-semibold leading-[1.1] md:text-5xl",
      h2: "[font-family:var(--font-fraunces),serif] text-2xl font-semibold md:text-3xl",
      body: "text-[15.5px] leading-[1.7] text-[#3B2A20]/72",
      muted: "text-[#3B2A20]/55",
      card: "rounded-xl border border-[#3B2A20]/12 bg-[#FAF3EB]",
      btn: "rounded-lg text-white",
      image: "rounded-xl",
      footer: "border-t border-[#3B2A20]/12 text-[#3B2A20]/55",
    },
  },
  ocean: {
    key: "ocean",
    label: "Océan",
    description: "Bleu-vert frais et aéré — lieux au bord de l'eau, calme.",
    preview: { bg: "#EEF6F7", text: "#143036", accent: "#2E8B8B" },
    dark: false,
    hero: "split",
    classes: {
      page: "bg-[#EEF6F7] text-[#143036]",
      nav: "border-b border-[#143036]/10 bg-[#EEF6F7]/85 backdrop-blur-md",
      navLink: "text-[#143036]/60 hover:text-[#143036]",
      heading: "font-heading",
      h1: "font-heading text-3xl font-extrabold leading-tight tracking-tight md:text-4xl",
      h2: "font-heading text-xl font-bold md:text-2xl",
      body: "text-[15px] leading-relaxed text-[#143036]/70",
      muted: "text-[#143036]/55",
      card: "rounded-2xl border border-[#143036]/10 bg-white shadow-[0_4px_20px_rgba(20,48,54,0.06)]",
      btn: "rounded-full text-white",
      image: "rounded-2xl",
      footer: "border-t border-[#143036]/10 text-[#143036]/55",
    },
  },
  affiche: {
    key: "affiche",
    label: "Affiche",
    description: "Très grands titres, esprit affiche de festival.",
    preview: { bg: "#FFFCF5", text: "#1A1A1A", accent: "#FF5C39" },
    dark: false,
    hero: "center",
    classes: {
      page: "bg-[#FFFCF5] text-[#1A1A1A] [font-family:var(--font-syne),sans-serif]",
      nav: "border-b-2 border-[#1A1A1A] bg-[#FFFCF5]",
      navLink: "text-[#1A1A1A]/70 hover:text-[#1A1A1A] font-bold uppercase text-[12px] tracking-wide",
      heading: "[font-family:var(--font-syne),sans-serif]",
      h1: "[font-family:var(--font-syne),sans-serif] text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl",
      h2: "[font-family:var(--font-syne),sans-serif] text-2xl font-extrabold md:text-4xl",
      body: "text-[15px] leading-relaxed text-[#1A1A1A]/75",
      muted: "text-[#1A1A1A]/55",
      card: "rounded-2xl border-2 border-[#1A1A1A] bg-white",
      btn: "rounded-full font-extrabold uppercase tracking-wide text-white",
      image: "rounded-2xl",
      footer: "border-t-2 border-[#1A1A1A] text-[#1A1A1A]/60",
    },
  },
};

export function getTheme(key: SiteTheme): ThemeDef {
  return THEMES[key] ?? THEMES.chaleureux;
}
