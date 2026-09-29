"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { updatePersonalLine, validateLot } from "@/app/admin/contacts/actions";
import type { LotItem } from "@/lib/outreach/data";

/** Batch validation: the template once, one editable personal sentence per place, checkboxes. */
export function LotView({ items, templateText, subject }: { items: LotItem[]; templateText: string | null; subject: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.thread_id, true])));
  const [lines, setLines] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.thread_id, i.personal_line ?? ""])));

  const selected = items.filter((i) => checked[i.thread_id]);
  const dirty = (i: LotItem) => (lines[i.thread_id] ?? "") !== (i.personal_line ?? "");
  const anyDirty = items.some(dirty);

  function saveLine(i: LotItem) {
    start(async () => {
      const res = await updatePersonalLine(i.thread_id, lines[i.thread_id] ?? "");
      if (res.ok) { toast.success("Phrase enregistrée"); router.refresh(); }
      else toast.error(res.error ?? "Enregistrement impossible.");
    });
  }

  function validate() {
    start(async () => {
      const res = await validateLot(selected.map((i) => i.thread_id));
      if (res.ok) {
        toast.success(`${res.data?.validated ?? 0} brouillon(s) validé(s)`);
        if (res.error) toast.warning(res.error);
        router.refresh();
      } else toast.error(res.error ?? "Validation impossible.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {templateText ? (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase text-warmgray">Gabarit commun{subject ? ` · objet : ${subject}` : ""}</div>
          <pre className="whitespace-pre-wrap rounded-xl border border-border bg-cream p-4 text-[13px] leading-relaxed text-ink">{templateText}</pre>
          <p className="mt-1 text-[11px] text-warmgray">Reconstitué d&apos;après le premier brouillon : la phrase personnalisée et le nom du lieu sont remplacés par des repères.</p>
        </div>
      ) : null}

      <div className="mc-table-wrap rounded-xl border border-border bg-white">
        <table className="mc-table">
          <thead>
            <tr>
              <th className="w-10">
                <input type="checkbox" aria-label="Tout cocher" checked={selected.length === items.length}
                  onChange={(e) => setChecked(Object.fromEntries(items.map((i) => [i.thread_id, e.target.checked])))} />
              </th>
              <th>Lieu</th><th>Phrase personnalisée</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.thread_id} style={{ cursor: "default" }}>
                <td><input type="checkbox" aria-label={`Valider ${i.contact_name}`} checked={!!checked[i.thread_id]}
                  onChange={(e) => setChecked((c) => ({ ...c, [i.thread_id]: e.target.checked }))} /></td>
                <td className="min-w-[180px] align-top">
                  <Link className="font-semibold text-ink hover:text-coral-dark" href={`/admin/contacts/lieux/${i.contact_id}`}>{i.contact_name}</Link>
                  <div className="text-[11px] text-warmgray">{i.email ?? "Adresse inconnue"}</div>
                </td>
                <td className="w-full min-w-[280px]">
                  <textarea className="mc-textarea" rows={2} value={lines[i.thread_id] ?? ""}
                    onChange={(e) => setLines((l) => ({ ...l, [i.thread_id]: e.target.value }))} aria-label={`Phrase pour ${i.contact_name}`} />
                  {dirty(i) ? (
                    <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" disabled={pending} onClick={() => saveLine(i)}>Enregistrer la phrase</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="mc-btn mc-btn-lime" disabled={pending || selected.length === 0 || anyDirty} onClick={validate}>
          <Check className="size-4" /> Valider le lot ({selected.length})
        </button>
        <span className="text-[12px] text-warmgray">
          {anyDirty ? "Enregistre d'abord les phrases modifiées." : "Les envois sont répartis dans la file, un toutes les 10 minutes environ."}
        </span>
      </div>
    </div>
  );
}
