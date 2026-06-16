import type { PeriodType, SectionKey } from "./types";

export const PERIOD_TYPES: { value: PeriodType; label: string }[] = [
  { value: "mensuel", label: "Mensuel" },
  { value: "trimestriel", label: "Trimestriel" },
  { value: "semestriel", label: "Semestriel" },
  { value: "annuel", label: "Annuel" },
  { value: "personnalise", label: "Personnalisé" },
];

export function periodTypeLabel(t: PeriodType): string {
  return PERIOD_TYPES.find((p) => p.value === t)?.label ?? t;
}

export const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: "finances", label: "Synthèse finances", hint: "Recettes, dépenses, solde et détail par catégorie." },
  { key: "events", label: "Événements & Réservations", hint: "Événements et réservations d'espaces sur la période." },
  { key: "residences", label: "Résidences & Adhésions", hint: "Résidences en cours/à venir + nouvelles adhésions." },
  { key: "impact", label: "Impact, Dons & Subventions", hint: "Indicateurs, dons/mécénat et subventions." },
];

export function sectionLabel(k: SectionKey): string {
  return SECTIONS.find((s) => s.key === k)?.label ?? k;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(y: number, m: number, d: number) { return `${y}-${pad(m)}-${pad(d)}`; }
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();

/**
 * Plage de dates suggérée pour une périodicité, ancrée sur une date de
 * référence (par défaut aujourd'hui). Renvoie la période *close* qui contient
 * ou précède l'ancre — un coordinateur génère typiquement le bilan du mois /
 * trimestre / semestre / année en cours.
 */
export function suggestPeriodRange(type: PeriodType, anchor = new Date()): { start: string; end: string } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth() + 1; // 1-12
  switch (type) {
    case "mensuel":
      return { start: iso(y, m, 1), end: iso(y, m, lastDay(y, m)) };
    case "trimestriel": {
      const q = Math.floor((m - 1) / 3); // 0-3
      const sm = q * 3 + 1;
      return { start: iso(y, sm, 1), end: iso(y, sm + 2, lastDay(y, sm + 2)) };
    }
    case "semestriel": {
      const sm = m <= 6 ? 1 : 7;
      return { start: iso(y, sm, 1), end: iso(y, sm + 5, lastDay(y, sm + 5)) };
    }
    case "annuel":
      return { start: iso(y, 1, 1), end: iso(y, 12, 31) };
    case "personnalise":
    default:
      return { start: iso(y, m, 1), end: iso(y, m, lastDay(y, m)) };
  }
}

/** Libellé lisible d'une période, ex. « juin 2026 » ou « 1er trim. 2026 ». */
export function periodLabel(type: PeriodType, start: string, end: string): string {
  const [sy, sm] = start.split("-").map(Number);
  const [ey] = end.split("-").map(Number);
  switch (type) {
    case "mensuel":
      return `${MONTHS[sm - 1]} ${sy}`;
    case "trimestriel": {
      const q = Math.floor((sm - 1) / 3) + 1;
      return `${q}ᵉ trimestre ${sy}`;
    }
    case "semestriel":
      return `${sm <= 6 ? "1er" : "2nd"} semestre ${sy}`;
    case "annuel":
      return `Année ${sy}`;
    default:
      return `${formatDateFr(start)} – ${formatDateFr(end)}`;
  }
}

export function formatDateFr(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-").map(Number);
  if (!y || !m || !day) return d;
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

export function formatEuros(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

/** Titre par défaut suggéré à la création d'une note. */
export function defaultNoteTitle(type: PeriodType, start: string, end: string): string {
  return `Note de coordination — ${periodLabel(type, start, end)}`;
}
