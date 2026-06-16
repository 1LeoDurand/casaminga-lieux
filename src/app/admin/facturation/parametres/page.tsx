import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getSaSettings } from "@/lib/superadmin-billing/data";
import { ParametresForm } from "./parametres-form";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  await requireSuperAdmin();
  const settings = await getSaSettings();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/facturation" className="mb-2 inline-flex items-center gap-1 text-xs text-warmgray hover:text-coral"><ArrowLeft className="size-3.5" /> Facturation</Link>
        <h1 className="font-heading text-2xl font-bold text-foreground">Paramètres de facturation</h1>
        <p className="text-sm text-warmgray">Votre identité d&apos;émetteur, vos coordonnées bancaires et la numérotation.</p>
      </div>
      <ParametresForm settings={settings} />
    </div>
  );
}
