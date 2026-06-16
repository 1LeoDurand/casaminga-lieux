import "server-only";
import { createAdminClient } from "@/lib/admin/guard";
import {
  type SaInvoice,
  type SaClient,
  type SaPricingItem,
  type SaInvoiceSettings,
  DEFAULT_SA_SETTINGS,
} from "./types";

/** Récupère les paramètres émetteur (singleton id=1). */
export async function getSaSettings(): Promise<SaInvoiceSettings> {
  const sb = createAdminClient();
  if (!sb) return DEFAULT_SA_SETTINGS;
  const { data } = await sb.from("sa_invoice_settings").select("*").eq("id", 1).maybeSingle();
  return (data as SaInvoiceSettings) ?? DEFAULT_SA_SETTINGS;
}

export async function getSaInvoices(): Promise<SaInvoice[]> {
  const sb = createAdminClient();
  if (!sb) return [];
  const { data } = await sb.from("sa_invoices").select("*").order("created_at", { ascending: false });
  return (data as SaInvoice[]) ?? [];
}

export async function getSaInvoiceById(id: string): Promise<SaInvoice | null> {
  const sb = createAdminClient();
  if (!sb) return null;
  const { data } = await sb.from("sa_invoices").select("*").eq("id", id).maybeSingle();
  return (data as SaInvoice) ?? null;
}

export async function getSaClients(): Promise<SaClient[]> {
  const sb = createAdminClient();
  if (!sb) return [];
  const { data } = await sb.from("sa_clients").select("*").order("name", { ascending: true });
  return (data as SaClient[]) ?? [];
}

export async function getSaPricingItems(): Promise<SaPricingItem[]> {
  const sb = createAdminClient();
  if (!sb) return [];
  const { data } = await sb
    .from("sa_pricing_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as SaPricingItem[]) ?? [];
}

/**
 * Calcule le prochain numéro de facture au format `${prefix}${yy}-${seq4}`,
 * ex. "DND-26-0016". La séquence repart par année civile.
 */
export async function nextSaInvoiceNumber(settings: SaInvoiceSettings, issueDate: string | null): Promise<string> {
  const sb = createAdminClient();
  const year = issueDate ? new Date(issueDate).getFullYear() : new Date().getFullYear();
  const yy = String(year).slice(-2);
  const prefix = `${settings.number_prefix}${yy}-`;

  let maxSeq = settings.number_start - 1;
  if (sb) {
    const { data } = await sb
      .from("sa_invoices")
      .select("number")
      .not("number", "is", null)
      .like("number", `${prefix}%`);
    for (const row of (data as { number: string }[]) ?? []) {
      const suffix = row.number.slice(prefix.length);
      const n = parseInt(suffix, 10);
      if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }
  const seq = maxSeq + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
