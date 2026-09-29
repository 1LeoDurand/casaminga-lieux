"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getOrganizationBySlug } from "@/lib/data";
import { assertOrgAdmin, createAdminClient } from "@/lib/admin/guard";

export async function saveHelloAssoSettingsAction(
  orgSlug: string,
  settings: { clientId: string; clientSecret: string; haOrgSlug: string }
): Promise<boolean> {
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return false;
  const guard = await assertOrgAdmin(org.id);
  if (!guard.ok) return false;
  // The credential columns are not writable by authenticated (migration
  // 0020): write them with the service role, after the admin check above.
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin
    .from("organizations")
    .update({
      helloasso_client_id: settings.clientId,
      helloasso_client_secret: settings.clientSecret,
      helloasso_org_slug: settings.haOrgSlug,
      helloasso_connected_at: new Date().toISOString(),
    })
    .eq("id", org.id);
  if (error) { console.error("saveHelloAssoSettings:", error); return false; }
  revalidatePath(`/dashboard/${orgSlug}/parametres`);
  return true;
}

export async function syncHelloAssoAction(
  orgSlug: string,
  formSlug: string
): Promise<{ ok: boolean; imported?: number; skipped?: number; error?: string }> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/orgs/${orgSlug}/helloasso/sync`,
      {
        method: "POST",
        // Forward the caller's session: the route checks that they are an
        // admin of the organization before touching the credentials.
        headers: {
          "Content-Type": "application/json",
          Cookie: (await cookies()).getAll().map((c) => `${c.name}=${c.value}`).join("; "),
        },
        body: JSON.stringify({ form_slug: formSlug }),
      }
    );
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Erreur serveur" };
    return { ok: true, imported: data.imported, skipped: data.skipped };
  } catch (e) {
    console.error("syncHelloAssoAction:", e);
    return { ok: false, error: "Erreur réseau" };
  }
}
