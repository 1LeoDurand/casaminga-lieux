import { redirect } from "next/navigation";

/**
 * Module Médiathèque retiré du périmètre (sprint finition 10/06/2026) —
 * les fichiers se gèrent dans Documents. Code des vues en git.
 */
export default async function MediathequePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  redirect(`/dashboard/${org}/documents`);
}
