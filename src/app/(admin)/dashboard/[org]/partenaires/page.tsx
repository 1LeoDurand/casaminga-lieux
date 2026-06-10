import { redirect } from "next/navigation";

/**
 * Module Partenaires retiré du périmètre (sprint finition 10/06/2026) —
 * les partenaires se gèrent comme des fiches Personnes. Code des vues en git.
 */
export default async function PartenairesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  redirect(`/dashboard/${org}/personnes`);
}
