import "server-only";
/**
 * Health of a mailbox (spec 5.3): bounce and complaint rates over the mailbox's
 * window, automatic pause above the thresholds, and the admin alert (at most one
 * per mailbox, reason and day). The reputation belongs to the address, so
 * this is judged per mailbox, not per program.
 *
 * A pause stops cold mail and automatic replies of every program of the
 * mailbox; it does not stop Leo answering someone who wrote.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminEmail, sendMail } from "@/lib/mail";
import type { Mailbox } from "./types";

export interface HealthRow {
  mailbox_key: string;
  envois_froids: number;
  envois: number;
  rebonds: number;
  plaintes: number;
  taux_rebond: number | null;
  taux_plainte: number | null;
}

export interface HealthVerdict {
  pause: boolean;
  reason: string | null;
  /** Measured values, safe to store in an event (no address). */
  measured: { envois: number; rebonds: number; plaintes: number; taux_rebond: number | null; taux_plainte: number | null };
}

/**
 * Pure decision. Pause when the bounce rate reaches the threshold with at least
 * `bounce_min_count` bounces, or when there is at least one complaint and the
 * complaint rate reaches the threshold (at our volumes, any complaint pauses).
 */
export function evaluateHealth(
  h: HealthRow,
  t: Pick<Mailbox, "bounce_threshold" | "bounce_min_count" | "complaint_threshold">,
): HealthVerdict {
  const measured = {
    envois: h.envois, rebonds: h.rebonds, plaintes: h.plaintes,
    taux_rebond: h.taux_rebond, taux_plainte: h.taux_plainte,
  };
  const bounceRate = h.taux_rebond === null ? null : Number(h.taux_rebond);
  const complaintRate = h.taux_plainte === null ? null : Number(h.taux_plainte);
  if (h.plaintes >= 1 && (complaintRate === null || complaintRate >= Number(t.complaint_threshold))) {
    return { pause: true, reason: "plainte reçue", measured };
  }
  if (h.rebonds >= t.bounce_min_count && (bounceRate === null || bounceRate >= Number(t.bounce_threshold))) {
    return { pause: true, reason: "taux de rebond au-dessus du seuil", measured };
  }
  return { pause: false, reason: null, measured };
}

/**
 * Alert to the admin address, at most once per mailbox, reason and day (an
 * `alert.sent` event is the memory). Never throws, never carries an address.
 */
export async function alertAdmin(
  admin: SupabaseClient,
  mailboxKey: string,
  reason: string,
  subject: string,
  text: string,
): Promise<void> {
  try {
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data } = await admin.from("outreach_events").select("id")
      .eq("type", "alert.sent").eq("data->>mailbox", mailboxKey).eq("data->>reason", reason)
      .gte("occurred_at", since).limit(1);
    if ((data ?? []).length > 0) return;
    await admin.from("outreach_events").insert({
      actor: "cron", type: "alert.sent", data: { mailbox: mailboxKey, reason },
    });
    const to = adminEmail();
    if (!to) return;
    await sendMail({
      to,
      subject: `[Contacts] ${subject}`,
      html: `<p>${text.replace(/[<>&]/g, " ")}</p><p>Boîte : ${mailboxKey}. Détail dans l'admin, écran Contacts, Réglages.</p>`,
      category: "contacts",
    });
  } catch {
    // an alert must never break the run
  }
}

/**
 * Reads the health view of a mailbox and pauses it above the thresholds.
 * Returns true when the mailbox is (now) paused.
 */
export async function checkMailboxHealth(admin: SupabaseClient, mb: Mailbox): Promise<boolean> {
  if (mb.paused) return true;
  const { data } = await admin.from("outreach_v_mailbox_health").select("*").eq("mailbox_key", mb.key).maybeSingle<HealthRow>();
  if (!data) return false;
  const verdict = evaluateHealth(data, mb);
  if (!verdict.pause || !verdict.reason) return false;

  const { data: updated } = await admin.from("outreach_mailboxes")
    .update({ paused: true, pause_reason: verdict.reason, paused_at: new Date().toISOString() })
    .eq("key", mb.key).eq("paused", false).select("key");
  if ((updated ?? []).length > 0) {
    await admin.from("outreach_events").insert({
      actor: "cron", type: "pause.auto", data: { scope: "boite", mailbox: mb.key, reason: verdict.reason, ...verdict.measured },
    });
    await alertAdmin(admin, mb.key, "pause_auto", "Boîte mise en pause automatiquement",
      `La boîte a été mise en pause : ${verdict.reason}. Le froid et l'automatique sont arrêtés, les réponses de Léo partent encore.`);
  }
  return true;
}
