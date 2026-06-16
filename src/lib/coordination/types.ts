// ── Note de coordination (module Impact) ──────────────────────────────────
// Une note de coordination est un document périodique (mensuel → annuel) que le
// coordinateur compose à partir de blocs (finances, événements, résidences,
// impact). Les données sont figées (snapshot) à la génération, le texte reste
// éditable, et la note s'exporte en Word (.docx).

export type PeriodType =
  | "mensuel"
  | "trimestriel"
  | "semestriel"
  | "annuel"
  | "personnalise";

export type NoteStatus = "brouillon" | "finalisee";

/** Clés des blocs activables dans une note. */
export type SectionKey = "finances" | "events" | "residences" | "impact";

/** Config d'un bloc : activé ou non + commentaire libre du coordinateur. */
export interface SectionConfig {
  enabled: boolean;
  commentary: string;
}

export type NoteSections = Record<SectionKey, SectionConfig>;

// ── Snapshots de données (figés à la génération) ──────────────────────────

export interface FinanceSnapshot {
  recettes: number;
  depenses: number;
  solde: number;
  count: number;
  byCategory: { category: string; recettes: number; depenses: number }[];
}

export interface EventsSnapshot {
  events: { title: string; date: string; status: string; type: string }[];
  reservations: { title: string; date: string; status: string; price: number | null }[];
}

export interface ResidencesSnapshot {
  residences: {
    title: string;
    discipline: string;
    status: string;
    start: string | null;
    end: string | null;
  }[];
  adhesions: {
    count: number;
    total: number;
    newMembers: { name: string; date: string }[];
  };
}

export interface ImpactSnapshot {
  indicators: { label: string; value: number; unit: string | null; period: string | null; category: string }[];
  donations: {
    count: number;
    total: number;
    list: { donor: string; amount: number; type: string; date: string }[];
  };
  grants: { title: string; funder: string; amount: number; received: number; status: string }[];
}

export interface NoteSnapshot {
  finances?: FinanceSnapshot;
  events?: EventsSnapshot;
  residences?: ResidencesSnapshot;
  impact?: ImpactSnapshot;
}

// ── Ligne de la table ─────────────────────────────────────────────────────

export interface CoordinationNote {
  id: string;
  organization_id: string;
  title: string;
  period_type: PeriodType;
  period_start: string; // date ISO (yyyy-mm-dd)
  period_end: string;
  intro: string | null;
  conclusion: string | null;
  sections: NoteSections;
  snapshot: NoteSnapshot;
  status: NoteStatus;
  created_at: string;
  updated_at: string | null;
}
