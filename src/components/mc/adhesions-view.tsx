"use client";
import { useMemo, useState, useTransition } from "react";
import {
  X, Plus, Pencil, Trash2, Users, Eye, EyeOff,
  Check, Ban, ExternalLink, ArrowRight, ChevronRight, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import {
  CAMPAIGN_STATUSES,
  campaignStatusLabel, campaignStatusBadge,
  appStatusLabel, appStatusBadge,
  PERIOD_TYPES, formatDate, formatAmount, slugify,
} from "@/lib/adhesions-meta";
import {
  createCampaignAction, updateCampaignAction, deleteCampaignAction,
  createTierAction, updateTierAction,
  updateApplicationAction,
} from "@/app/(admin)/dashboard/[org]/adhesions/actions";
import type { MembershipApplication, MembershipCampaign, MembershipTier } from "@/lib/types";

// ── Types wizard ────────────────────────────────────────────
interface Step1 { title: string; slug: string; description: string; status: MembershipCampaign["status"]; period_type: MembershipCampaign["period_type"]; period_start: string; period_end: string; }
interface Step2 { tiers: { id?: string; name: string; description: string; amount: string; sort_order: number }[]; allow_donation: boolean; donation_amounts: string; show_member_count: boolean; show_collected: boolean; generate_cards: boolean; max_members: string; }

// ── Wizard de création / édition campagne ────────────────────
function CampaignWizard({ campaign, orgId, orgSlug, onClose, onSaved }: {
  campaign: MembershipCampaign | null;
  orgId: string; orgSlug: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [pending, startT] = useTransition();
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(campaign?.id ?? null);

  const [s1, setS1] = useState<Step1>({
    title: campaign?.title ?? "", slug: campaign?.slug ?? "",
    description: campaign?.description ?? "",
    status: campaign?.status ?? "brouillon",
    period_type: campaign?.period_type ?? "annee_glissante",
    period_start: campaign?.period_start ?? "", period_end: campaign?.period_end ?? "",
  });
  const [s2, setS2] = useState<Step2>({
    tiers: [],
    allow_donation: campaign?.allow_donation ?? false,
    donation_amounts: (campaign?.donation_amounts ?? ["30","50","100"]).join(", "),
    show_member_count: campaign?.show_member_count ?? false,
    show_collected: campaign?.show_collected ?? false,
    generate_cards: campaign?.generate_cards ?? true,
    max_members: campaign?.max_members != null ? String(campaign.max_members) : "",
  });
  const [s1Error, setS1Error] = useState<string | null>(null);

  const steps = ["Infos générales", "Montants & paramètres", "Résumé"];

  function set1<K extends keyof Step1>(k: K, v: Step1[K]) { setS1((p) => ({ ...p, [k]: v })); }
  function set2<K extends keyof Step2>(k: K, v: Step2[K]) { setS2((p) => ({ ...p, [k]: v })); }

  function handleTitleChange(t: string) {
    setS1((p) => ({ ...p, title: t, slug: !p.slug || p.slug === slugify(p.title) ? slugify(t) : p.slug }));
  }

  function addTier() {
    setS2((p) => ({ ...p, tiers: [...p.tiers, { name: "", description: "", amount: "", sort_order: p.tiers.length }] }));
  }
  function removeTier(i: number) { setS2((p) => ({ ...p, tiers: p.tiers.filter((_, idx) => idx !== i) })); }
  function setTier(i: number, k: string, v: string) {
    setS2((p) => { const t = [...p.tiers]; t[i] = { ...t[i], [k]: v }; return { ...p, tiers: t }; });
  }

  async function saveStep1() {
    if (!s1.title.trim()) { setS1Error("Le titre est obligatoire."); return; }
    if (!s1.slug.trim()) { setS1Error("Le slug est obligatoire."); return; }
    setS1Error(null);
    const payload = {
      title: s1.title.trim(), slug: s1.slug.trim().toLowerCase(),
      description: s1.description.trim() || null,
      status: s1.status, period_type: s1.period_type,
      period_start: s1.period_start || null, period_end: s1.period_end || null,
      max_members: null, allow_donation: s2.allow_donation,
      donation_amounts: s2.donation_amounts.split(",").map((x) => x.trim()).filter(Boolean),
      show_member_count: s2.show_member_count, show_collected: s2.show_collected,
      generate_cards: s2.generate_cards, photos: campaign?.photos ?? [],
    };
    startT(async () => {
      const id = savedCampaignId;
      if (id) {
        const r = await updateCampaignAction(orgSlug, id, payload); if (!r.ok) { toast.error("Erreur."); return; }
      } else {
        const r = await createCampaignAction(orgSlug, { ...payload, organization_id: orgId });
        if (!r.ok) { toast.error("Erreur."); return; }
        // In real app get id back; for demo we move forward
      }
      setSavedCampaignId(id ?? `camp-${Date.now()}`);
      setStep(1);
    });
  }

  async function saveStep2() {
    startT(async () => {
      if (savedCampaignId) {
        const patch = {
          allow_donation: s2.allow_donation,
          donation_amounts: s2.donation_amounts.split(",").map((x) => x.trim()).filter(Boolean),
          show_member_count: s2.show_member_count, show_collected: s2.show_collected,
          generate_cards: s2.generate_cards,
          max_members: s2.max_members ? Number(s2.max_members) : null,
        };
        await updateCampaignAction(orgSlug, savedCampaignId, patch);
        for (const [i, t] of s2.tiers.entries()) {
          if (!t.name.trim()) continue;
          const tInput = { campaign_id: savedCampaignId, organization_id: orgId, name: t.name.trim(), description: t.description.trim() || null, amount: Number(t.amount) || 0, sort_order: i };
          if (t.id) { await updateTierAction(orgSlug, t.id, tInput); }
          else { await createTierAction(orgSlug, tInput); }
        }
      }
      setStep(2);
    });
  }

  function finish() { toast.success(campaign ? "Campagne mise à jour" : "Campagne créée"); onSaved(); onClose(); }

  return (
    <div className="mc-modal-ov" role="presentation" onClick={() => !pending && onClose()}>
      <div className="mc-modal" style={{ maxWidth: 680 }} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-foreground">{campaign ? "Modifier la campagne" : "Nouvelle campagne"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>

        {/* Wizard steps */}
        <div className="mc-wizard-steps mb-6">
          {steps.map((label, i) => (
            <div key={i} className={`mc-wizard-step ${i === step ? "active" : i < step ? "done" : ""}`}>
              <span className="mc-wizard-num">{i < step ? <Check className="size-3" /> : i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>

        {/* Step 1: Infos générales */}
        {step === 0 && (
          <div className="flex flex-col gap-3.5">
            <div className="mc-form-group"><label className="mc-form-label">Titre *</label>
              <input className="mc-input" value={s1.title} autoFocus
                onChange={(e) => handleTitleChange(e.target.value)} placeholder="Bulletin d'adhésion 2026" /></div>
            <div className="mc-form-group"><label className="mc-form-label">Adresse web (slug) *</label>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-warmgray">/adhesion/</span>
                <input className="mc-input flex-1" value={s1.slug}
                  onChange={(e) => set1("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
              </div></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="mc-form-group"><label className="mc-form-label">Statut</label>
                <select className="mc-input" value={s1.status} onChange={(e) => set1("status", e.target.value as MembershipCampaign["status"])}>
                  {CAMPAIGN_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select></div>
              <div className="mc-form-group"><label className="mc-form-label">Période</label>
                <select className="mc-input" value={s1.period_type} onChange={(e) => set1("period_type", e.target.value as MembershipCampaign["period_type"])}>
                  {PERIOD_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label.split(" (")[0]}</option>)}
                </select></div>
            </div>
            {s1.period_type === "personnalisee" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="mc-form-group"><label className="mc-form-label">Début</label>
                  <input className="mc-input" type="date" value={s1.period_start} onChange={(e) => set1("period_start", e.target.value)} /></div>
                <div className="mc-form-group"><label className="mc-form-label">Fin</label>
                  <input className="mc-input" type="date" value={s1.period_end} onChange={(e) => set1("period_end", e.target.value)} /></div>
              </div>
            )}
            <div className="mc-form-group"><label className="mc-form-label">Description</label>
              <textarea className="mc-textarea" value={s1.description} onChange={(e) => set1("description", e.target.value)} placeholder="Présentez votre campagne aux futurs adhérents…" /></div>
            {s1Error ? <p className="text-sm font-medium text-coral-dark">{s1Error}</p> : null}
          </div>
        )}

        {/* Step 2: Montants & paramètres */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Formules</h3>
                <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={addTier}><Plus className="size-3.5" /> Ajouter</button>
              </div>
              {s2.tiers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-peach px-6 py-8 text-center text-[13px] text-warmgray">Aucune formule — ajoutez-en avec le bouton ci-dessus.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {s2.tiers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-light p-3">
                      <input className="mc-input flex-1" value={t.name} onChange={(e) => setTier(i, "name", e.target.value)} placeholder="Nom de la formule" />
                      <input className="mc-input w-24" inputMode="decimal" value={t.amount} onChange={(e) => setTier(i, "amount", e.target.value)} placeholder="€" />
                      <button type="button" onClick={() => removeTier(i)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-gray-light p-4 flex flex-col gap-3">
              <h3 className="text-sm font-bold text-foreground">Paramètres</h3>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" checked={s2.allow_donation} onChange={(e) => set2("allow_donation", e.target.checked)} className="size-4 accent-[var(--coral)]" />
                Permettre aux adhérents de faire un don supplémentaire
              </label>
              {s2.allow_donation && (
                <div className="mc-form-group ml-6"><label className="mc-form-label">Montants suggérés (séparés par des virgules)</label>
                  <input className="mc-input" value={s2.donation_amounts} onChange={(e) => set2("donation_amounts", e.target.value)} placeholder="30, 50, 100" /></div>
              )}
              <div className="mc-form-group"><label className="mc-form-label">Nb max d&apos;adhérents (vide = illimité)</label>
                <input className="mc-input" inputMode="numeric" value={s2.max_members} onChange={(e) => set2("max_members", e.target.value)} placeholder="ex. 100" /></div>
              <div className="flex flex-col gap-2">
                {([["show_member_count","Afficher le nombre d'adhérents"],["show_collected","Afficher le montant collecté"],["generate_cards","Générer des cartes d'adhésion"]] as const).map(([k, label]) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input type="checkbox" checked={s2[k] as boolean} onChange={(e) => set2(k, e.target.checked)} className="size-4 accent-[var(--coral)]" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Résumé */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-white p-5">
              <div className="font-bold text-foreground">{s1.title}</div>
              <div className="mt-1 flex gap-2"><span className={`mc-badge ${campaignStatusBadge(s1.status)}`}>{campaignStatusLabel(s1.status)}</span></div>
              <div className="mt-3 text-[13px] text-warmgray">{PERIOD_TYPES.find((p) => p.value === s1.period_type)?.label}</div>
              {s1.period_type === "personnalisee" && s1.period_start ? (
                <div className="text-[12px] text-warmgray">{formatDate(s1.period_start)} → {formatDate(s1.period_end)}</div>
              ) : null}
            </div>
            {s2.tiers.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warmgray">Formules</div>
                {s2.tiers.filter((t) => t.name.trim()).map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 mb-1.5">
                    <span className="font-medium">{t.name}</span>
                    <span className="font-bold text-coral-dark">{formatAmount(Number(t.amount) || 0)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl bg-white p-4 text-[13px] text-warmgray space-y-1">
              {s2.allow_donation ? <div>✓ Don supplémentaire autorisé</div> : null}
              {s2.generate_cards ? <div>✓ Cartes d&apos;adhésion générées</div> : null}
              {s2.show_member_count ? <div>✓ Compteur public actif</div> : null}
            </div>
            <p className="text-[12px] text-warmgray">La campagne est prête. Le tunnel public sera disponible sur le site du lieu.</p>
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2.5">
          <div>{step > 0 ? <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => setStep((s) => s - 1)} disabled={pending}><ChevronLeft className="size-4" /> Précédent</button> : null}</div>
          <div className="flex gap-2.5">
            <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={onClose} disabled={pending}>Annuler</button>
            {step < 2 ? (
              <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" disabled={pending}
                onClick={step === 0 ? saveStep1 : step === 1 ? saveStep2 : undefined}>
                {pending ? "…" : <>Suivant <ChevronRight className="size-4" /></>}
              </button>
            ) : (
              <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={finish} disabled={pending}><Check className="size-4" /> Terminer</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drawer administration d'une campagne ────────────────────
function CampaignAdmin({ campaign, tiers, applications, orgSlug, onClose }: {
  campaign: MembershipCampaign; tiers: MembershipTier[];
  applications: MembershipApplication[]; orgSlug: string; onClose: () => void;
}) {
  const [pending, startT] = useTransition();
  const tierMap = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const total = applications.reduce((s, a) => s + Number(a.amount_paid) + Number(a.donation_amount ?? 0), 0);

  function quickStatus(id: string, status: MembershipApplication["status"]) {
    startT(async () => {
      const patch: Partial<typeof applications[0]> = { status };
      if (status === "confirmee") {
        const today = new Date().toISOString().slice(0, 10);
        patch.membership_start = today;
        if (campaign.period_type === "annee_glissante") {
          const end = new Date(); end.setFullYear(end.getFullYear() + 1);
          patch.membership_end = end.toISOString().slice(0, 10);
        } else if (campaign.period_type === "personnalisee") {
          patch.membership_end = campaign.period_end;
        }
      }
      const r = await updateApplicationAction(orgSlug, id, patch as Parameters<typeof updateApplicationAction>[2]);
      if (r.ok) toast.success(`Adhésion ${status === "confirmee" ? "confirmée" : "annulée"}`);
      else toast.error("Erreur.");
    });
  }

  return (
    <>
      <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={onClose} />
      <aside className="mc-drawer" aria-label="Administration campagne">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">{campaign.title}</h2>
            <div className="mt-1 flex gap-1.5">
              <span className={`mc-badge ${campaignStatusBadge(campaign.status)}`}>{campaignStatusLabel(campaign.status)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto p-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="mc-stat"><div className="mc-stat-val">{applications.length}</div><div className="mc-stat-lbl">Total</div></div>
            <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{applications.filter((a) => a.status === "confirmee").length}</div><div className="mc-stat-lbl">Confirmées</div></div>
            <div className="mc-stat"><div className="mc-stat-val" style={{ color: "var(--coral-dark)" }}>{formatAmount(total)}</div><div className="mc-stat-lbl">Collecté</div></div>
          </div>
          {/* Applications */}
          {applications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-peach px-6 py-8 text-center text-[13px] text-warmgray">Aucune souscription pour le moment.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {applications.map((a) => (
                <div key={a.id} className="rounded-xl bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-foreground">{a.first_name} {a.last_name}</div>
                      <div className="text-[12px] text-warmgray">{tierMap.get(a.tier_id ?? "")?.name ?? "—"} · {formatAmount(a.amount_paid)}{a.donation_amount ? ` + don ${formatAmount(a.donation_amount)}` : ""}</div>
                      {a.email ? <div className="text-[12px] text-warmgray">{a.email}</div> : null}
                      {a.membership_start ? <div className="text-[11px] text-warmgray">{formatDate(a.membership_start)} → {formatDate(a.membership_end)}</div> : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`mc-badge ${appStatusBadge(a.status)}`}>{appStatusLabel(a.status)}</span>
                      {a.status === "en_attente" ? (
                        <div className="flex gap-1 mt-1">
                          <button type="button" disabled={pending} onClick={() => quickStatus(a.id, "confirmee")} className="mc-btn mc-btn-outline mc-btn-sm py-0.5 px-2 text-[11px]"><Check className="size-3" /> OK</button>
                          <button type="button" disabled={pending} onClick={() => quickStatus(a.id, "annulee")} className="mc-btn mc-btn-outline mc-btn-sm py-0.5 px-2 text-[11px]"><Ban className="size-3" /></button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Vue principale ───────────────────────────────────────────
export function AdhesionsView({ campaigns, tiersMap, applicationsMap, orgSlug, orgId }: {
  campaigns: MembershipCampaign[];
  tiersMap: Record<string, MembershipTier[]>;
  applicationsMap: Record<string, MembershipApplication[]>;
  orgSlug: string; orgId: string;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MembershipCampaign | null>(null);
  const [adminCampaign, setAdminCampaign] = useState<MembershipCampaign | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MembershipCampaign | null>(null);
  const [pending, startT] = useTransition();

  const kpis = useMemo(() => {
    const allApps = Object.values(applicationsMap).flat();
    return {
      campaigns: campaigns.length,
      actives: campaigns.filter((c) => c.status === "publie").length,
      adherents: allApps.filter((a) => a.status === "confirmee").length,
      collecte: allApps.reduce((s, a) => s + Number(a.amount_paid) + Number(a.donation_amount ?? 0), 0),
    };
  }, [campaigns, applicationsMap]);

  function doDelete(c: MembershipCampaign) {
    startT(async () => {
      const { ok } = await deleteCampaignAction(orgSlug, c.id);
      if (ok) { toast.success("Campagne supprimée"); setConfirmDelete(null); }
      else toast.error("Suppression impossible.");
    });
  }
  async function toggleStatus(c: MembershipCampaign) {
    const next = c.status === "publie" ? "brouillon" : "publie";
    startT(async () => {
      const { ok } = await updateCampaignAction(orgSlug, c.id, { status: next });
      if (ok) toast.success(next === "publie" ? "Campagne publiée" : "Campagne dépubliée");
      else toast.error("Erreur.");
    });
  }

  if (campaigns.length === 0 && !wizardOpen) return (
    <>
      <div className="mc-card"><div className="mc-empty">
        <span className="mc-empty-ic"><Users className="size-6" strokeWidth={1.8} /></span>
        <div className="mc-empty-title">Aucune campagne d&apos;adhésion</div>
        <p className="mc-empty-sub">Créez votre premier bulletin d&apos;adhésion avec formules et période de validité.</p>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditingCampaign(null); setWizardOpen(true); }}><Plus className="size-3.5" /> Créer une campagne</button>
      </div></div>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.campaigns}</div><div className="mc-stat-lbl">Campagnes</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.actives}</div><div className="mc-stat-lbl">Publiques</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#0a6b78" }}>{kpis.adherents}</div><div className="mc-stat-lbl">Adhérents confirmés</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "var(--coral-dark)" }}>{formatAmount(kpis.collecte)}</div><div className="mc-stat-lbl">Collecté total</div></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Mes campagnes</h3>
        <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditingCampaign(null); setWizardOpen(true); }}><Plus className="size-3.5" /> Créer une campagne</button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => {
          const apps = applicationsMap[c.id] ?? [];
          const confirmed = apps.filter((a) => a.status === "confirmee").length;
          const collected = apps.reduce((s, a) => s + Number(a.amount_paid) + Number(a.donation_amount ?? 0), 0);
          const cover = c.photos?.[0];
          return (
            <div key={c.id} className="mc-campaign-card">
              <div className="mc-campaign-cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} />
              <div className="mc-campaign-body">
                <div className="flex items-start justify-between gap-2">
                  <div className="mc-campaign-title">{c.title}</div>
                  <span className={`mc-badge ${campaignStatusBadge(c.status)} flex-none`}>{campaignStatusLabel(c.status)}</span>
                </div>
                {c.period_type === "personnalisee" && c.period_start ? (
                  <div className="text-[12px] text-warmgray">{formatDate(c.period_start)} → {formatDate(c.period_end)}</div>
                ) : null}
                <div className="mc-campaign-stats">
                  <div><div className="mc-campaign-stat-val">{confirmed}</div><div className="text-[11px]">adhérents</div></div>
                  <div><div className="mc-campaign-stat-val">{formatAmount(collected)}</div><div className="text-[11px]">collectés</div></div>
                </div>
              </div>
              <div className="mc-campaign-actions">
                <button type="button" className="mc-btn mc-btn-lime flex-1 mc-btn-sm" onClick={() => setAdminCampaign(c)}>Administrer <ArrowRight className="size-3.5" /></button>
                <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" disabled={pending} onClick={() => toggleStatus(c)}>{c.status === "publie" ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => { setEditingCampaign(c); setWizardOpen(true); }}><Pencil className="size-4" /></button>
                <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => setConfirmDelete(c)}><Trash2 className="size-4" /></button>
                {c.status === "publie" ? (
                  <a href={`/site/${orgSlug}/adhesion/${c.slug}`} target="_blank" rel="noopener noreferrer" className="mc-btn mc-btn-outline mc-btn-sm"><ExternalLink className="size-4" /></a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {wizardOpen ? (
        <CampaignWizard campaign={editingCampaign} orgId={orgId} orgSlug={orgSlug}
          onClose={() => { setWizardOpen(false); setEditingCampaign(null); }}
          onSaved={() => { setWizardOpen(false); setEditingCampaign(null); }} />
      ) : null}

      {adminCampaign ? (
        <CampaignAdmin
          campaign={adminCampaign}
          tiers={tiersMap[adminCampaign.id] ?? []}
          applications={applicationsMap[adminCampaign.id] ?? []}
          orgSlug={orgSlug}
          onClose={() => setAdminCampaign(null)} />
      ) : null}

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cette campagne ?"
        message={confirmDelete ? `« ${confirmDelete.title} » et toutes ses souscriptions seront supprimées.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
