import { notFound } from "next/navigation";
import { getOrganizationBySlug } from "@/lib/data";
import { ImportPersonnesClient } from "./import-client";

export default async function ImporterPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  return <ImportPersonnesClient orgSlug={org} orgId={organization.id} />;
}
