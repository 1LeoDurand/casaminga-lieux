"use client";

import { useState, useTransition } from "react";
import { Users, Shield, Trash2, Mail, Copy, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { updateMemberRoleAction, removeMemberAction } from "@/app/(admin)/dashboard/[org]/equipe/actions";
import type { TeamMember, OrgRole } from "@/lib/types";

const ROLE_META: Record<OrgRole, { label: string; color: string; desc: string }> = {
  admin:       { label: "Administrateur", color: "bg-coral/10 text-coral-dark border-coral/20", desc: "Accès complet à tout le lieu" },
  coord:       { label: "Coordination", color: "bg-purple-50 text-purple-700 border-purple-200", desc: "Gère le lieu au quotidien" },
  comm:        { label: "Communication", color: "bg-blue-50 text-blue-700 border-blue-200", desc: "Site public, événements, communication" },
  finance:     { label: "Trésorerie", color: "bg-emerald-50 text-emerald-700 border-emerald-200", desc: "Finances, adhésions, subventions" },
  benevole:    { label: "Bénévole", color: "bg-amber-50 text-amber-700 border-amber-200", desc: "Accès limité aux tâches assignées" },
  intervenant: { label: "Intervenant", color: "bg-slate-100 text-slate-600 border-slate-200", desc: "Accès ponctuel (résidence, atelier)" },
  readonly:    { label: "Lecture seule", color: "bg-slate-100 text-slate-500 border-slate-200", desc: "Consultation uniquement" },
};

const ROLES: OrgRole[] = ["admin", "coord", "comm", "finance", "benevole", "intervenant", "readonly"];

function initials(name: string | null, email: string | null): string {
  const src = name || email || "?";
  return src.split(/[\s@.]+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function TeamView({ members, orgSlug, orgId }: {
  members: TeamMember[]; orgSlug: string; orgId: string;
}) {
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function changeRole(member: TeamMember, role: OrgRole) {
    start(async () => {
      const ok = (await updateMemberRoleAction(orgSlug, orgId, member.user_id, role, member.zones)).ok;
      if (ok) toast.success(`Rôle mis à jour : ${ROLE_META[role].label}`);
      else toast.error("Erreur lors de la mise à jour");
    });
  }

  function handleRemove() {
    if (!confirmRemove) return;
    start(async () => {
      const ok = (await removeMemberAction(orgSlug, orgId, confirmRemove.user_id)).ok;
      if (ok) toast.success("Membre retiré de l'équipe");
      else toast.error("Erreur");
      setConfirmRemove(null);
    });
  }

  function copyInviteInfo() {
    const text = `Rejoignez l'équipe sur Casa Minga : créez votre compte sur https://admin.casaminga.com puis demandez à un administrateur de vous ajouter.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Instructions copiées");
    setTimeout(() => setCopied(false), 2000);
  }

  const admins = members.filter((m) => m.role === "admin").length;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Membres de l'équipe", value: members.length, icon: <Users className="size-4" /> },
          { label: "Administrateurs", value: admins, icon: <Shield className="size-4 text-coral-dark" /> },
          { label: "Rôles distincts", value: new Set(members.map((m) => m.role)).size, icon: <Shield className="size-4 text-blue-600" /> },
        ].map((k) => (
          <div key={k.label} className="mc-card p-4">
            <div className="mb-1 text-warmgray">{k.icon}</div>
            <div className="text-xl font-bold text-foreground">{k.value}</div>
            <div className="text-xs text-warmgray">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Invitation */}
      <div className="mc-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-peach-pale text-coral-dark">
            <Mail className="size-4" />
          </span>
          <div className="flex-1">
            <h3 className="font-heading text-sm font-bold text-foreground">Inviter un nouveau membre</h3>
            <p className="mt-1 text-xs text-warmgray">
              La personne crée son compte sur admin.casaminga.com, puis un administrateur l'ajoute à l'équipe et lui attribue un rôle.
            </p>
            <button onClick={copyInviteInfo}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-warmgray hover:bg-cream transition-colors">
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? "Copié" : "Copier les instructions d'invitation"}
            </button>
          </div>
        </div>
      </div>

      {/* Liste membres */}
      <div className="mc-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-heading text-sm font-bold text-foreground">Membres ({members.length})</h3>
        </div>
        <div className="divide-y divide-border">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-4 px-5 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-coral/10 text-sm font-bold text-coral-dark">
                {initials(m.full_name, m.email)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-foreground truncate">{m.full_name ?? "Sans nom"}</div>
                <div className="text-xs text-warmgray truncate">{m.email ?? "—"}</div>
              </div>

              {/* Sélecteur de rôle */}
              <select
                value={m.role}
                onChange={(e) => changeRole(m, e.target.value as OrgRole)}
                disabled={pending}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-coral cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>

              <button
                onClick={() => setConfirmRemove(m)}
                disabled={pending}
                className="rounded-lg p-2 text-warmgray/50 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30"
                title="Retirer de l'équipe"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Légende des rôles */}
      <div className="mc-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="size-4 text-warmgray" />
          <h3 className="font-heading text-sm font-bold text-foreground">Les rôles</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="flex items-center gap-2.5">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0 ${ROLE_META[r].color}`}>
                {ROLE_META[r].label}
              </span>
              <span className="text-xs text-warmgray">{ROLE_META[r].desc}</span>
            </div>
          ))}
        </div>
      </div>

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
