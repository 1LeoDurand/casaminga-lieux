"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, RotateCcw } from "lucide-react";
import {
  updatePermissionsAction,
  sendPasswordResetAction,
} from "@/app/(admin)/dashboard/[org]/personnes/access-actions";
import type { TeamMember } from "@/lib/types";
import { ROLE_PERMS, roleLabel } from "@/lib/roles";
import type { OrgRole, PermissionSet } from "@/lib/roles";
import { Avatar } from "@/components/mc/avatar";

const PERM_LABELS: Array<{ key: keyof PermissionSet; label: string; icon: string }> = [
  { key: "perm_pilotage",     label: "Pilotage",         icon: "📊" },
  { key: "perm_gestion_lieu", label: "Gestion du lieu",  icon: "🏛"  },
  { key: "perm_structure",    label: "Structure",         icon: "🏗"  },
  { key: "perm_publication",  label: "Publication",       icon: "📢" },
  { key: "perm_systeme",      label: "Système",           icon: "⚙️" },
];


function MemberRow({
  member,
  orgSlug,
  orgId,
}: {
  member: TeamMember;
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
  const [expanded, setExpanded] = useState(false);
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
      if (res.ok) { toast.success("Permissions mises à jour ✓"); setDirty(false); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  async function sendReset() {
    if (!member.email) return;
    setResetting(true);
    const res = await sendPasswordResetAction(orgSlug, orgId, member.email, member.full_name ?? member.email);
    setResetting(false);
    if (res.ok) toast.success(`Lien envoyé à ${member.email} ✓`);
    else toast.error(res.error ?? "Erreur");
  }

  const activePerms = PERM_LABELS.filter((p) => perms[p.key]);

  return (
    <li className="rounded-2xl border border-border bg-white">
      {/* En-tête membre */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition hover:bg-peach-pale/40"
      >
        <Avatar name={member.full_name ?? member.email ?? "?"} size={40} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[14px] font-bold text-ink">
            {member.full_name ?? member.email}
          </p>
          <p className="truncate text-[12px] text-warmgray">
            {member.email} · {roleLabel(member.role)}
          </p>
        </div>

        {/* Badges permissions actives */}
        <div className="hidden flex-wrap justify-end gap-1 sm:flex" style={{ maxWidth: 240 }}>
          {activePerms.length === 0 ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-warmgray">
              Aucune permission
            </span>
          ) : (
            activePerms.map((p) => (
              <span
                key={p.key}
                className="rounded-full border border-coral/20 bg-peach-pale px-2 py-0.5 text-[10px] font-semibold text-coral-dark"
              >
                {p.icon} {p.label}
              </span>
            ))
          )}
        </div>

        <span className={`ml-2 text-warmgray transition-transform ${expanded ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {/* Détail étendu */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          {/* Permissions */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Permissions</h4>
              <button
                type="button"
                onClick={resetToRole}
                className="flex items-center gap-1 text-[11px] text-coral hover:underline"
                title={`Réinitialiser selon le rôle « ${roleLabel(member.role)} »`}
              >
                <RotateCcw className="size-3" /> Selon le rôle
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {PERM_LABELS.map((p) => {
                const checked = perms[p.key];
                return (
                  <label
                    key={p.key}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${
                      checked ? "border-coral/30 bg-peach-pale" : "border-border bg-[#FAFAF7]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.key)}
                      className="size-4 cursor-pointer accent-coral"
                    />
                    <span className="text-[13px]">{p.icon}</span>
                    <span className={`text-[13px] font-semibold ${checked ? "text-ink" : "text-warmgray"}`}>
                      {p.label}
                    </span>
                  </label>
                );
              })}
            </div>
            {dirty && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="mt-2.5 rounded-xl bg-coral px-5 py-2 text-[13px] font-bold text-white transition hover:bg-coral-dark disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            )}
          </div>

          {/* Reset MDP */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-[#FAFAF7] px-4 py-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-3.5 shrink-0 text-warmgray" />
              <div>
                <p className="text-[12.5px] font-semibold text-ink">Réinitialiser le mot de passe</p>
                <p className="text-[11px] text-warmgray">Envoie un lien sécurisé valable 1 heure</p>
              </div>
            </div>
            <button
              type="button"
              onClick={sendReset}
              disabled={resetting}
              className="shrink-0 rounded-xl border border-border bg-white px-4 py-2 text-[12.5px] font-semibold text-foreground transition hover:border-coral/40 hover:bg-peach-pale disabled:opacity-40"
            >
              {resetting ? "Envoi…" : "Envoyer le lien"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function MembersAccessList({
  members,
  orgSlug,
  orgId,
}: {
  members: TeamMember[];
  orgSlug: string;
  orgId: string;
}) {
  const active = members.filter((m) => m.status === "actif");
  const others = members.filter((m) => m.status !== "actif");

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
        <ShieldCheck className="mx-auto mb-2 size-8 opacity-30" />
        Aucun membre avec accès au logiciel pour l&apos;instant.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2.5">
        {active.map((m) => (
          <MemberRow key={m.user_id} member={m} orgSlug={orgSlug} orgId={orgId} />
        ))}
      </ul>

      {others.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-warmgray">
            Invitations en attente / suspendus
          </h3>
          <ul className="space-y-2">
            {others.map((m) => (
              <MemberRow key={m.user_id} member={m} orgSlug={orgSlug} orgId={orgId} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
