"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, CreditCard, Heart, Users } from "lucide-react";
import type { MembershipCampaign, MembershipTier } from "@/lib/types";
import { formatAmount, PERIOD_TYPES } from "@/lib/adhesions-meta";

const inputClass =
  "w-full rounded-lg border border-input bg-cream px-3 py-2 text-sm outline-none focus:border-coral";

interface AdherentForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export function AdhesionTunnel({
  slug,
  campaign,
  tiers,
  stripeEnabled = false,
}: {
  slug: string;
  campaign: MembershipCampaign;
  tiers: MembershipTier[];
  stripeEnabled?: boolean;
}) {
  const SESSION_KEY = `adhesion-${campaign.id}`;
  const steps = ["Formule", "Adhérent", "Coordonnées", "Récapitulatif"];
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [payOnline, setPayOnline] = useState(true);
  const restoredRef = useRef(false);

  const [tierId, setTierId] = useState<string | null>(tiers[0]?.id ?? null);
  const [donation, setDonation] = useState<number>(0);
  const [donationCustom, setDonationCustom] = useState("");

  const [adherent, setAdherent] = useState<AdherentForm>({
    first_name: "", last_name: "", email: "", phone: "",
  });
  const [payerSame, setPayerSame] = useState(true);
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");

  // UX-028 — Restore from sessionStorage on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.step === "number" && s.step > 0) setStep(s.step);
      if (typeof s.tierId === "string") setTierId(s.tierId);
      if (s.adherent && typeof s.adherent === "object") setAdherent(s.adherent as AdherentForm);
      if (typeof s.payerSame === "boolean") setPayerSame(s.payerSame);
      if (typeof s.payerName === "string") setPayerName(s.payerName);
      if (typeof s.payerEmail === "string") setPayerEmail(s.payerEmail);
      if (typeof s.donation === "number") setDonation(s.donation);
      if (typeof s.donationCustom === "string") setDonationCustom(s.donationCustom);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistSession(patch: Record<string, unknown>) {
    try {
      const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "{}");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, ...patch }));
    } catch {}
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }

  const selectedTier = tiers.find((t) => t.id === tierId) ?? null;
  const donationAmounts = campaign.donation_amounts ?? [];
  const effectiveDonation = donationCustom ? Number(donationCustom) || 0 : donation;
  const total = (selectedTier ? Number(selectedTier.amount) : 0) + effectiveDonation;

  function set<K extends keyof AdherentForm>(k: K, v: string) {
    setAdherent((p) => ({ ...p, [k]: v }));
  }

  // UX-027 — scroll-to-top on step change
  function scrollTop() { window.scrollTo({ top: 0, behavior: "smooth" }); }

  function nextFromTier() {
    if (!tierId) { toast.error("Choisissez une formule."); return; }
    persistSession({ step: 1, tierId, donation, donationCustom });
    scrollTop();
    setStep(1);
  }
  function nextFromAdherent() {
    if (!adherent.first_name.trim() || !adherent.last_name.trim()) {
      toast.error("Prénom et nom sont requis."); return;
    }
    if (!/.+@.+\..+/.test(adherent.email)) { toast.error("Email invalide."); return; }
    persistSession({ step: 2, adherent });
    scrollTop();
    setStep(2);
  }
  function nextFromPayer() {
    if (!payerSame) {
      if (!payerName.trim()) { toast.error("Nom du payeur requis."); return; }
      if (!/.+@.+\..+/.test(payerEmail)) { toast.error("Email du payeur invalide."); return; }
    }
    persistSession({ step: 3, payerSame, payerName, payerEmail });
    scrollTop();
    setStep(3);
  }

  async function submit() {
    if (!selectedTier) { toast.error("Choisissez une formule."); return; }
    setLoading(true);
    try {
      const payload = {
        tier_id: selectedTier.id,
        first_name: adherent.first_name.trim(),
        last_name: adherent.last_name.trim(),
        email: adherent.email.trim(),
        phone: adherent.phone.trim() || null,
        payer_name: payerSame ? `${adherent.first_name.trim()} ${adherent.last_name.trim()}` : payerName.trim(),
        payer_email: payerSame ? adherent.email.trim() : payerEmail.trim(),
        donation_amount: effectiveDonation > 0 ? effectiveDonation : null,
        online: stripeEnabled && payOnline && total > 0,
      };
      const res = await fetch(`/api/orgs/${slug}/adhesions/${campaign.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error ?? "Envoi impossible. Réessayez."); return; }
      clearSession();
      if (data.redirectUrl) { window.location.href = data.redirectUrl; return; }
      setDone(true);
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-[0_4px_20px_rgba(255,138,101,0.07)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint/15 text-[#15803d]">
          <Check className="size-7" strokeWidth={2.2} />
        </span>
        <h2 className="mt-4 font-heading text-2xl font-bold">Adhésion enregistrée — merci&nbsp;!</h2>
        <p className="mt-2 text-muted-foreground">
          Votre demande d&apos;adhésion à «&nbsp;{campaign.title}&nbsp;» a bien été reçue.
          L&apos;équipe la validera et vous recontactera à l&apos;adresse {adherent.email}.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cream px-4 py-2.5 text-sm font-semibold">
          <span className="text-muted-foreground">Montant</span>
          <span className="text-coral-dark">{formatAmount(total)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_4px_20px_rgba(255,138,101,0.07)] sm:p-8">
      {/* Steps */}
      <div className="mc-wizard-steps mb-6">
        {steps.map((label, i) => (
          <div key={i} className={`mc-wizard-step ${i === step ? "active" : i < step ? "done" : ""}`}>
            <span className="mc-wizard-num">{i < step ? <Check className="size-3" /> : i + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {/* Step 0 — Formule + don */}
      {step === 0 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-heading text-xl font-bold">Choisissez votre formule</h2>
            {campaign.description ? <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p> : null}
          </div>
          {tiers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-peach px-6 py-8 text-center text-sm text-muted-foreground">
              Aucune formule disponible pour cette campagne.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {tiers.map((t) => (
                <button
                  type="button" key={t.id} onClick={() => setTierId(t.id)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                    tierId === t.id ? "border-coral bg-peach-pale" : "border-input bg-cream hover:border-peach"
                  }`}
                >
                  <span>
                    <span className="block font-semibold text-foreground">{t.name}</span>
                    {t.description ? <span className="block text-[12px] text-muted-foreground">{t.description}</span> : null}
                  </span>
                  <span className="flex-none font-bold text-coral-dark">{formatAmount(Number(t.amount))}</span>
                </button>
              ))}
            </div>
          )}

          {/* UX-029 — Don : grille 3 col + champ libre sur sa propre ligne */}
          {campaign.allow_donation && (
            <div className="rounded-xl bg-cream p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Heart className="size-4 text-coral-dark" /> Ajouter un don de soutien
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {donationAmounts.map((a) => {
                  const val = Number(a);
                  const active = !donationCustom && donation === val;
                  return (
                    <button type="button" key={a} onClick={() => { setDonation(val); setDonationCustom(""); }}
                      className={`rounded-lg border py-3 text-sm font-semibold transition-colors ${
                        active ? "border-coral bg-coral text-white" : "border-input bg-white hover:border-peach"
                      }`}>
                      {formatAmount(val)}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  inputMode="decimal" value={donationCustom}
                  onChange={(e) => { setDonationCustom(e.target.value); setDonation(0); }}
                  placeholder="Montant libre €" className={`${inputClass} flex-1`} />
                {(donation > 0 || donationCustom) ? (
                  <button type="button" onClick={() => { setDonation(0); setDonationCustom(""); }}
                    className="shrink-0 text-sm font-medium text-muted-foreground hover:text-coral-dark">
                    Retirer
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1 — Adhérent */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-bold">Vos informations</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input value={adherent.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Prénom *" className={inputClass} autoFocus />
            <input value={adherent.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Nom *" className={inputClass} />
            <input type="email" value={adherent.email} onChange={(e) => set("email", e.target.value)} placeholder="Email *" className={inputClass} />
            <input value={adherent.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Téléphone" className={inputClass} />
          </div>
        </div>
      )}

      {/* Step 2 — Coordonnées payeur */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-bold">Coordonnées du payeur</h2>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={payerSame} onChange={(e) => setPayerSame(e.target.checked)} className="size-4 accent-[var(--coral)]" />
            Je suis l&apos;adhérent·e (mêmes coordonnées)
          </label>
          {!payerSame && (
            <div className="grid gap-4 sm:grid-cols-2">
              <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Nom du payeur *" className={inputClass} autoFocus />
              <input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} placeholder="Email du payeur *" className={inputClass} />
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Récapitulatif */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-bold">Récapitulatif</h2>
          <div className="rounded-xl bg-cream p-5">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedTier?.name}</span>
              <span className="font-bold text-coral-dark">{formatAmount(Number(selectedTier?.amount ?? 0))}</span>
            </div>
            {effectiveDonation > 0 ? (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Don de soutien</span>
                <span className="font-semibold text-coral-dark">{formatAmount(effectiveDonation)}</span>
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="font-bold">Total</span>
              <span className="font-heading text-lg font-extrabold text-coral-dark">{formatAmount(total)}</span>
            </div>
          </div>
          <div className="rounded-xl bg-cream p-5 text-sm">
            <div className="font-semibold">{adherent.first_name} {adherent.last_name}</div>
            <div className="text-muted-foreground">{adherent.email}{adherent.phone ? ` · ${adherent.phone}` : ""}</div>
            {!payerSame ? <div className="mt-1 text-muted-foreground">Payeur : {payerName} ({payerEmail})</div> : null}
          </div>
          {stripeEnabled && total > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mode de paiement</p>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${payOnline ? "border-coral bg-peach-pale" : "border-input bg-cream hover:border-peach"}`}>
                <input type="radio" name="payMode" checked={payOnline} onChange={() => setPayOnline(true)} className="accent-[var(--coral)]" />
                <CreditCard className="size-4 shrink-0 text-coral-dark" />
                <span className="text-sm font-semibold">Payer par carte maintenant</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${!payOnline ? "border-coral bg-peach-pale" : "border-input bg-cream hover:border-peach"}`}>
                <input type="radio" name="payMode" checked={!payOnline} onChange={() => setPayOnline(false)} className="accent-[var(--coral)]" />
                <span className="text-sm">Payer plus tard (virement / chèque)</span>
              </label>
            </div>
          )}
          <p className="text-[12px] text-muted-foreground">
            Validité : {PERIOD_TYPES.find((p) => p.value === campaign.period_type)?.label}.
            {stripeEnabled && total > 0 && payOnline
              ? " Vous serez redirigé·e vers le paiement sécurisé Stripe."
              : " Votre adhésion sera confirmée par l'équipe après réception du règlement."}
          </p>
        </div>
      )}

      {/* Nav — UX-005: total provisoire en step 0 */}
      <div className="mt-7 flex items-center justify-between gap-3">
        <div>
          {step > 0 ? (
            <button type="button" onClick={() => { scrollTop(); setStep((s) => s - 1); }} disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-input px-4 py-2.5 text-sm font-semibold hover:border-peach disabled:opacity-60">
              <ChevronLeft className="size-4" /> Retour
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" /> {tiers.length} formule{tiers.length > 1 ? "s" : ""}
              {selectedTier ? (
                <span className="ml-2 font-semibold text-coral-dark">
                  {formatAmount(total)}
                </span>
              ) : null}
            </span>
          )}
        </div>
        {step < 3 ? (
          <button type="button" disabled={loading || tiers.length === 0}
            onClick={step === 0 ? nextFromTier : step === 1 ? nextFromAdherent : nextFromPayer}
            className="inline-flex items-center gap-1 rounded-lg bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-dark disabled:opacity-60">
            Continuer <ChevronRight className="size-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-dark disabled:opacity-60">
            <Check className="size-4" /> {loading ? "Envoi…" : `Valider — ${formatAmount(total)}`}
          </button>
        )}
      </div>
    </div>
  );
}
