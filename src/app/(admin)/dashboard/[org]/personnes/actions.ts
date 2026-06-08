"use server";

import { revalidatePath } from "next/cache";
import {
  createPerson,
  deletePerson,
  updatePerson,
  getOrganizationBySlug,
  type PersonInput,
} from "@/lib/data";
import { publicSiteUrl } from "@/lib/site-public/url";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/personnes`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function createPersonAction(
  orgSlug: string,
  input: PersonInput,
  sendWelcome = false
): Promise<{ ok: boolean }> {
  const ok = await createPerson(input);
  if (ok) {
    refresh(orgSlug);
    // Email de bienvenue (opt-in, non bloquant)
    if (sendWelcome && input.email) {
      void (async () => {
        try {
          const [org, { sendMail }, { tplPersonneBienvenue }] = await Promise.all([
            getOrganizationBySlug(orgSlug),
            import("@/lib/mail"),
            import("@/lib/mail-templates"),
          ]);
          await sendMail({
            to: input.email!,
            subject: `Bienvenue · ${org?.name ?? "Casa Minga Lieux"}`,
            html: tplPersonneBienvenue({
              orgName: org?.name ?? "Casa Minga Lieux",
              firstName: input.name.split(" ")[0],
              role: input.role,
              siteUrl: org?.slug ? publicSiteUrl(org.slug) : undefined,
            }),
            category: "bienvenue",
            organizationId: input.organization_id,
          });
        } catch (e) {
          console.error("[bienvenue CRM] échec envoi:", e);
        }
      })();
    }
  }
  return { ok };
}

export async function updatePersonAction(
  orgSlug: string,
  id: string,
  patch: Partial<PersonInput>
): Promise<{ ok: boolean }> {
  const ok = await updatePerson(id, patch);
  if (ok) refresh(orgSlug);
  return { ok };
}

export async function deletePersonAction(
  orgSlug: string,
  id: string
): Promise<{ ok: boolean }> {
  const ok = await deletePerson(id);
  if (ok) refresh(orgSlug);
  return { ok };
}
