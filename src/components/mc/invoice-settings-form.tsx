"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import type { InvoiceSettings } from "@/lib/invoicing/types";
import { saveInvoiceSettings } from "@/app/(admin)/dashboard/[org]/factures/actions";

const input =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <h3 className="mb-4 font-heading text-base font-bold text-ink">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function InvoiceSettingsForm({
  settings,
  orgId,
  orgSlug,
  orgName,
  hasEmittedInvoices = false,
}: {
  settings: InvoiceSettings;
  orgId: string;
  orgSlug: string;
  orgName: string;
  hasEmittedInvoices?: boolean;
}) {
  const [s, setS] = useState<InvoiceSettings>({
    ...settings,
    issuer_name: settings.issuer_name ?? orgName,
  });
  const [pending, startTransition] = useTransition();

  function field<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) {
    setS((cur) => ({ ...cur, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const res = await saveInvoiceSettings(orgId, orgSlug, s);
      if (res.ok) toast.success("Paramètres enregistrés ✓");
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Section title="Identité de l'émetteur">
        <div className="sm:col-span-2">
          <label className={labelCls}>Nom de la structure *</label>
          <input className={input} value={s.issuer_name ?? ""} onChange={(e) => field("issuer_name", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Adresse</label>
          <input className={input} value={s.issuer_address ?? ""} onChange={(e) => field("issuer_address", e.target.value)} placeholder="12 rue des Halles, 75001 Paris" />
        </div>
        <div>
          <label className={labelCls}>SIRET</label>
          <input className={input} value={s.siret ?? ""} onChange={(e) => field("siret", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>N° TVA intracommunautaire</label>
          <input className={input} value={s.vat_number ?? ""} onChange={(e) => field("vat_number", e.target.value)} placeholder="FR12345678901 (si assujetti)" />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input className={input} value={s.email ?? ""} onChange={(e) => field("email", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Téléphone</label>
          <input className={input} value={s.phone ?? ""} onChange={(e) => field("phone", e.target.value)} />
        </div>
      </Section>

      <Section title="Coordonnées de paiement">
        <div>
          <label className={labelCls}>IBAN</label>
          <input className={input} value={s.iban ?? ""} onChange={(e) => field("iban", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>BIC</label>
          <input className={input} value={s.bic ?? ""} onChange={(e) => field("bic", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Délai de paiement (jours)</label>
          <input type="number" className={input} value={s.payment_terms_days} onChange={(e) => field("payment_terms_days", Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className={labelCls}>Pénalités de retard</label>
          <input className={input} value={s.late_penalty ?? ""} onChange={(e) => field("late_penalty", e.target.value)} placeholder="3× le taux légal" />
        </div>
        <div>
          <label className={labelCls}>Validation direction au-dessus de (€)</label>
          <input type="number" min={0} step="0.01" className={input}
            value={s.require_validation_above ?? ""}
            onChange={(e) => field("require_validation_above", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="Vide = désactivé" />
          <p className="mt-1 text-[11px] text-warmgray">Au-dessus de ce montant, une facture naît « à valider » par la direction. Laissez vide pour désactiver.</p>
        </div>
      </Section>

      <Section title="Apparence & mentions">
        <div>
          <label className={labelCls}>Préfixe de numérotation</label>
          <input className={input} value={s.number_prefix} onChange={(e) => field("number_prefix", e.target.value)} placeholder="FAC-" />
        </div>
        <div>
          <label className={labelCls}>Première facture n°</label>
          <input
            type="number" min={1} step={1}
            className={`${input} ${hasEmittedInvoices ? "opacity-50 cursor-not-allowed" : ""}`}
            value={s.number_start ?? 1}
            onChange={(e) => { if (!hasEmittedInvoices) field("number_start", Number(e.target.value) || 1); }}
            disabled={hasEmittedInvoices}
          />
          <p className="mt-1 text-[11px] text-warmgray">
            {hasEmittedInvoices
              ? "Verrouillé : une facture a déjà été émise (intégrité légale)."
              : "Numéro de départ si vous avez déjà des factures existantes (ex. 47 → FAC-000047)."}
          </p>
        </div>
        <div>
          <label className={labelCls}>Couleur d'accent</label>
          <div className="flex items-center gap-2">
            <input type="color" value={s.accent_color} onChange={(e) => field("accent_color", e.target.value)} className="size-10 cursor-pointer rounded-lg border border-border" />
            <input className={input} value={s.accent_color} onChange={(e) => field("accent_color", e.target.value)} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Mentions de pied de page</label>
          <textarea className={`${input} min-h-[70px] resize-y`} value={s.footer_mentions ?? ""} onChange={(e) => field("footer_mentions", e.target.value)} placeholder="Association loi 1901 · Dispensé d'immatriculation au RCS…" />
        </div>
      </Section>

      <Section title="Reçus fiscaux (dons)">
        <div>
          <label className={labelCls}>Qualité de l&apos;association</label>
          <input className={input} value={s.tax_receipt_quality ?? ""} onChange={(e) => field("tax_receipt_quality", e.target.value)} placeholder="association d'intérêt général à caractère culturel" />
          <p className="mt-1 text-[11px] text-warmgray">Mention portée sur le reçu Cerfa.</p>
        </div>
        <div>
          <label className={labelCls}>Signataire des reçus</label>
          <input className={input} value={s.tax_receipt_signatory ?? ""} onChange={(e) => field("tax_receipt_signatory", e.target.value)} placeholder="Jeanne Dupont, présidente" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Référence du rescrit fiscal (recommandé)</label>
          <input className={input} value={s.tax_receipt_rescrit_ref ?? ""} onChange={(e) => field("tax_receipt_rescrit_ref", e.target.value)} placeholder="Rescrit DGFiP du 12/03/2025, réf. 2025-XXX (facultatif)" />
          <p className="mt-1 text-[11px] text-warmgray">
            Le rescrit (art. L.80 C LPF) est la confirmation écrite de l&apos;administration fiscale que votre
            association peut émettre des reçus. Facultatif, mais il vous protège en cas de contrôle.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <input
              type="checkbox"
              checked={s.tax_receipt_eligible}
              onChange={(e) => field("tax_receipt_eligible", e.target.checked)}
              className="mt-0.5 size-4 accent-coral"
            />
            <span className="text-[13px] leading-relaxed text-amber-900">
              <strong>Déclaration sur l&apos;honneur</strong> — Je confirme que l&apos;association est
              d&apos;intérêt général au sens de l&apos;article 200 du CGI : gestion désintéressée, activité
              non lucrative, et qu&apos;elle ne fonctionne pas au profit d&apos;un cercle restreint de personnes.
              <br />
              <span className="text-[11px] text-amber-700">
                Émettre un reçu sans y être éligible expose l&apos;association à une amende de 60 à 75 % des
                montants mentionnés (art. 1740 A CGI). En cas de doute, demandez un rescrit fiscal.
              </span>
            </span>
          </label>
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={pending || !s.issuer_name}
          className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-dark disabled:opacity-50"
        >
          <Save className="size-4" /> {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
