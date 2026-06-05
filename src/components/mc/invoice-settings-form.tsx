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
}: {
  settings: InvoiceSettings;
  orgId: string;
  orgSlug: string;
  orgName: string;
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
