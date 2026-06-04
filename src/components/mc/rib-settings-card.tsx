"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, CreditCard } from "lucide-react";
import type { InvoiceSettings } from "@/lib/invoicing/types";
import { saveInvoiceSettings } from "@/app/(admin)/dashboard/[org]/factures/actions";

const inputCls =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15 font-mono";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

export function RibSettingsCard({
  settings,
  orgId,
  orgSlug,
}: {
  settings: Pick<InvoiceSettings, "organization_id" | "iban" | "bic">;
  orgId: string;
  orgSlug: string;
}) {
  const [iban, setIban] = useState(settings.iban ?? "");
  const [bic, setBic] = useState(settings.bic ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveInvoiceSettings(orgId, orgSlug, { iban: iban || null, bic: bic || null });
      if (res.ok) toast.success("RIB enregistré ✓");
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="mc-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <CreditCard className="size-4 text-coral" />
        <h3 className="font-heading text-base font-bold text-foreground">Coordonnées bancaires (RIB)</h3>
      </div>
      <p className="mb-4 text-[12.5px] text-warmgray">
        Ces informations apparaissent automatiquement sur chaque facture émise.
      </p>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelCls}>IBAN</label>
          <input
            className={inputCls}
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="FR76 3000 6000 0112 3456 7890 189"
            maxLength={42}
          />
        </div>
        <div>
          <label className={labelCls}>BIC / SWIFT</label>
          <input
            className={inputCls}
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            placeholder="BNPAFRPP"
            maxLength={11}
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-coral-dark disabled:opacity-50"
          >
            <Save className="size-3.5" />
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
