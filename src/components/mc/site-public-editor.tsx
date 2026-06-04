"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save, Eye, Plus, X, Globe, FileText } from "lucide-react";
import { ImageUploader } from "@/components/mc/image-uploader";
import { saveSiteConfig } from "@/app/(admin)/dashboard/[org]/site-public/actions";
import type { SitePublicConfig, SiteContent } from "@/lib/site-public/types";

const inputCls =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1.5 block text-[12px] font-semibold text-ink";

const SECTION_LABELS: { key: keyof SiteContent["sections"]; label: string; hint: string }[] = [
  { key: "lieu", label: "Découvrir le lieu", hint: "Galerie de photos + texte de présentation" },
  { key: "agenda", label: "Agenda", hint: "Vos événements publiés (automatique)" },
  { key: "adherer", label: "Adhérer", hint: "Vos campagnes d'adhésion en ligne" },
  { key: "contact", label: "Contact", hint: "Formulaire de message vers votre équipe" },
];

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <h3 className="mb-4 flex items-center gap-2 font-heading text-base font-bold text-ink">
        {icon}{title}
      </h3>
      {children}
    </div>
  );
}

export function SitePublicEditor({
  config,
  orgId,
  orgSlug,
}: {
  config: SitePublicConfig;
  orgId: string;
  orgSlug: string;
}) {
  const [title, setTitle] = useState(config.title);
  const [seo, setSeo] = useState(config.seo_description ?? "");
  const [status, setStatus] = useState(config.status);
  const [c, setC] = useState<SiteContent>(config.content);
  const [pending, start] = useTransition();

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setC((cur) => ({ ...cur, [key]: value }));
  }
  function toggleSection(key: keyof SiteContent["sections"]) {
    setC((cur) => ({ ...cur, sections: { ...cur.sections, [key]: !cur.sections[key] } }));
  }

  function save(publish?: boolean) {
    const nextStatus = publish !== undefined ? (publish ? "publie" : "brouillon") : status;
    start(async () => {
      const res = await saveSiteConfig(orgId, orgSlug, {
        title, seo_description: seo || null, status: nextStatus, content: c,
      });
      if (res.ok) {
        setStatus(nextStatus);
        toast.success(publish ? "Site publié ✓" : publish === false ? "Site dépublié" : "Enregistré ✓");
      } else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* Barre statut + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4">
        <div className="flex items-center gap-2.5">
          <span className={`size-2.5 rounded-full ${status === "publie" ? "bg-[#2f8a4c]" : "bg-warmgray/40"}`} />
          <span className="text-sm font-semibold">
            {status === "publie" ? "En ligne" : "Brouillon (non visible)"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/site/${orgSlug}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40">
            <Eye className="size-3.5" /> Aperçu
          </Link>
          {status === "publie" ? (
            <button onClick={() => save(false)} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-warmgray hover:border-red-300 hover:text-red-600 disabled:opacity-50">
              Dépublier
            </button>
          ) : (
            <button onClick={() => save(true)} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#2f8a4c] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#267a40] disabled:opacity-50">
              <Globe className="size-3.5" /> Publier
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <Card title="En-tête (hero)" icon={<FileText className="size-4 text-coral" />}>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Titre du lieu</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom affiché en grand" />
          </div>
          <div>
            <label className={labelCls}>Accroche</label>
            <input className={inputCls} value={c.hero_tagline} onChange={(e) => set("hero_tagline", e.target.value)} placeholder="Une phrase qui résume votre lieu" />
          </div>
          <ImageUploader orgId={orgId} value={c.hero_image_url} onUploaded={(url) => set("hero_image_url", url)} label="Photo principale" aspect="16/9" />
        </div>
      </Card>

      {/* À propos + galerie */}
      <Card title="Découvrir le lieu">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Titre de la section</label>
            <input className={inputCls} value={c.about_title} onChange={(e) => set("about_title", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Texte de présentation</label>
            <textarea className={`${inputCls} min-h-[120px] resize-y`} value={c.about_text} onChange={(e) => set("about_text", e.target.value)} placeholder="Présentez votre lieu, son histoire, ses valeurs…" />
          </div>

          {/* Galerie */}
          <div>
            <label className={labelCls}>Galerie de photos ({c.gallery_urls.length})</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {c.gallery_urls.map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                  <button type="button" onClick={() => set("gallery_urls", c.gallery_urls.filter((_, j) => j !== i))}
                    className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {c.gallery_urls.length < 9 && (
                <div className="aspect-square">
                  <ImageUploader orgId={orgId} value={null} aspect="1/1"
                    onUploaded={(url) => { if (url) set("gallery_urls", [...c.gallery_urls, url]); }}
                    label="" />
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Apparence */}
      <Card title="Apparence">
        <div>
          <label className={labelCls}>Couleur d'accent</label>
          <div className="flex items-center gap-2">
            <input type="color" value={c.accent_color} onChange={(e) => set("accent_color", e.target.value)}
              className="size-10 cursor-pointer rounded-lg border border-border" />
            <input className={inputCls} value={c.accent_color} onChange={(e) => set("accent_color", e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Sections */}
      <Card title="Sections affichées">
        <div className="flex flex-col gap-2">
          {SECTION_LABELS.map((s) => (
            <div key={s.key} className="flex items-start gap-3 rounded-xl border border-border bg-[#FAFAF7] p-3">
              <button type="button" onClick={() => toggleSection(s.key)}
                aria-label={c.sections[s.key] ? "Masquer" : "Afficher"}
                className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${c.sections[s.key] ? "bg-coral" : "bg-warmgray/30"}`}>
                <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${c.sections[s.key] ? "left-4" : "left-0.5"}`} />
              </button>
              <div>
                <div className="text-[13.5px] font-semibold text-ink">{s.label}</div>
                <div className="text-[12px] text-warmgray">{s.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SEO */}
      <Card title="Référencement (SEO)">
        <div>
          <label className={labelCls}>Description pour les moteurs de recherche</label>
          <textarea className={`${inputCls} min-h-[70px] resize-y`} value={seo} onChange={(e) => setSeo(e.target.value)}
            maxLength={160} placeholder="Résumé en 1-2 phrases (160 caractères max)" />
          <div className="mt-1 text-right text-[11px] text-warmgray">{seo.length}/160</div>
        </div>
      </Card>

      {/* Enregistrer */}
      <div className="sticky bottom-4 flex justify-end">
        <button onClick={() => save()} disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-coral-dark disabled:opacity-50">
          <Save className="size-4" /> {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
