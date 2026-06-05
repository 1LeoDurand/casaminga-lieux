"use client";

import { useState, useTransition } from "react";
import { Users, Shield, Trash2, Mail, Info, UserX, UserCheck, RefreshCw, X, Send, Clock } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  updateMemberRoleAction, removeMemberAction,
  setMemberStatusAction, inviteMemberAction,
  revokeInvitationAction, resendInvitationAction,
  type Invitation,
} from "@/app/(admin)/dashboard/[org]/equipe/actions";
import type { TeamMember, OrgRole } from "@/lib/types";

const ROLE_META: Record<OrgRole, { label: string; color: string; desc: string }> = {
  admin:       { label: "Administrateur", color: "bg-coral/10 text-coral-dark border-coral/20", desc: "Accès complet à tout le lieu" },
  coord:       { label: "Coordination",   color: "bg-purple-50 text-purple-700 border-purple-200", desc: "Gère le lieu au quotidien" },
  comm:        { label: "Communication",  color: "bg-blue-50 text-blue-700 border-blue-200", desc: "Site public, événements, communication" },
  finance:     { label: "Trésorerie",     color: "bg-emerald-50 text-emerald-700 border-emerald-200", desc: "Finances, adhésions, subventions" },
  benevole:    { label: "Bénévole",       color: "bg-amber-50 text-amber-700 border-amber-200", desc: "Accès limité aux tâches assignées" },
  intervenant: { label: "Intervenant",    color: "bg-slate-100 text-slate-600 border-slate-200", desc: "Accès ponctuel (résidence, atelier)" },
  readonly:    { label: "Lecture seule",  color: "bg-slate-100 text-slate-500 border-slate-200", desc: "Consultation uniquement" },
};

const ROLES: OrgRole[] = ["admin", "coord", "comm", "finance", "benevole", "intervenant", "readonly"];

function initials(name: string | null, email: string | null): string {
  const src = name || email || "?";
  return src.split(/[\s@.]+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ── Modale d'invitation ───────────────────────────────────────────
function InviteModal({ orgId, orgSlug, onClose }: { orgId: string; orgSlug: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("membre" as OrgRole);
  const [, startTransition] = useTransition();

  // Utilise "coord" comme défaut raisonnable
  const [selectedRole, setSelectedRole] = useState<OrgRole>("coord");

  function send() {
    if (!email.trim() || !email.includes("@")) { toast.error("Email invalide."); return; }
    startTransition(async () => {
      const res = await inviteMemberAction(orgSlug, orgId, email.trim(), selectedRole);
      if (res.ok) {
        toast.success("Invitation envoyée ✓");
        onClose();
      } else {
        toast.error(res.error ?? "Erreur lors de l'envoi");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-ink">Inviter un membre</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-cream"><X className="size-4" /></button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink">Email *</label>
            <input
              autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm outline-none focus:border-coral"
              placeholder="prenom@exemple.fr"
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink">Rôle</label>
            <select
              value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
              className="w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm outline-none focus:border-coral"
            >
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
            </select>
          </div>
          <p className="text-[12px] text-warmgray">
            Un email d'invitation sera envoyé avec un lien valable 7 jours.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="mc-btn mc-btn-outline mc-btn-sm">Annuler</button>
          <button onClick={send} className="mc-btn mc-btn-lime mc-btn-sm">
            <Send className="size-3.5" /> Envoyer l'invitation
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue principale ────────────────────────────────────────────────
export function TeamView({ members, invitations, orgSlug, orgId }: {
  members: TeamMember[];
  invitations: Invitation[];
  orgSlug: string;
  orgId: string;
}) {
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, start] = useTransition();

  const admins = members.filter((m) => m.role === "admin").length;

  function changeRole(member: TeamMember, role: OrgRole) {
    start(async () => {
      const res = await updateMemberRoleAction(orgSlug, orgId, member.user_id, role, member.zones);
      if (res.ok) toast.success(`Rôle mis à jour : ${ROLE_META[role].label}`);
      else toast.error("Erreur lors de la mise à jour");
    });
  }

  function toggleStatus(member: TeamMember) {
    const newStatus = member.status === "actif" ? "suspendu" : "actif";
    const isLastAdmin = member.role === "admin" && admins <= 1 && newStatus === "suspendu";
    if (isLastAdmin) { toast.error("Impossible de suspendre le dernier administrateur."); return; }
    start(async () => {
      const res = await setMemberStatusAction(orgSlug, orgId, member.user_id, newStatus);
      if (res.ok) toast.success(newStatus === "actif" ? "Accès réactivé ✓" : "Accès suspendu");
      else toast.error(res.error ?? "Erreur");
    });
  }

  function handleRemove() {
    if (!confirmRemove) return;
    const isLastAdmin = confirmRemove.role === "admin" && admins <= 1;
    if (isLastAdmin) { toast.error("Impossible de retirer le dernier administrateur."); setConfirmRemove(null); return; }
    start(async () => {
      const res = await removeMemberAction(orgSlug, orgId, confirmRemove.user_id);
      if (res.ok) toast.success("Membre retiré de l'équipe");
      else toast.error("Erreur");
      setConfirmRemove(null);
    });
  }

  function revokeInvite(id: string) {
    start(async () => {
      const res = await revokeInvitationAction(orgSlug, id);
      if (res.ok) toast.success("Invitation révoquée");
      else toast.error(res.error ?? "Erreur");
    });
  }

  function resendInvite(id: string) {
    start(async () => {
      const res = await resendInvitationAction(orgSlug, orgId, id);
      if (res.ok) toast.success("Invitation relancée ✓");
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Membres de l'équipe", value: members.length, icon: <Users className="size-4" /> },
          { label: "Administrateurs",      value: admins,         icon: <Shield className="size-4 text-coral-dark" /> },
          { label: "En attente",           value: invitations.length, icon: <Clock className="size-4 text-amber-600" /> },
        ].map((k) => (
          <div key={k.label} className="mc-card p-4">
            <div className="mb-1 text-warmgray">{k.icon}</div>
            <div className="text-xl font-bold text-foreground">{k.value}</div>
            <div className="text-xs text-warmgray">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Bouton inviter */}
      <div className="flex justify-end">
        <button onClick={() => setInviteOpen(true)} className="mc-btn mc-btn-lime mc-btn-sm">
          <Mail className="size-3.5" /> + Inviter un membre
        </button>
      </div>

      {/* Invitations en attente */}
      {invitations.length > 0 && (
        <div className="mc-card overflow-hidden">
          <div className="border-b border-border bg-amber-50 px-5 py-3">
            <h3 className="font-heading text-sm font-bold text-amber-800">
              ⏳ Invitations en attente ({invitations.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink">{inv.email}</div>
                  <div className="text-[11px] text-warmgray">
                    {ROLE_META[inv.role as OrgRole]?.label ?? inv.role} · expire le {fmtDate(inv.expires_at)}
                  </div>
                </div>
                <button onClick={() => resendInvite(inv.id)} disabled={pending}
                  className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40" title="Relancer">
                  <RefreshCw className="size-3.5" />
                </button>
                <button onClick={() => revokeInvite(inv.id)} disabled={pending}
                  className="rounded-lg border border-border p-1.5 text-warmgray hover:border-red-300 hover:text-red-600" title="Révoquer">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste membres */}
      <div className="mc-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-heading text-sm font-bold text-foreground">Membres ({members.length})</h3>
        </div>
        <div className="divide-y divide-border">
          {members.map((m) => {
            const isSuspended = m.status === "suspendu";
            return (
              <div key={m.user_id} className={`flex items-center gap-4 px-5 py-3.5 ${isSuspended ? "opacity-60" : ""}`}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-coral/10 text-sm font-bold text-coral-dark">
                  {initials(m.full_name, m.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{m.full_name ?? "Sans nom"}</span>
                    {isSuspended && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Suspendu</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-warmgray">{m.email ?? "—"}</div>
                </div>

                {/* Rôle */}
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m, e.target.value as OrgRole)}
                  disabled={pending}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-coral"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                </select>

                {/* Suspendre / réactiver */}
                <button
                  onClick={() => toggleStatus(m)} disabled={pending}
                  className="rounded-lg border border-border p-1.5 text-warmgray hover:border-amber-300 hover:text-amber-600 disabled:opacity-30"
                  title={isSuspended ? "Réactiver l'accès" : "Suspendre l'accès"}
                >
                  {isSuspended ? <UserCheck className="size-4" /> : <UserX className="size-4" />}
                </button>

                {/* Retirer */}
                <button
                  onClick={() => setConfirmRemove(m)} disabled={pending}
                  className="rounded-lg p-2 text-warmgray/50 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  title="Retirer de l'équipe"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende rôles */}
      <div className="mc-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Info className="size-4 text-warmgray" />
          <h3 className="font-heading text-sm font-bold text-foreground">Les rôles</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="flex items-center gap-2.5">
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_META[r].color}`}>
                {ROLE_META[r].label}
              </span>
              <span className="text-xs text-warmgray">{ROLE_META[r].desc}</span>
            </div>
          ))}
        </div>
      </div>

      {inviteOpen && <InviteModal orgId={orgId} orgSlug={orgSlug} onClose={() => setInviteOpen(false)} />}

      <ConfirmDialog
        open={!!confirmRemove}
        title="Retirer ce membre"
        message={`Retirer ${confirmRemove?.full_name ?? confirmRemove?.email} de l'équipe ? La personne perdra l'accès au lieu.`}
        tone="danger"
        busy={pending}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
