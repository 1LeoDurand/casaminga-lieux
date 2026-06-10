import { redirect } from "next/navigation";

/**
 * Module Communauté retiré du périmètre (sprint finition 10/06/2026).
 * Les vues restent en git ; les actions newsletter de ce dossier sont
 * toujours utilisées par le module Communication.
 */
export default async function CommunautePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  redirect(`/dashboard/${org}/personnes`);
}
