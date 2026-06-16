import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getSaPricingItems } from "@/lib/superadmin-billing/data";
import { TarifsView } from "./tarifs-view";

export const dynamic = "force-dynamic";

export default async function TarifsPage() {
  await requireSuperAdmin();
  const items = await getSaPricingItems();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/facturation" className="mb-2 inline-flex items-center gap-1 text-xs text-warmgray hover:text-coral"><ArrowLeft className="size-3.5" /> Facturation</Link>
        <h1 className="font-heading text-2xl font-bold text-foreground">Tarifs affichés</h1>
        <p className="text-sm text-warmgray">Votre catalogue de prestations, insérable en un clic dans une facture.</p>
      </div>
      <TarifsView items={items} />
    </div>
  );
}
