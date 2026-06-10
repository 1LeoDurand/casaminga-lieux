import { redirect } from "next/navigation";

/**
 * Page Upgrade masquée tant que la facturation Stripe n'est pas en place
 * (décision sprint finition 10/06/2026 — réactiver avec Lot 10.1).
 * L'ancienne page plans/tarifs reste dans l'historique git.
 */
export default async function UpgradePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  redirect(`/dashboard/${org}`);
}
