"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, RotateCcw, ShieldOff, Send, RefreshCw, X } from "lucide-react";
import {
  updatePermissionsAction,
  sendPasswordResetAction,
} from "@/app/(admin)/dashboard/[org]/personnes/access-actions";
import {
  inviteMemberAction,
  revokeInvitationAction,
  resendInvitationAction,
  type Invitation,
} from "@/app/(admin)/dashboard/[org]/equipe/actions";
import type { TeamMember } from "@/lib/types";
import { ROLES, ROLE_META, ROLE_PERMS, roleLabel } from "@/lib/roles";
import type { OrgRole, PermissionSet } from "@/lib/roles";

// ── Panneau "pas de compte" avec invitation ───────────────────────────────────

function NoAccountPanel({
  personEmail,
  orgSlug,
  orgId,
  canManageAccess,
  pendingInvitation,
}: {
  personEmail: string | null;
  orgSlug: string;
  orgId: string;
  canManageAccess: boolean;
  pendingInvitation: Invitation | null;
}) {
  const [selectedRole, setSelectedRole] = useState<OrgRole>("coord");
  const [, startTransition] = useTransition();

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  function invite() {
    if (!personEmail) return;
    startTransition(async () => {
      const res = await inviteMemberAction(orgSlug, orgId, personEmail, selectedRole);
      if (res.ok) toast.success("Invitation envoyée ✓");
      else toast.error(res.error ?? "Erreur lors de l'envoi");
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeInvitationAction(orgSlug, id);
      if (res.ok) toast.success("Invitation révoquée");
      else toast.error(res.error ?? "Erreur");
    });
  }

  function resend(id: string) {
    startTransition(async () => {
      const res = await resendInvitationAction(orgSlug, orgId, id);
      if (res.ok) toast.success("Invitation relancée ✓");
      else toast.error(res.error ?? "Erreur");
    });
  }

  // Invitation déjà en attente
  if (pendingInvitation) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2.5">
          <ShieldOff className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-800">Invitation en attente</p>
            <p className="text-[11.5px] text-amber-700/80">
              Envoyée le {fmtDate(pendingInvitation.created_at)} · expire le {fmtDate(pendingInvitation.expires_at)}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => resend(pendingInvitation.id)}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-medium text-amber-700 hover:bg-amber-50"
              >
                <RefreshCw className="size-3" /> Relancer
              </button>
              <button
                type="button"
                onClick={() => revoke(pendingInvitation.id)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[12px] font-medium text-red-600 hover:bg-red-50"
              >
                <X className="size-3" /> Révoquer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pas d'email → ne peut pas inviter
  if (!personEmail) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-4">
        <div className="flex items-center gap-2.5">
          <ShieldOff className="size-4 shrink-0 text-warmgray" />
          <div>
            <p className="text-[13px] font-semibold text-warmgray">Pas d&apos;accès au logiciel</p>
            <p className="text-[11.5px] text-warmgray/70">
              Ajoutez d&apos;abord un email à la fiche pour pouvoir inviter cette personne.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Admin → peut inviter
  if (canManageAccess) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <ShieldOff className="size-4 shrink-0 text-warmgray" />
          <p className="text-[13px] font-semibold text-warmgray">Pas d&apos;accès au logiciel</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-ink">Rôle à attribuer</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
            className="w-full rounded-xl border border-border bg-[#FAFAF7] px-3 py-2 text-sm outline-none focus:border-coral"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_META[r].label}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-warmgray/70">{ROLE_META[selectedRole].desc}</p>
        </div>
        <button
          type="button"
          onClick={invite}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-coral py-2 text-[13px] font-bold text-white transition hover:bg-coral-dark"
        >
          <Send className="size-3.5" /> Inviter à créer un compte
        </button>
      </div>
    );
  }

  // Non-admin → lecture seule
  return (
    <div className="rounded-xl border border-dashed border-border bg-white p-4">
      <div className="flex items-center gap-2.5">
        <ShieldOff className="size-4 shrink-0 text-warmgray" />
        <div>
          <p className="text-[13px] font-semibold text-warmgray">Pas d&apos;accès au logiciel</p>
          <p className="text-[11.5px] text-warmgray/70">
            Pour lui donner accès, un administrateur peut l&apos;inviter depuis l&apos;onglet Équipe ou depuis cette fiche.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Définition des 5 permissions ─────────────────────────────────────────────

interface PermDef {
  key: keyof PermissionSet;
  label: string;
  desc: string;
  icon: string;
}

const PERMISSIONS: PermDef[] = [
  {
    key:   "perm_pilotage",
    label: "Pilotage",
    desc:  "KPI, tableau de bord, rapports financiers",
    icon:  "📊",
  },
  {
    key:   "perm_gestion_lieu",
    label: "Gestion du lieu",
    desc:  "Espaces, réservations, planning",
    icon:  "🏛",
  },
  {
    key:   "perm_structure",
    label: "Structure",
    desc:  "Membres, mandats, AG, gouvernance",
    icon:  "🏗",
  },
  {
    key:   "perm_publication",
    label: "Publication",
    desc:  "Site public, événements, annonces, médias",
    icon:  "📢",
  },
  {
    key:   "perm_systeme",
    label: "Système",
    desc:  "Paramètres, facturation, équipe, intégrations",
    icon:  "⚙️",
  },
];


// ── Composant principal ───────────────────────────────────────────────────────

export function PersonAccessPanel({
  member,
  personName,
  personEmail,
  orgSlug,
  orgId,
  canManageAccess = false,
  pendingInvitation = null,
}: {
  member: TeamMember | null;
  personName: string;
  personEmail: string | null;
  orgSlug: string;
  orgId: string;
  canManageAccess?: boolean;
  pendingInvitation?: Invitation | null;
}) {
  // ── Pas de compte ────────────────────────────────────────────
  if (!member) {
    return (
      <NoAccountPanel
        personEmail={personEmail}
        orgSlug={orgSlug}
        orgId={orgId}
        canManageAccess={canManageAccess}
        pendingInvitation={pendingInvitation}
      />
    );
  }

  return (
    <AccessForm
      member={member}
      personName={personName}
      orgSlug={orgSlug}
      orgId={orgId}
    />
  );
}

// ── Formulaire accès (compte existant) ───────────────────────────────────────

function AccessForm({
  member,
  personName,
  orgSlug,
  orgId,
}: {
  member: TeamMember;
  personName: string;
  orgSlug: string;
  orgId: string;
}) {
  const [perms, setPerms] = useState<PermissionSet>({
    perm_pilotage:     member.perm_pilotage,
    perm_gestion_lieu: member.perm_gestion_lieu,
    perm_structure:    member.perm_structure,
    perm_publication:  member.perm_publication,
    perm_systeme:      member.perm_systeme,
  });
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [resetting, setResetting] = useState(false);

  function toggle(key: keyof PermissionSet) {
    setPerms((p) => ({ ...p, [key]: !p[key] }));
    setDirty(true);
  }

  function resetToRole() {
    setPerms(ROLE_PERMS[member.role] ?? ROLE_PERMS.readonly);
    setDirty(true);
  }

  function save() {
    startSave(async () => {
      const res = await updatePermissionsAction(orgSlug, orgId, member.user_id, perms);
      if (res.ok) { toast.success("Permissions enregistrées ✓"); setDirty(false); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  async function sendReset() {
    if (!member.email) return;
    setResetting(true);
    const res = await sendPasswordResetAction(orgSlug, orgId, member.email, personName);
    setResetting(false);
    if (res.ok) toast.success(`Lien envoyé à ${member.email} ✓`);
    else toast.error(res.error ?? "Erreur");
  }

  const roleLabelStr = roleLabel(member.role);

  return (
    <div className="space-y-3.5">
      {/* En-tête accès */}
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
        <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-emerald-800">Accès actif</p>
          <p className="truncate text-[11.5px] text-emerald-700">{member.email} · {roleLabelStr}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          member.status === "actif" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}>
          {member.status === "actif" ? "Actif" : member.status}
        </span>
      </div>

      {/* Permissions */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Permissions</h4>
          <button
            type="button"
            onClick={resetToRole}
            className="flex items-center gap-1 text-[11px] text-coral hover:underline"
            title={`Réinitialiser selon le rôle « ${roleLabelStr} »`}
          >
            <RotateCcw className="size-3" /> Selon le rôle
          </button>
        </div>

        <ul className="space-y-1.5">
          {PERMISSIONS.map((p) => {
            const checked = perms[p.key];
            return (
              <li key={p.key}>
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  checked
                    ? "border-coral/30 bg-peach-pale"
                    : "border-border bg-white hover:border-border"
                }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.key)}
                    className="size-4 cursor-pointer accent-coral"
                  />
                  <span className="text-[13.5px]">{p.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] font-semibold ${checked ? "text-ink" : "text-warmgray"}`}>
                      {p.label}
                    </span>
                    <span className="block truncate text-[11px] text-warmgray/80">{p.desc}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-2.5 w-full rounded-xl bg-coral py-2 text-[13px] font-bold text-white transition hover:bg-coral-dark disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer les permissions"}
          </button>
        )}
      </div>

      {/* Reset mot de passe */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <KeyRound className="size-3.5 text-warmgray" />
          <span className="text-[12px] font-semibold text-ink">Réinitialiser le mot de passe</span>
        </div>
        <p className="mb-3 text-[11.5px] leading-relaxed text-warmgray">
          Envoie un lien sécurisé à{" "}
          <span className="font-medium text-ink">{member.email}</span>. Ce lien
          expire dans 1 heure et ne modifie pas le mot de passe tant qu&apos;il
          n&apos;est pas utilisé.
        </p>
        <button
          type="button"
          onClick={sendReset}
          disabled={resetting || !member.email}
          className="w-full rounded-xl border border-border bg-white py-2 text-[13px] font-semibold text-foreground transition hover:border-coral/40 hover:bg-peach-pale disabled:opacity-40"
        >
          {resetting ? "Envoi en cours…" : `Envoyer le lien de réinitialisation`}
        </button>
      </div>
    </div>
  );
}
