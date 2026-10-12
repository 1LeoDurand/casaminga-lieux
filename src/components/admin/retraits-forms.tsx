"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { poserRetrait, leverRetrait } from "@/app/admin/portail/retraits/actions";
import { PORTEES, CANAUX, type Portee, type Canal } from "@/lib/admin/retraits-constantes";

const champ =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-coral";

export function PoserRetraitForm({
  type,
  id,
  sources,
  threadId,
}: {
  type: "organisation" | "lieu";
  id: string;
  sources: string[];
  threadId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [portee, setPortee] = useState<Portee>(type === "lieu" ? "import" : "medias");
  const [canal, setCanal] = useState<Canal>("courriel");
  const aujourdhui = new Date().toISOString().slice(0, 10);

  function envoyer(formData: FormData) {
    startTransition(async () => {
      const res = await poserRetrait(formData);
      if (res.ok) {
        toast.success(res.resume ?? "Retrait posé");
        router.push("/admin/portail/retraits");
        router.refresh();
      } else {
        toast.error(res.error ?? "Échec");
      }
    });
  }


  return (
    <form action={envoyer} className="space-y-4">
      <input type="hidden" name={type === "organisation" ? "organization_id" : "annuaire_lieu_id"} value={id} />
      {threadId && <input type="hidden" name="thread" value={threadId} />}

      <fieldset>
        <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-warmgray">Ce qu&apos;il faut faire</legend>
        <div className="space-y-2">
          {PORTEES.filter((p) => type === "organisation" || p.value === "import").map((p) => (
            <label key={p.value} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3 text-[13px] has-[:checked]:border-coral has-[:checked]:bg-peach-pale/40">
              <input
                type="radio"
                name="portee"
                value={p.value}
                checked={portee === p.value}
                onChange={() => setPortee(p.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold text-ink">{p.label}</span>
                <span className="block text-[12px] text-warmgray">{p.aide}</span>
              </span>
            </label>
          ))}
        </div>
        {type === "lieu" && (
          <p className="mt-2 text-[12px] text-warmgray">
            Un lieu de l&apos;annuaire sans organisation importée n&apos;a pas de fiches : seul « Ne plus importer » s&apos;applique.
          </p>
        )}
      </fieldset>

      {portee === "import" && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-warmgray">Source (facultatif)</span>
          <input name="source" list="sources-retrait" placeholder="vide : toutes les sources" className={champ} maxLength={120} />
          <datalist id="sources-retrait">
            {sources.map((s) => <option key={s} value={s} />)}
          </datalist>
          <span className="mt-1 block text-[12px] text-warmgray">
            Exemples : <code>openagenda</code>, <code>datatourisme</code>, <code>site:domaine.fr</code>. Vide, tous les imports s&apos;abstiennent.
          </span>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-warmgray">Motif (obligatoire)</span>
        <textarea name="motif" required minLength={3} maxLength={500} rows={3} className={champ} placeholder="En quelques mots : pourquoi ce retrait. Sans nom ni courriel de la personne." />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-warmgray">Canal de la demande</span>
          <select name="canal" value={canal} onChange={(e) => setCanal(e.target.value as Canal)} className={champ}>
            {CANAUX.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-warmgray">Date de la demande</span>
          <input type="date" name="demande_le" defaultValue={aujourdhui} max={aujourdhui} className={champ} />
        </label>
      </div>

      {canal === "plainte" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
          Plainte formelle : pensez aussi à mettre en pause l&apos;import concerné. Cet outil ne le fait pas lui-même.
        </p>
      )}

      <p className="text-[12px] text-warmgray">
        Le journal ne garde ni courriel ni nom du demandeur. Tout est réversible : « Lever » remet les fiches dans leur état d&apos;avant.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-coral-dark disabled:opacity-50"
      >
        {pending ? "Retrait en cours" : "Poser le retrait"}
      </button>
    </form>
  );
}

export function LeverRetraitForm({ retraitId }: { retraitId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);

  function envoyer(formData: FormData) {
    startTransition(async () => {
      const res = await leverRetrait(formData);
      if (res.ok) {
        toast.success(res.resume ?? "Retrait levé");
        router.refresh();
      } else {
        toast.error(res.error ?? "Échec");
      }
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-warmgray transition-colors hover:border-coral hover:text-ink"
      >
        Lever
      </button>
    );
  }
  return (
    <form action={envoyer} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <input type="hidden" name="retrait_id" value={retraitId} />
      <input name="motif" required minLength={3} maxLength={500} placeholder="Motif de la levée" className={`${champ} sm:w-64`} />
      <button type="submit" disabled={pending} className="rounded-lg bg-coral px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-coral-dark disabled:opacity-50">
        {pending ? "En cours" : "Confirmer la levée"}
      </button>
      <button type="button" onClick={() => setOuvert(false)} className="text-[12.5px] text-warmgray hover:text-ink">
        Annuler
      </button>
    </form>
  );
}
