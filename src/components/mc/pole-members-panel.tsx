"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { assignPoleMember, removePoleMember, type PoleMember } from "@/lib/pole-members";
import { POLE_ROLES, poleRoleLabel, type PoleRole } from "@/lib/pole-meta";
import type { Pole, TeamMember } from "@/lib/types";

const roleLabel = poleRoleLabel;

export function PoleMembersPanel({ poles, members, assignments, orgId, orgSlug }: {
  poles: Pole[]; members: TeamMember[]; assignments: PoleMember[];
  orgId: string; orgSlug: string;
}) {
  const [local, setLocal] = useState<PoleMember[]>(assignments);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [selUser, setSelUser] = useState("");
  const [selRole, setSelRole] = useState<PoleRole>("membre");
  const [, start] = useTransition();

  const memberName = (uid: string) => {
    const m = members.find((x) => x.user_id === uid);
    return m?.full_name ?? m?.email ?? "Membre inconnu";
  };

  function add(poleId: string) {
    if (!selUser) { toast.error("Choisissez un membre."); return; }
    start(async () => {
      const res = await assignPoleMember(orgSlug, orgId, poleId, selUser, selRole);
      if (res.ok) {
        setLocal((prev) => [...prev.filter((a) => !(a.pole_id === poleId && a.user_id === selUser)),
          { id: crypto.randomUUID(), pole_id: poleId, user_id: selUser, pole_role: selRole }]);
        toast.success("Membre rattaché au pôle");
        setAddingTo(null); setSelUser(""); setSelRole("membre");
      } else toast.error(res.error ?? "Erreur");
    });
  }

  function remove(poleId: string, userId: string) {
    start(async () => {
      const res = await removePoleMember(orgSlug, poleId, userId);
      if (res.ok) {
        setLocal((prev) => prev.filter((a) => !(a.pole_id === poleId && a.user_id === userId)));
        toast.success("Membre retiré du pôle");
      } else toast.error(res.error ?? "Erreur");
    });
  }

  if (poles.length === 0) {
    return <p className="text-[13px] text-warmgray">Créez d&apos;abord des pôles pour y affecter des membres.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {poles.map((p) => {
        const poleAssign = local.filter((a) => a.pole_id === p.id);
        return (
          <div key={p.id} className="rounded-xl border border-border bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: p.color }} />
              <span className="text-[13px] font-semibold text-ink">{p.name}</span>
              <button onClick={() => { setAddingTo(addingTo === p.id ? null : p.id); setSelUser(""); }}
                className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-coral-dark hover:underline">
                <UserPlus className="size-3.5" /> Affecter
              </button>
            </div>

            {addingTo === p.id && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-peach-pale p-2">
                <select value={selUser} onChange={(e) => setSelUser(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-coral">
                  <option value="">— Choisir un membre —</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
                </select>
                <select value={selRole} onChange={(e) => setSelRole(e.target.value as PoleRole)}
                  className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-coral">
                  {POLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button onClick={() => add(p.id)} className="mc-btn mc-btn-lime mc-btn-sm">OK</button>
              </div>
            )}

            {poleAssign.length === 0 ? (
              <p className="text-[12px] text-warmgray">Aucun membre affecté.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {poleAssign.map((a) => (
                  <span key={a.user_id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-cream px-2.5 py-1 text-[12px]">
                    <span className="font-semibold text-ink">{memberName(a.user_id)}</span>
                    <span className="text-warmgray">· {roleLabel(a.pole_role)}</span>
                    <button onClick={() => remove(p.id, a.user_id)} className="text-warmgray hover:text-red-600">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
