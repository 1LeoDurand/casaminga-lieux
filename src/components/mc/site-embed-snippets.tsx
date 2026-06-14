"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Panneau « Intégrer mon agenda » — donne au coordinateur les snippets prêts
 * à coller pour diffuser ses événements ailleurs :
 *  - iframe (widget visuel sur WordPress/Wix/site perso) → /embed/<slug>/agenda
 *  - abonnement iCal (Google Agenda, Outlook, Apple Calendar) → /site/<slug>/agenda.ics
 *  - flux JSON (intégrations sur-mesure) → /site/<slug>/agenda.json
 *
 * Les URLs pointent sur le host de l'app (sert /site et /embed sans proxy).
 */
export function SiteEmbedSnippets({ appBase, slug }: { appBase: string; slug: string }) {
  const base = appBase.replace(/\/$/, "");
  const icalUrl = `${base}/site/${slug}/agenda.ics`;
  const jsonUrl = `${base}/site/${slug}/agenda.json`;
  const iframe = `<iframe src="${base}/embed/${slug}/agenda" style="width:100%;border:0" height="600" loading="lazy" title="Agenda"></iframe>`;

  const items: { key: string; title: string; desc: string; value: string }[] = [
    {
      key: "iframe",
      title: "Widget à intégrer (iframe)",
      desc: "Collez ce code sur votre site (WordPress, Wix, site perso) pour afficher l'agenda.",
      value: iframe,
    },
    {
      key: "ical",
      title: "Abonnement agenda (iCal)",
      desc: "À ajouter dans Google Agenda / Outlook / Apple Calendar (« s'abonner par URL »).",
      value: icalUrl,
    },
    {
      key: "json",
      title: "Flux JSON (avancé)",
      desc: "Pour une intégration sur-mesure des événements.",
      value: jsonUrl,
    },
  ];

  return (
    <div className="mc-card flex flex-col gap-5 p-5">
      <div>
        <h3 className="text-[15px] font-bold text-foreground">Intégrer mon agenda ailleurs</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Diffusez vos événements sur un autre site ou un agenda partagé. Mise à jour automatique.
          <br />
          <span className="text-[12px]">
            Nécessite que la page <strong>Agenda</strong> soit activée et le site publié.
          </span>
        </p>
      </div>

      {items.map((it) => (
        <SnippetRow key={it.key} title={it.title} desc={it.desc} value={it.value} />
      ))}
    </div>
  );
}

function SnippetRow({ title, desc, value }: { title: string; desc: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copié ✓");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier — sélectionnez le texte manuellement.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-foreground">{title}</span>
        <button
          type="button"
          onClick={copy}
          className="mc-btn mc-btn-sm shrink-0"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <p className="text-[12px] text-muted-foreground">{desc}</p>
      <code className="block overflow-x-auto whitespace-pre rounded-lg border border-input bg-muted/40 px-3 py-2 text-[12px] text-foreground">
        {value}
      </code>
    </div>
  );
}
