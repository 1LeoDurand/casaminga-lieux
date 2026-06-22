"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/guard";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";

export interface ScanLink {
  id: string;
  event_id: string;
  token: string;
  label: string | null;
  revoked: boolean;
  expires_at: string | null;
  created_at: string;
}

export type CheckInStatus = "ok" | "already" | "invalid" | "wrong_event" | "cancelled" | "unpaid" | "error";

export interface CheckInResult {
  status: CheckInStatus;
  fullName?: string;
  seats?: number;
  checkedAt?: string;
}

/** URL encodée dans le QR (un appareil photo générique ouvre le billet). */
function billetUrl(ticketToken: string): string {
  return `${PUBLIC_SITE_BASE}/billet/${ticketToken}`;
}

/** Génère le QR (data URL PNG) d'un billet. */
export async function ticketQrDataUrl(ticketToken: string): Promise<string> {
  return QRCode.toDataURL(billetUrl(ticketToken), { width: 320, margin: 1 });
}

// ── Manifeste hors-ligne + synchro ────────────────────────────

export interface TicketManifestEntry {
  token: string;
  holder: string;
  checkedInAt: string | null;
}

export interface TicketManifest {
  eventId: string;
  eventTitle: string;
  tickets: TicketManifestEntry[];
}

/**
 * Charge la liste des billets scannables pour un événement via le lien de scan.
 * N'inclut jamais les billets 'pending' (non payés).
 */
export async function getEventTicketManifest(linkToken: string): Promise<TicketManifest | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: link } = await admin
    .from("event_scan_links")
    .select("event_id, revoked, expires_at")
    .eq("token", linkToken)
    .maybeSingle();
  if (!link || link.revoked) return null;
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null;

  const { data: ev } = await admin
    .from("evenements")
    .select("id, title")
    .eq("id", link.event_id)
    .maybeSingle();
  if (!ev) return null;

  const { data: tickets } = await admin
    .from("event_tickets")
    .select("ticket_token, holder_name, checked_in_at")
    .eq("event_id", link.event_id)
    .in("payment_status", ["free", "paid"]);

  return {
    eventId: ev.id,
    eventTitle: ev.title,
    tickets: (tickets ?? []).map((t) => ({
      token: t.ticket_token,
      holder: t.holder_name,
      checkedInAt: t.checked_in_at,
    })),
  };
}

export interface CheckInBatchItem {
  token: string;
  scannedAt: string;
}

export interface SyncResult {
  applied: number;
  conflicts: { token: string; existingAt: string }[];
}

/**
 * Synchronise une file de check-ins hors-ligne.
 * Idempotent + premier-scan-gagnant : ne pose checked_in_at que s'il est null.
 */
export async function syncCheckIns(linkToken: string, items: CheckInBatchItem[]): Promise<SyncResult> {
  const admin = createAdminClient();
  if (!admin) return { applied: 0, conflicts: [] };

  const { data: link } = await admin
    .from("event_scan_links")
    .select("event_id, revoked, expires_at")
    .eq("token", linkToken)
    .maybeSingle();
  if (!link || link.revoked) return { applied: 0, conflicts: [] };
  if (link.expires_at && new Date(link.expires_at) < new Date()) return { applied: 0, conflicts: [] };

  let applied = 0;
  const conflicts: { token: string; existingAt: string }[] = [];

  for (const item of items) {
    const { data: ticket } = await admin
      .from("event_tickets")
      .select("id, event_id, checked_in_at, payment_status")
      .eq("ticket_token", item.token)
      .maybeSingle();

    if (!ticket || ticket.event_id !== link.event_id) continue;
    if (ticket.payment_status === "pending") continue;

    if (ticket.checked_in_at) {
      conflicts.push({ token: item.token, existingAt: ticket.checked_in_at });
      continue;
    }

    const { error } = await admin
      .from("event_tickets")
      .update({ checked_in_at: item.scannedAt })
      .eq("id", ticket.id)
      .is("checked_in_at", null);

    if (!error) {
      applied++;
    } else {
      const { data: refetch } = await admin
        .from("event_tickets")
        .select("checked_in_at")
        .eq("id", ticket.id)
        .maybeSingle();
      if (refetch?.checked_in_at) {
        conflicts.push({ token: item.token, existingAt: refetch.checked_in_at });
      }
    }
  }

  return { applied, conflicts };
}

// ── Côté admin/membre (dashboard) ─────────────────────────────

export async function getOrCreateScanLink(orgSlug: string, orgId: string, eventId: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("event_scan_links")
    .select("token")
    .eq("event_id", eventId)
    .eq("revoked", false)
    .limit(1)
    .maybeSingle();
  if (existing?.token) return { ok: true, token: existing.token };

  const { data, error } = await supabase
    .from("event_scan_links")
    .insert({ organization_id: orgId, event_id: eventId })
    .select("token")
    .single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return { ok: true, token: data.token };
}

export async function revokeScanLink(orgSlug: string, id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_scan_links").update({ revoked: true }).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/evenements`);
  return { ok: true };
}

// ── Côté public (scanner sans compte) — client service_role ───

/** Résout un lien de scan → l'événement. Public (utilisé par la page scanner). */
export async function resolveScanLink(linkToken: string): Promise<{ eventId: string; eventTitle: string; startAt: string } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: link } = await admin
    .from("event_scan_links")
    .select("event_id, revoked, expires_at")
    .eq("token", linkToken)
    .maybeSingle();
  if (!link || link.revoked) return null;
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null;
  const { data: ev } = await admin
    .from("evenements").select("id, title, start_at").eq("id", link.event_id).maybeSingle();
  if (!ev) return null;
  return { eventId: ev.id, eventTitle: ev.title, startAt: ev.start_at };
}

/** Valide un BILLET (event_tickets) et marque la présence. Public, protégé par le lien de scan. */
export async function checkInByTicket(linkToken: string, ticketToken: string): Promise<CheckInResult> {
  const admin = createAdminClient();
  if (!admin) return { status: "error" };

  // 1. Valider le lien de scan
  const { data: link } = await admin
    .from("event_scan_links")
    .select("event_id, revoked, expires_at")
    .eq("token", linkToken)
    .maybeSingle();
  if (!link || link.revoked) return { status: "error" };
  if (link.expires_at && new Date(link.expires_at) < new Date()) return { status: "error" };

  // 2. Le billet existe ? (le token peut arriver brut ou dans une URL /billet/<token>)
  const clean = ticketToken.trim().split("/").filter(Boolean).pop() ?? ticketToken.trim();
  const { data: ticket } = await admin
    .from("event_tickets")
    .select("id, event_id, holder_name, checked_in_at, payment_status")
    .eq("ticket_token", clean)
    .maybeSingle();
  if (!ticket) return { status: "invalid" };
  if (ticket.event_id !== link.event_id) return { status: "wrong_event", fullName: ticket.holder_name };
  if (ticket.checked_in_at) {
    return { status: "already", fullName: ticket.holder_name, checkedAt: ticket.checked_in_at };
  }
  if (ticket.payment_status === "pending") {
    return { status: "unpaid", fullName: ticket.holder_name };
  }

  // 3. Marquer la présence
  const now = new Date().toISOString();
  const { error } = await admin.from("event_tickets").update({ checked_in_at: now }).eq("id", ticket.id);
  if (error) return { status: "error", fullName: ticket.holder_name };
  return { status: "ok", fullName: ticket.holder_name, checkedAt: now };
}
