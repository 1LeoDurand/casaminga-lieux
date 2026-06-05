"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Eye, Send,
  Save, Clock, Settings, X, Loader2, Mail,
} from "lucide-react";
import {
  saveDraftAction,
  scheduleCampaignAction,
  sendCampaignNowAction,
  previewCampaignAction,
  sendTestAction,
  deleteCampaignAction,
} from "@/app/(admin)/dashboard/[org]/communication/newsletter-actions";
import {
  BLOCK_META,
  JOURS_SEMAINE,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterCampaign,
} from "@/lib/newsletter/types";

// ─── Styles ────────────────────────────────────────────────────────────────────
const inp = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const lbl = "mb-1 block text-[12px] font-semibold text-ink";

// ─── Groupes disponibles ───────────────────────────────────────────────────────
interface GroupLite { id: string; name: string; memberCount: number }

// ─── Créer un nouveau bloc avec valeurs par défaut ────────────────────────────
function newBlock(type: NewsletterBlockType): NewsletterBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "texte":      return { id, type, content: "" };
    case "titre":      return { id, type, text: "", level: 2 };
    case "evenements": return { id, type, title: "Nos prochains événements", count: 4 };
    case "adhesion":   return { id, type, title: "Rejoignez le lieu", show_all: true, campaign_id: null };
    case "espaces":    return { id, type, title: "Nos espaces", count: 4 };
    case "image":      return { id, type, url: "", alt: "", link: "" };
    case "bouton":     return { id, type, text: "En savoir plus", url: "" };
    case "separateur": return { id, type };
  }
}

// ─── Formulaire de configuration de bloc ─────────────────────────────────────

function BlockConfig({ block, onChange }: { block: NewsletterBlock; onChange: (b: NewsletterBlock) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(key: string, value: unknown) {
    onChange({ ...block, [key]: value } as NewsletterBlock);
  }

  switch (block.type) {
    case "texte":
      return (
        <div>
          <label className={lbl}>Contenu</label>
          <textarea
            className={`${inp} min-h-[100px] resize-y`}
            value={block.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Votre texte… (ligne vide = nouveau paragraphe)"
          />
        </div>
      );

    case "titre":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={lbl}>Texte</label>
            <input className={inp} value={block.text} onChange={(e) => set("text", e.target.value)} placeholder="Titre de section" />
          </div>
          <div>
            <label className={lbl}>Niveau</label>
            <select className={inp} value={block.level} onChange={(e) => set("level", Number(e.target.value))}>
              <option value={1}>H1 — Grand titre</option>
              <option value={2}>H2 — Sous-titre</option>
            </select>
          </div>
        </div>
      );

    case "evenements":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={lbl}>Titre de la section</label>
            <input className={inp} value={block.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Nombre d'événements affichés</label>
            <select className={inp} value={block.count} onChange={(e) => set("count", Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-warmgray">Les {block.count} prochains événements publiés seront automatiquement inclus.</p>
        </div>
      );

    case "adhesion":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={lbl}>Titre de la section</label>
            <input className={inp} value={block.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <p className="text-[11px] text-warmgray">Toutes les campagnes d'adhésion publiées seront affichées.</p>
        </div>
      );

    case "espaces":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={lbl}>Titre de la section</label>
            <input className={inp} value={block.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Nombre d'espaces</label>
            <select className={inp} value={block.count} onChange={(e) => set("count", Number(e.target.value))}>
              {[2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      );

    case "image":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={lbl}>URL de l'image</label>
            <input className={inp} value={block.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className={lbl}>Texte alternatif</label>
            <input className={inp} value={block.alt} onChange={(e) => set("alt", e.target.value)} placeholder="Description de l'image" />
          </div>
          <div>
            <label className={lbl}>Lien (optionnel)</label>
            <input className={inp} value={block.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="https://…" />
          </div>
        </div>
      );

    case "bouton":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={lbl}>Texte du bouton</label>
            <input className={inp} value={block.text} onChange={(e) => set("text", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>URL de destination</label>
            <input className={inp} value={block.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
          </div>
        </div>
      );

    case "separateur":
      return <p className="text-[12px] text-warmgray">Ligne de séparation horizontale.</p>;
  }
}

// ─── Carte de bloc ─────────────────────────────────────────────────────────────

function BlockCard({
  block,
  index,
  total,
  onUpdate,
  onDelete,
  onMove,
}: {
  block: NewsletterBlock;
  index: number;
  total: number;
  onUpdate: (b: NewsletterBlock) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = BLOCK_META[block.type];

  return (
    <div className={`rounded-2xl border bg-white ${open ? "border-coral/40" : "border-border"} transition-all`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-0.5 text-warmgray hover:text-ink disabled:opacity-20">
            <ChevronUp className="size-3.5" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded p-0.5 text-warmgray hover:text-ink disabled:opacity-20">
            <ChevronDown className="size-3.5" />
          </button>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2.5 text-left">
          <span className="text-lg leading-none">{meta.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink">{meta.label}</div>
            <div className="truncate text-[11px] text-warmgray">
              {"content" in block && block.content ? block.content.slice(0, 50) :
               "text" in block && block.text ? block.text.slice(0, 50) :
               "title" in block && block.title ? block.title :
               meta.description}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setOpen(!open)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${open ? "bg-coral/10 text-coral" : "bg-warmgray/10 text-warmgray hover:text-ink"}`}>
            {open ? "Fermer" : "Configurer"}
          </button>
          <button type="button" onClick={onDelete} className="rounded-lg p-1.5 text-warmgray hover:text-red-500">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Config (expand) */}
      {open && (
        <div className="border-t border-border p-4">
          <BlockConfig block={block} onChange={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ─── Menu "Ajouter un bloc" ───────────────────────────────────────────────────

const BLOCK_TYPES: NewsletterBlockType[] = ["texte", "titre", "evenements", "adhesion", "espaces", "image", "bouton", "separateur"];

function AddBlockMenu({ onAdd }: { onAdd: (type: NewsletterBlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-white py-4 text-sm font-semibold text-warmgray transition hover:border-coral/40 hover:text-ink"
      >
        <Plus className="size-4" /> Ajouter un bloc
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-border bg-white p-2 shadow-xl">
            <div className="grid grid-cols-2 gap-1.5">
              {BLOCK_TYPES.map((type) => {
                const m = BLOCK_META[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { onAdd(type); setOpen(false); }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-cream"
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{m.label}</div>
                      <div className="text-[11px] text-warmgray">{m.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Panneau d'aperçu ─────────────────────────────────────────────────────────

function PreviewPanel({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-heading text-base font-bold text-ink">Aperçu de la newsletter</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-cream">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-[#FAFAF5]">
          <iframe
            srcDoc={html}
            className="h-full w-full border-none"
            title="Aperçu newsletter"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export function NewsletterEditor({
  campaign,
  orgId,
  orgSlug,
  groups,
  userEmail,
}: {
  campaign: NewsletterCampaign;
  orgId: string;
  orgSlug: string;
  groups: GroupLite[];
  userEmail: string;
}) {
  const [sujet, setSujet] = useState(campaign.sujet);
  const [segmentId, setSegmentId] = useState<string>(campaign.segment_id ?? "");
  const [blocs, setBlocs] = useState<NewsletterBlock[]>(campaign.blocs as NewsletterBlock[]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [testEmail, setTestEmail] = useState(userEmail);
  const [showTest, setShowTest] = useState(false);
  const [pending, start] = useTransition();
  const isSent = campaign.statut === "envoyee";

  // ── Manipulation des blocs ────────────────────────────────────────────────────
  function addBlock(type: NewsletterBlockType) {
    setBlocs((b) => [...b, newBlock(type)]);
  }

  function updateBlock(index: number, updated: NewsletterBlock) {
    setBlocs((b) => b.map((x, i) => (i === index ? updated : x)));
  }

  function deleteBlock(index: number) {
    setBlocs((b) => b.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setBlocs((b) => {
      const arr = [...b];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  function saveDraft() {
    start(async () => {
      const res = await saveDraftAction(campaign.id, orgSlug, { sujet, blocs, segment_id: segmentId || null });
      if (res.ok) toast.success("Brouillon enregistré ✓");
      else toast.error(res.error ?? "Erreur");
    });
  }

  function sendTest() {
    if (!testEmail) { toast.error("Entrez un email."); return; }
    start(async () => {
      const res = await sendTestAction(orgId, orgSlug, blocs, sujet, testEmail);
      if (res.ok) { toast.success(`Test envoyé à ${testEmail} ✓`); setShowTest(false); }
      else toast.error(res.error ?? "Erreur d'envoi");
    });
  }

  function openPreview() {
    start(async () => {
      const res = await previewCampaignAction(orgId, orgSlug, blocs);
      if (res.ok && res.html) setPreviewHtml(res.html);
      else toast.error(res.error ?? "Erreur d'aperçu");
    });
  }

  function schedule() {
    if (!scheduleDate) { toast.error("Choisissez une date."); return; }
    start(async () => {
      const res = await scheduleCampaignAction(campaign.id, orgSlug, {
        sujet, blocs, segment_id: segmentId || null, programmee_pour: scheduleDate,
      });
      if (res.ok) { toast.success("Campagne programmée ✓"); setShowSchedule(false); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  function sendNow() {
    if (!confirm(`Envoyer "${sujet || "Sans titre"}" maintenant ?`)) return;
    start(async () => {
      // Sauvegarde d'abord
      await saveDraftAction(campaign.id, orgSlug, { sujet, blocs, segment_id: segmentId || null });
      const res = await sendCampaignNowAction(campaign.id, orgId, orgSlug);
      if (res.ok) toast.success(`Envoyé à ${res.sent}/${res.total} destinataire(s) ✓`);
      else toast.error(res.error ?? "Erreur d'envoi");
    });
  }

  return (
    <>
      {previewHtml && <PreviewPanel html={previewHtml} onClose={() => setPreviewHtml(null)} />}

      <div className="flex flex-col gap-5">
        {/* Bandeau lecture seule */}
        {isSent && (
          <div className="rounded-2xl bg-[#e8f5ee] px-5 py-3 text-sm font-semibold text-[#2f8a4c]">
            ✅ Cette campagne a été envoyée{campaign.envoyee_le ? ` le ${new Intl.DateTimeFormat("fr-FR").format(new Date(campaign.envoyee_le))}` : ""}
            {campaign.nb_envoyes != null ? ` · ${campaign.nb_envoyes} envoi(s)` : ""}
          </div>
        )}

        {/* Sujet + destinataires */}
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex flex-col gap-3">
            <div>
              <label className={lbl}>Objet de la newsletter *</label>
              <input
                className={inp}
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                placeholder="Ex : Les nouvelles de juin · Ateliers d'été"
                disabled={isSent}
              />
            </div>
            <div>
              <label className={lbl}>Destinataires</label>
              <select className={inp} value={segmentId} onChange={(e) => setSegmentId(e.target.value)} disabled={isSent}>
                <option value="">Tous les membres (non désabonnés)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.memberCount} membre(s))</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Blocs */}
        {!isSent && (
          <>
            <div className="flex flex-col gap-3">
              {blocs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-white py-10 text-center text-sm text-warmgray">
                  Ajoutez votre premier bloc ci-dessous
                </div>
              )}
              {blocs.map((block, i) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  index={i}
                  total={blocs.length}
                  onUpdate={(b) => updateBlock(i, b)}
                  onDelete={() => deleteBlock(i)}
                  onMove={(dir) => moveBlock(i, dir)}
                />
              ))}
              <AddBlockMenu onAdd={addBlock} />
            </div>
          </>
        )}

        {/* Aperçu archive si envoyée */}
        {isSent && campaign.html_archive && (
          <div className="overflow-hidden rounded-2xl border border-border bg-[#FAFAF5]">
            <div className="border-b border-border bg-white px-5 py-3 text-[13px] font-semibold text-ink">
              Archive · Rendu envoyé
            </div>
            <iframe
              srcDoc={campaign.html_archive}
              className="h-[600px] w-full border-none"
              title="Archive newsletter"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        {/* Barre d'actions */}
        {!isSent && (
          <div className="sticky bottom-4 rounded-2xl border border-border bg-white p-4 shadow-lg">
            <div className="flex flex-wrap items-center gap-2">
              {/* Aperçu */}
              <button type="button" onClick={openPreview} disabled={pending || !blocs.length}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40 disabled:opacity-40">
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />} Aperçu
              </button>

              {/* Test */}
              <button type="button" onClick={() => setShowTest(!showTest)} disabled={pending || !blocs.length}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40 disabled:opacity-40">
                <Mail className="size-3.5" /> Tester
              </button>

              {/* Programmer */}
              <button type="button" onClick={() => setShowSchedule(!showSchedule)} disabled={pending || !blocs.length || !sujet.trim()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40 disabled:opacity-40">
                <Clock className="size-3.5" /> Programmer
              </button>

              <div className="ml-auto flex items-center gap-2">
                {/* Sauvegarder */}
                <button type="button" onClick={saveDraft} disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40 disabled:opacity-40">
                  <Save className="size-3.5" /> Enregistrer
                </button>

                {/* Envoyer maintenant */}
                <button type="button" onClick={sendNow} disabled={pending || !blocs.length || !sujet.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 text-[13px] font-bold text-white shadow transition hover:bg-coral-dark disabled:opacity-40">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Envoyer maintenant
                </button>
              </div>
            </div>

            {/* Sous-panneau : test email */}
            {showTest && (
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                <input
                  className={`${inp} flex-1`}
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="votre@email.com"
                />
                <button type="button" onClick={sendTest} disabled={pending}
                  className="shrink-0 rounded-full bg-coral px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                  Envoyer le test
                </button>
              </div>
            )}

            {/* Sous-panneau : programmation */}
            {showSchedule && (
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                <input
                  className={`${inp} flex-1`}
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <button type="button" onClick={schedule} disabled={pending || !scheduleDate}
                  className="shrink-0 rounded-full bg-coral px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                  Programmer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
