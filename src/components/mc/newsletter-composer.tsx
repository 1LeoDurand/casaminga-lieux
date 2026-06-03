"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Megaphone, X, Send } from "lucide-react";
import { sendNewsletter } from "@/app/(admin)/dashboard/[org]/communaute/newsletter-actions";

interface GroupLite { id: string; name: string; memberCount: number }

const input =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";

export function NewsletterComposer({
  groups, orgId, orgSlug,
}: {
  groups: GroupLite[]; orgId: string; orgSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function send() {
    if (!subject.trim() || !body.trim()) { toast.error("Objet et message requis."); return; }
    const target = groupId ? groups.find((g) => g.id === groupId)?.name : "tous les membres";
    if (!confirm(`Envoyer ce bulletin à ${target} ?`)) return;
    startTransition(async () => {
      const res = await sendNewsletter(orgId, orgSlug, { groupId: groupId || null, subject, body });
      if (res.ok) {
        toast.success(`Bulletin envoyé à ${res.sent}/${res.total} destinataire(s) ✓`);
        setOpen(false); setSubject(""); setBody(""); setGroupId("");
      } else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="mc-dq-btn primary">
        <Megaphone className="mc-dq-ic size-4" /> Envoyer un bulletin
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-ink">Bulletin aux membres</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-warmgray hover:bg-cream"><X className="size-5" /></button>
            </div>

            <label className="mb-1 block text-[12px] font-semibold text-ink">Destinataires</label>
            <select className={input} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Tous les membres (avec email)</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.memberCount})</option>)}
            </select>

            <label className="mb-1 mt-4 block text-[12px] font-semibold text-ink">Objet *</label>
            <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex : Nouvelles du lieu — juin" />

            <label className="mb-1 mt-4 block text-[12px] font-semibold text-ink">Message *</label>
            <textarea className={`${input} min-h-[180px] resize-y`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Votre message… (une ligne vide = nouveau paragraphe)" />

            <p className="mt-2 text-[11.5px] text-warmgray">Envoi individuel à chaque membre · journalisé dans Emails (admin).</p>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-coral/40">Annuler</button>
              <button onClick={send} disabled={pending || !subject.trim() || !body.trim()} className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">
                <Send className="size-4" /> {pending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
