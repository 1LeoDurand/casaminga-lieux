import { notFound } from "next/navigation";
import { verifyPortalToken } from "@/lib/portal/token";
import { getPortalDataByEmail } from "@/lib/portal/data";
import { PortalDashboard } from "@/components/mc/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function EspaceTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Vérification du token HMAC (stateless)
  const email = verifyPortalToken(token);
  if (!email) notFound();

  // Agrégation multi-org par email
  const data = await getPortalDataByEmail(email);
  if (!data) notFound(); // Supabase non configuré (mode démo)

  return <PortalDashboard data={data} />;
}
