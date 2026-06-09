import { redirect } from "next/navigation";

/**
 * Ancienne route /reservations — redirigée vers /espaces?vue=planning
 * Conservée pour éviter tout 404 sur les favoris et liens existants.
 */
export default async function ReservationsRedirect({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  redirect(`/dashboard/${org}/espaces?vue=planning`);
}
