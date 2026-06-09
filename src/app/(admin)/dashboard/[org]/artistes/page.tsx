import { redirect } from "next/navigation";

/**
 * Ancienne route /artistes — redirigée vers /residences?vue=artistes
 * Conservée pour éviter tout 404 sur les favoris et liens existants.
 */
export default async function ArtistesRedirect({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  redirect(`/dashboard/${org}/residences?vue=artistes`);
}
