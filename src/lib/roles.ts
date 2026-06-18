/**
 * Définitions canoniques des rôles d'organisation.
 * Source unique de vérité — importer ici plutôt que de dupliquer.
 */

export type { OrgRole } from "@/lib/types";
import type { OrgRole } from "@/lib/types";

// ── Permissions granulaires ───────────────────────────────────────────────────

export interface PermissionSet {
  perm_pilotage: boolean;
  perm_gestion_lieu: boolean;
  perm_structure: boolean;
  perm_publication: boolean;
  perm_systeme: boolean;
}

// ── Liste ordonnée des rôles ──────────────────────────────────────────────────

export const ROLES: OrgRole[] = [
  "admin",
  "coord",
  "comm",
  "finance",
  "benevole",
  "intervenant",
  "readonly",
];

// ── Métadonnées UI (label, couleur badge, description) ───────────────────────

export const ROLE_META: Record<OrgRole, { label: string; color: string; desc: string }> = {
  admin:       { label: "Administrateur·ice", color: "bg-coral/10 text-coral-dark border-coral/20",         desc: "Accès complet à tout le lieu" },
  coord:       { label: "Coordination",        color: "bg-purple-50 text-purple-700 border-purple-200",     desc: "Gère le lieu au quotidien" },
  comm:        { label: "Communication",       color: "bg-blue-50 text-blue-700 border-blue-200",           desc: "Site public, événements, communication" },
  finance:     { label: "Trésorerie",          color: "bg-emerald-50 text-emerald-700 border-emerald-200",  desc: "Finances, adhésions, subventions" },
  benevole:    { label: "Bénévole",            color: "bg-amber-50 text-amber-700 border-amber-200",        desc: "Accès limité aux tâches assignées" },
  intervenant: { label: "Intervenant·e",       color: "bg-slate-100 text-slate-600 border-slate-200",       desc: "Accès ponctuel (résidence, atelier)" },
  readonly:    { label: "Lecture seule",       color: "bg-slate-100 text-slate-500 border-slate-200",       desc: "Consultation uniquement" },
};

// ── Permissions par défaut selon le rôle ─────────────────────────────────────

export const ROLE_PERMS: Record<OrgRole, PermissionSet> = {
  admin:       { perm_pilotage: true,  perm_gestion_lieu: true,  perm_structure: true,  perm_publication: true,  perm_systeme: true  },
  coord:       { perm_pilotage: true,  perm_gestion_lieu: true,  perm_structure: false, perm_publication: true,  perm_systeme: false },
  finance:     { perm_pilotage: true,  perm_gestion_lieu: false, perm_structure: true,  perm_publication: false, perm_systeme: true  },
  comm:        { perm_pilotage: false, perm_gestion_lieu: true,  perm_structure: false, perm_publication: true,  perm_systeme: false },
  benevole:    { perm_pilotage: false, perm_gestion_lieu: true,  perm_structure: false, perm_publication: false, perm_systeme: false },
  intervenant: { perm_pilotage: false, perm_gestion_lieu: true,  perm_structure: false, perm_publication: false, perm_systeme: false },
  readonly:    { perm_pilotage: false, perm_gestion_lieu: false, perm_structure: false, perm_publication: false, perm_systeme: false },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function roleLabel(role: OrgRole): string {
  return ROLE_META[role]?.label ?? role;
}
