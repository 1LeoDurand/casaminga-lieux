import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import { getSaClients } from "@/lib/superadmin-billing/data";
import { ClientsView } from "./clients-view";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireSuperAdmin();
  const clients = await getSaClients();

  let organizations: { id: string; name: string }[] = [];
  const sb = createAdminClient();
  if (sb) {
    const { data } = await sb.from("organizations").select("id, name").order("name", { ascending: true });
    organizations = (data as { id: string; name: string }[]) ?? [];
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/facturation" className="mb-2 inline-flex items-center gap-1 text-xs text-warmgray hover:text-coral"><ArrowLeft className="size-3.5" /> Facturation</Link>
        <h1 className="font-heading text-2xl font-bold text-foreground">Clients</h1>
        <p className="text-sm text-warmgray">Vos clients, avec lien optionnel vers une association Casa Minga.</p>
      </div>
      <ClientsView clients={clients} organizations={organizations} />
    </div>
  );
}
