"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save, Eye, X, Globe, FileText, LinkIcon, Copy, Check, AlertCircle, Mail } from "lucide-react";
import { ImageUploader } from "@/components/mc/image-uploader";
import { CopyUrlBar } from "@/components/mc/copy-url-bar";
import {
  saveSiteConfig,
  requestCustomDomainAction,
  verifyCustomDomainAction,
  removeCustomDomainAction,
  type CustomDomainState,
} from "@/app/(admin)/dashboard/[org]/site-public/actions";
import { publicSiteUrl, publicSiteUrlDisplay } from "@/lib/site-public/url";
import type { SitePublicConfig, SiteContent, SiteTheme } from "@/lib/site-public/types";
import { THEMES } from "@/lib/site-public/themes";

const inputCls =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1.5 block text-[12px] font-semibold text-ink";

const SECTION_LABELS: { key: keyof SiteContent["sections"]; label: string; hint: string }[] = [
  { key: "lieu", label: "Découvrir le lieu", hint: "Galerie de photos + texte de présentation" },
  { key: "agenda", label: "Agenda", hint: "Vos événements publiés (automatique)" },
  { key: "adherer", label: "Adhérer", hint: "Vos campagnes d'adhésion en ligne" },
  { key: "contact", label: "Contact", hint: "Formulaire de message vers votre équipe" },
];

const PAGE_LABELS: { key: keyof SiteContent["pages"]; label: string; hint: string }[] = [
  { key: "apropos",  label: "À propos",        hint: "Page dédiée avec votre texte de présentation + galerie (remplace la section accueil)" },
  { key: "agenda",   label: "Agenda complet",  hint: "Tous vos événements à venir, groupés par mois" },
  { key: "espaces",  label: "Espaces à louer", hint: "Vos espaces « disponibles » avec photos, capacité et tarifs (automatique)" },
  { key: "soutenir", label: "Soutenir",        hint: "Adhésion + appel aux dons (mention réduction d'impôt 66 %)" },
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

function normalizeDomainClient(raw: string): string {
  return raw.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" onClick={copy}
      className="ml-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-semibold text-warmgray hover:text-ink">
      {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

const TARGET_IP = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_TARGET_IP ?? "";

function CustomDomainCard({ orgId, orgSlug, initial }: {
  orgId: string;
  orgSlug: string;
  initial: CustomDomainState;
}) {
  const [state, setState] = useState<CustomDomainState>(initial);
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const res = await requestCustomDomainAction(orgId, orgSlug, domainInput);
      if (!res.ok) { setError(res.error ?? "Erreur"); return; }
      setState({
        domain: normalizeDomainClient(domainInput),
        status: "pending_dns",
        token: res.token ?? null,
      });
      setDomainInput("");
      toast.success("Domaine enregistré — configurez votre DNS");
    });
  }

  function handleVerify() {
    setError(null);
    startTransition(async () => {
      const res = await verifyCustomDomainAction(orgId, orgSlug);
      if (!res.ok) { setError(res.error ?? "Erreur"); return; }
      setState((s) => ({ ...s, status: "verified" }));
      toast.success("DNS vérifié — nous allons activer votre domaine sous 24 h");
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await removeCustomDomainAction(orgId, orgSlug);
      if (!res.ok) { setError(res.error ?? "Erreur"); return; }
      setState({ domain: null, status: null, token: null });
      toast.success("Domaine retiré");
    });
  }

  return (
    <Card title="Domaine personnalisé" icon={<LinkIcon className="size-4 text-coral" />}>
      <p className="-mt-2 mb-4 text-[12px] text-warmgray">
        Publiez votre site sur votre propre adresse (ex.&nbsp;<span className="font-mono">monlieu.fr</span>).
        Le thème que vous choisissez s&apos;applique sur votre domaine — sur{" "}
        <span className="font-mono">casaminga.com</span>, le design Casa Minga reste harmonisé.
      </p>

      {/* État : aucun domaine */}
      {!state.domain || state.status === null ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && domainInput && handleRequest()}
              placeholder="monlieu.fr"
              disabled={isPending}
            />
            <button
              type="button"
              onClick={handleRequest}
              disabled={isPending || !domainInput.trim()}
              className="shrink-0 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-dark disabled:opacity-40"
            >
              {isPending ? "…" : "Connecter"}
            </button>
          </div>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
          <EmailRegistrarEncart />
        </div>
      ) : null}

      {/* État : pending_dns */}
      {state.status === "pending_dns" && state.domain ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-700">
              <span className="size-1.5 rounded-full bg-amber-400" />
              En attente DNS — <span className="font-mono">{state.domain}</span>
            </span>
            <button type="button" onClick={handleRemove} disabled={isPending}
              className="text-[12px] text-warmgray underline hover:text-red-600 disabled:opacity-40">
              Annuler
            </button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-[13px]">
            <p className="mb-3 font-semibold text-ink">Ajoutez ces enregistrements DNS chez votre registrar :</p>

            <div className="flex flex-col gap-3">
              {/* TXT */}
              <div className="rounded-lg bg-white p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">1. TXT — vérification</span>
                </div>
                <div className="font-mono text-[12px] text-ink">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-warmgray">Nom :</span>
                    <span>_casaminga.{state.domain}</span>
                    <CopyButton text={`_casaminga.${state.domain}`} />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1 flex-wrap">
                    <span className="text-warmgray">Valeur :</span>
                    <span className="break-all">{state.token}</span>
                    <CopyButton text={state.token ?? ""} />
                  </div>
                </div>
              </div>

              {/* CNAME / A */}
              <div className="rounded-lg bg-white p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">2. CNAME — routage</span>
                </div>
                <div className="font-mono text-[12px] text-ink">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-warmgray">Nom :</span>
                    <span>www.{state.domain}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1 flex-wrap">
                    <span className="text-warmgray">Cible :</span>
                    <span>casaminga.com</span>
                    <CopyButton text="casaminga.com" />
                  </div>
                </div>
                {TARGET_IP ? (
                  <div className="mt-2 font-mono text-[12px] text-ink">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-warmgray">Nom apex :</span>
                      <span>{state.domain}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                      <span className="text-warmgray">IP (A) :</span>
                      <span>{TARGET_IP}</span>
                      <CopyButton text={TARGET_IP} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-warmgray">
                    Pour l&apos;apex (<span className="font-mono">{state.domain}</span> sans www), ajoutez un enregistrement A.{" "}
                    <a href="/aide/domaine-personnalise" className="text-coral hover:underline">Voir l&apos;article d&apos;aide</a>
                  </p>
                )}
              </div>
            </div>

            <p className="mt-3 text-[12px] text-warmgray">
              La propagation DNS peut prendre jusqu&apos;à <strong>1 heure</strong>. Revenez vérifier une fois les enregistrements ajoutés.
            </p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleVerify}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-coral/30 bg-white px-4 py-2.5 text-sm font-semibold text-coral transition hover:bg-coral/5 disabled:opacity-40"
          >
            {isPending ? "Vérification…" : "Vérifier la configuration DNS"}
          </button>
        </div>
      ) : null}

      {/* État : verified */}
      {state.status === "verified" && state.domain ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-700">
              <Check className="size-3.5" />
              DNS vérifié — <span className="font-mono">{state.domain}</span>
            </div>
            <button type="button" onClick={handleRemove} disabled={isPending}
              className="shrink-0 text-[12px] text-warmgray underline hover:text-red-600 disabled:opacity-40">
              Annuler
            </button>
          </div>
          <p className="rounded-xl bg-blue-50/60 p-3 text-[13px] text-blue-800">
            Votre domaine est vérifié. Notre équipe va activer la connexion dans les <strong>24 heures</strong> — vous recevrez un email de confirmation.
          </p>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
        </div>
      ) : null}

      {/* État : active */}
      {state.status === "active" && state.domain ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <a
              href={`https://${state.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-[12px] font-semibold text-green-700 hover:bg-green-100"
            >
              <span className="size-2 rounded-full bg-green-500" />
              En ligne · {state.domain}
            </a>
            <button type="button" onClick={handleRemove} disabled={isPending}
              className="shrink-0 text-[12px] text-warmgray underline hover:text-red-600 disabled:opacity-40">
              Retirer le domaine
            </button>
          </div>
          <p className="text-[12px] text-warmgray">
            Le thème choisi dans l&apos;onglet Apparence s&apos;applique sur votre domaine.
            Sur <span className="font-mono">casaminga.com/{orgSlug}</span>, le design Casa Minga (Chaleureux) reste actif.
          </p>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

function EmailRegistrarEncart() {
  return (
    <div className="mt-1 flex items-start gap-3 rounded-xl border border-border bg-[#FAFAF7] p-3">
      <Mail className="mt-0.5 size-4 shrink-0 text-warmgray" />
      <div className="text-[12px] text-warmgray">
        <span className="font-semibold text-ink">Adresse email personnalisée</span>{" "}
        (ex.&nbsp;<span className="font-mono">contact@monlieu.fr</span>) — à créer directement chez votre registrar, souvent incluse avec le domaine.{" "}
        <a href="/aide/adresse-email-registrar" className="text-coral hover:underline">Comment faire →</a>
      </div>
    </div>
  );
}

export function SitePublicEditor({
  config,
  orgId,
  orgSlug,
  domainState,
}: {
  config: SitePublicConfig;
  orgId: string;
  orgSlug: string;
  domainState?: CustomDomainState;
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
  function togglePage(key: keyof SiteContent["pages"]) {
    setC((cur) => ({ ...cur, pages: { ...cur.pages, [key]: !cur.pages[key] } }));
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

      {/* URL publique à partager */}
      {status === "publie" ? (
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-ink">Adresse publique de votre site</label>
          <CopyUrlBar url={publicSiteUrl(orgSlug)} display={publicSiteUrlDisplay(orgSlug)} />
        </div>
      ) : null}

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
        <div className="flex flex-col gap-5">
          <div>
            <label className={labelCls}>Thème du site</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(THEMES) as SiteTheme[]).map((key) => {
                const th = THEMES[key];
                const active = c.theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set("theme", key)}
                    className={`flex flex-col overflow-hidden rounded-xl border-2 text-left transition ${
                      active ? "border-coral ring-2 ring-coral/20" : "border-border hover:border-coral/40"
                    }`}
                  >
                    {/* Mini-aperçu */}
                    <div className="flex h-16 flex-col justify-center gap-1.5 px-3" style={{ background: th.preview.bg }}>
                      <div
                        className="h-2 w-2/3 rounded-sm"
                        style={{
                          background: th.preview.text,
                          fontFamily: undefined,
                        }}
                      />
                      <div className="h-1.5 w-1/2 rounded-sm opacity-40" style={{ background: th.preview.text }} />
                      <div className="h-2 w-8 rounded-full" style={{ background: th.preview.accent }} />
                    </div>
                    <div className="border-t border-border bg-white px-3 py-2">
                      <div className="text-[12.5px] font-bold text-ink">{th.label}</div>
                      <div className="text-[10.5px] leading-tight text-warmgray">{th.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Couleur d'accent</label>
            <div className="flex items-center gap-2">
              <input type="color" value={c.accent_color} onChange={(e) => set("accent_color", e.target.value)}
                className="size-10 cursor-pointer rounded-lg border border-border" />
              <input className={inputCls} value={c.accent_color} onChange={(e) => set("accent_color", e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Pages du site */}
      <Card title="Pages du site" icon={<Globe className="size-4 text-coral" />}>
        <p className="-mt-2 mb-3 text-[12px] text-warmgray">
          Activez des pages dédiées : elles apparaissent automatiquement dans la navigation du site.
          Sans page activée, le site reste une page unique avec les sections ci-dessous.
        </p>
        <div className="flex flex-col gap-2">
          {PAGE_LABELS.map((p) => (
            <div key={p.key} className="flex items-start gap-3 rounded-xl border border-border bg-[#FAFAF7] p-3">
              <button type="button" onClick={() => togglePage(p.key)}
                aria-label={c.pages[p.key] ? "Désactiver" : "Activer"}
                className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${c.pages[p.key] ? "bg-coral" : "bg-warmgray/30"}`}>
                <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${c.pages[p.key] ? "left-4" : "left-0.5"}`} />
              </button>
              <div>
                <div className="text-[13.5px] font-semibold text-ink">{p.label}</div>
                <div className="text-[12px] text-warmgray">{p.hint}</div>
              </div>
            </div>
          ))}
        </div>
        {c.pages.soutenir ? (
          <div className="mt-4">
            <label className={labelCls}>Texte d&apos;appel aux dons (page Soutenir)</label>
            <textarea className={`${inputCls} min-h-[80px] resize-y`} value={c.soutenir_text}
              onChange={(e) => set("soutenir_text", e.target.value)}
              placeholder="Pourquoi soutenir votre lieu ? (un texte par défaut est affiché si vide)" />
          </div>
        ) : null}
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

      {/* Domaine personnalisé */}
      {domainState !== undefined ? (
        <CustomDomainCard orgId={orgId} orgSlug={orgSlug} initial={domainState} />
      ) : null}

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
