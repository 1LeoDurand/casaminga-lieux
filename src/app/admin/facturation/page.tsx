import Link from "next/link";
import { Tag, Users, Settings2 } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getSaInvoices, getSaClients, getSaPricingItems, getSaSettings } from "@/lib/superadmin-billing/data";
import { BillingView } from "./billing-view";

export const dynamic = "force-dynamic";

export default async function FacturationPage() {
  await requireSuperAdmin();
  const [invoices, clients, pricingItems, settings] = await Promise.all([
    getSaInvoices(),
    getSaClients(),
    getSaPricingItems(),
    getSaSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-coral">Mon activité</div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Facturation</h1>
          <p className="text-sm text-warmgray">{settings.issuer_name} · {settings.siret ? `SIRET ${settings.siret}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/facturation/clients" className="mc-btn mc-btn-outline mc-btn-sm"><Users className="size-4" /> Clients</Link>
          <Link href="/admin/facturation/tarifs" className="mc-btn mc-btn-outline mc-btn-sm"><Tag className="size-4" /> Tarifs</Link>
          <Link href="/admin/facturation/parametres" className="mc-btn mc-btn-outline mc-btn-sm"><Settings2 className="size-4" /> Paramètres</Link>
        </div>
      </div>

      <BillingView invoices={invoices} clients={clients} pricingItems={pricingItems} settings={settings} />
    </div>
  );
}
