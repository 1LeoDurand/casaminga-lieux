"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { SaInvoiceSettings } from "@/lib/superadmin-billing/types";
import { saveSaSettings } from "../actions";

export function ParametresForm({ settings }: { settings: SaInvoiceSettings }) {
  const [s, setS] = useState(settings);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field<K extends keyof SaInvoiceSettings>(k: K, v: SaInvoiceSettings[K]) {
    setS((x) => ({ ...x, [k]: v }));
    setSaved(false);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveSaSettings({
        issuer_name: s.issuer_name,
        issuer_address: s.issuer_address,
        siret: s.siret,
        email: s.email,
        phone: s.phone,
        iban: s.iban,
        bic: s.bic,
        bank_name: s.bank_name,
        payment_terms_days: s.payment_terms_days,
        number_prefix: s.number_prefix,
        number_start: s.number_start,
        vat_applicable: s.vat_applicable,
        footer_mentions: s.footer_mentions,
      });
      if (!res.ok) setError(res.error ?? "Erreur");
      else setSaved(true);
    });
  }

  const txt = (k: keyof SaInvoiceSettings, label: string, ph = "") => (
    <div className="mc-form-group">
      <label className="mc-form-label">{label}</label>
      <input className="mc-input" value={(s[k] as string) ?? ""} placeholder={ph} onChange={(e) => field(k, e.target.value as never)} />
    </div>
  );

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="rounded-xl border border-[#E5DDD6] bg-white p-5">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-warmgray">Émetteur</p>
        <div className="flex flex-col gap-3.5">
          {txt("issuer_name", "Nom / raison sociale")}
          {txt("issuer_address", "Adresse")}
          <div className="grid grid-cols-2 gap-3">
            {txt("siret", "SIRET")}
            {txt("phone", "Téléphone")}
          </div>
          {txt("email", "Email")}
        </div>
      </div>

      <div className="rounded-xl border border-[#E5DDD6] bg-white p-5">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-warmgray">Coordonnées bancaires</p>
        <div className="flex flex-col gap-3.5">
          {txt("bank_name", "Banque")}
          {txt("iban", "IBAN")}
          {txt("bic", "BIC")}
        </div>
      </div>

      <div className="rounded-xl border border-[#E5DDD6] bg-white p-5">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-warmgray">Numérotation & mentions</p>
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-3 gap-3">
            <div className="mc-form-group">
              <label className="mc-form-label">Préfixe n°</label>
              <input className="mc-input" value={s.number_prefix} onChange={(e) => field("number_prefix", e.target.value)} />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">N° de départ</label>
              <input className="mc-input" type="number" min="1" value={s.number_start} onChange={(e) => field("number_start", Number(e.target.value))} />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Délai paiement (j)</label>
              <input className="mc-input" type="number" min="0" value={s.payment_terms_days} onChange={(e) => field("payment_terms_days", Number(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-warmgray">Format : <code>{s.number_prefix}{String(new Date().getFullYear()).slice(-2)}-0001</code></p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.vat_applicable} onChange={(e) => field("vat_applicable", e.target.checked)} />
            Assujetti à la TVA (décochez si micro-entreprise franchise en base)
          </label>
          <div className="mc-form-group">
            <label className="mc-form-label">Mentions de pied de page</label>
            <textarea className="mc-textarea" rows={2} value={s.footer_mentions ?? ""} onChange={(e) => field("footer_mentions", e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-coral-dark">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" className="mc-btn mc-btn-coral mc-btn-sm" onClick={save} disabled={pending}>{pending ? "…" : "Enregistrer"}</button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="size-4" /> Enregistré</span>}
      </div>
    </div>
  );
}
