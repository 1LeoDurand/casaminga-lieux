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

export type CheckInStatus = "ok" | "already" | "invalid" | "wrong_event" | "cancelled" | "error";

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
    .select("id, event_id, holder_name, checked_in_at")
    .eq("ticket_token", clean)
    .maybeSingle();
  if (!ticket) return { status: "invalid" };
  if (ticket.event_id !== link.event_id) return { status: "wrong_event", fullName: ticket.holder_name };
  if (ticket.checked_in_at) {
    return { status: "already", fullName: ticket.holder_name, checkedAt: ticket.checked_in_at };
  }

  // 3. Marquer la présence
  const now = new Date().toISOString();
  const { error } = await admin.from("event_tickets").update({ checked_in_at: now }).eq("id", ticket.id);
  if (error) return { status: "error", fullName: ticket.holder_name };
  return { status: "ok", fullName: ticket.holder_name, checkedAt: now };
}
