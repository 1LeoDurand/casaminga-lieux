"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getOrganizationBySlug } from "@/lib/data";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

type Result = { ok: boolean; error?: string; sent?: number; total?: number };

/**
 * Envoie un bulletin à tous les membres (ou à un groupe) ayant un email.
 * Chaque envoi est journalisé dans email_log (catégorie "newsletter").
 */
export async function sendNewsletter(
  orgId: string,
  orgSlug: string,
  input: { groupId: string | null; subject: string; body: string }
): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  if (!input.subject.trim() || !input.body.trim()) return { ok: false, error: "Objet et message requis." };

  const supabase = await createClient();

  // Destinataires : membres avec email, filtrés par groupe si fourni
  let personIds: string[] | null = null;
  if (input.groupId) {
    const { data: links } = await supabase
      .from("member_group_links").select("person_id").eq("group_id", input.groupId);
    personIds = (links ?? []).map((l) => l.person_id);
    if (personIds.length === 0) return { ok: false, error: "Ce groupe n'a aucun membre." };
  }

  // `newsletter_opt_out` doit filtrer ici comme partout ailleurs : ce bulletin
  // est un envoi de masse, pas un message transactionnel.
  let query = supabase
    .from("persons")
    .select("name, email, unsubscribe_token")
    .eq("organization_id", orgId)
    .eq("newsletter_opt_out", false)
    .not("email", "is", null);
  if (personIds) query = query.in("id", personIds);
  const { data: recipients } = await query;

  const list = (recipients ?? []).filter((r) => r.email);
  if (list.length === 0) return { ok: false, error: "Aucun destinataire avec email." };

  const [org, { sendMail }, { tplNewsletter }] = await Promise.all([
    getOrganizationBySlug(orgSlug),
    import("@/lib/mail"),
    import("@/lib/mail-templates"),
  ]);
  const orgName = org?.name ?? "Casa Minga Lieux";

  let sent = 0;
  for (const r of list) {
    // Le lien de désabonnement est propre à chaque destinataire : le HTML ne
    // peut donc plus être calculé une seule fois pour toute la liste.
    const ok = await sendMail({
      to: r.email!,
      subject: input.subject,
      html: tplNewsletter({
        orgName,
        title: input.subject,
        body: input.body,
        unsubscribeUrl: `${BASE_URL}/unsubscribe/${r.unsubscribe_token}`,
      }),
      category: "newsletter",
      organizationId: orgId,
      unsubscribeUrl: `${BASE_URL}/api/unsubscribe/${r.unsubscribe_token}`,
    });
    if (ok) sent++;
  }

  return { ok: true, sent, total: list.length };
}
