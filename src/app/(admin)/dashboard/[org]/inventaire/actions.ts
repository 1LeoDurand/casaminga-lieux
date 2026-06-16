"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import type {
  Asset, AssetMaintenance, AssetCategory, AssetStatus, AssetCondition, MaintenanceStatus,
} from "@/lib/types";

type ActionResult = { ok: boolean; error?: string; id?: string };
const NOT_CONFIGURED: ActionResult = { ok: false, error: "Inventaire disponible une fois Supabase configuré." };

export interface AssetInput {
  name: string;
  category: AssetCategory;
  reference: string | null;
  location: string | null;
  pole_id: string | null;
  establishment_id: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  quantity: number;
  purchase_date: string | null;
  purchase_value: number | null;
  warranty_until: string | null;
  photo_url: string | null;
  notes: string | null;
}

export interface MaintenanceInput {
  asset_id: string | null;
  title: string;
  description: string | null;
  status: MaintenanceStatus;
  reported_at: string;
  due_date: string | null;
  done_at: string | null;
  cost: number | null;
  assignee_person_id: string | null;
}

// ── Lecture ──────────────────────────────────────────────────────
export async function getAssetsForOrg(orgId: string): Promise<Asset[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("assets").select("*").eq("organization_id", orgId).order("name");
  return (data as Asset[] | null) ?? [];
}
export async function getMaintenanceForOrg(orgId: string): Promise<AssetMaintenance[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("asset_maintenance").select("*").eq("organization_id", orgId).order("reported_at", { ascending: false });
  return (data as AssetMaintenance[] | null) ?? [];
}

// ── Écriture : bien ──────────────────────────────────────────────
export async function saveAsset(orgId: string, orgSlug: string, input: AssetInput, id?: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const payload = {
    organization_id: orgId,
    name: input.name.trim(),
    category: input.category,
    reference: input.reference?.trim() || null,
    location: input.location?.trim() || null,
    pole_id: input.pole_id || null,
    establishment_id: input.establishment_id || null,
    status: input.status,
    condition: input.condition,
    quantity: input.quantity,
    purchase_date: input.purchase_date || null,
    purchase_value: input.purchase_value,
    warranty_until: input.warranty_until || null,
    photo_url: input.photo_url || null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { error } = await supabase.from("assets").update(payload).eq("id", id);
    if (error) return { ok: false, error: humanError(error) };
    revalidatePath(`/dashboard/${orgSlug}/inventaire`);
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("assets").insert(payload).select("id").single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/inventaire`);
  return { ok: true, id: data.id };
}

export async function deleteAsset(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/inventaire`);
  return { ok: true };
}

// ── Chaîne : prêt / retour (détenteur → CRM) ─────────────────────
export async function lendAsset(orgSlug: string, assetId: string, personId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  if (!personId) return { ok: false, error: "Choisissez à qui prêter." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({ holder_person_id: personId, status: "en_pret", updated_at: new Date().toISOString() })
    .eq("id", assetId);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/inventaire`);
  return { ok: true };
}

export async function returnAsset(orgSlug: string, assetId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({ holder_person_id: null, status: "disponible", updated_at: new Date().toISOString() })
    .eq("id", assetId);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/inventaire`);
  return { ok: true };
}

// ── Chaîne : rappels de retour groupés (aux détenteurs) ──────────
export async function sendReturnReminders(orgId: string, orgSlug: string, message: string): Promise<ActionResult & { sent?: number }> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { data: lent } = await supabase
    .from("assets")
    .select("name, holder_person_id")
    .eq("organization_id", orgId)
    .eq("status", "en_pret");
  const holders = (lent ?? []).filter((a) => a.holder_person_id);
  if (holders.length === 0) return { ok: false, error: "Aucun matériel en prêt." };

  const personIds = Array.from(new Set(holders.map((a) => a.holder_person_id as string)));
  const { data: persons } = await supabase.from("persons").select("id, name, email").in("id", personIds);
  const byId = new Map((persons ?? []).map((p) => [p.id, p]));

  // Regroupe le matériel par détenteur
  const itemsByPerson = new Map<string, string[]>();
  for (const a of holders) {
    const pid = a.holder_person_id as string;
    if (!itemsByPerson.has(pid)) itemsByPerson.set(pid, []);
    itemsByPerson.get(pid)!.push(a.name);
  }

  let sent = 0;
  for (const [pid, items] of itemsByPerson) {
    const p = byId.get(pid);
    if (!p?.email) continue;
    const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#2C2C2C">
      <p>Bonjour ${p.name ?? ""},</p>
      <div>${message.replace(/\n/g, "<br>")}</div>
      <p style="margin-top:12px">Matériel concerné :</p>
      <ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>
    </div>`;
    const ok = await sendMail({ to: p.email, subject: "Rappel — matériel à rendre", html, category: "inventaire", organizationId: orgId });
    if (ok) sent++;
  }
  if (sent === 0) return { ok: false, error: "Aucun détenteur joignable par email." };
  return { ok: true, sent };
}

// ── Écriture : maintenance ───────────────────────────────────────
export async function saveMaintenance(orgId: string, orgSlug: string, input: MaintenanceInput, id?: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const payload = {
    organization_id: orgId,
    asset_id: input.asset_id || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    reported_at: input.reported_at,
    due_date: input.due_date || null,
    done_at: input.status === "fait" ? (input.done_at || new Date().toISOString().slice(0, 10)) : null,
    cost: input.cost,
    assignee_person_id: input.assignee_person_id || null,
    updated_at: new Date().toISOString(),
  };
  // Synchronise le statut du bien si une maintenance est ouverte/fermée
  if (input.asset_id) {
    if (input.status === "fait") {
      await supabase.from("assets").update({ status: "disponible" }).eq("id", input.asset_id).eq("status", "maintenance");
    } else {
      await supabase.from("assets").update({ status: "maintenance" }).eq("id", input.asset_id).in("status", ["disponible", "en_panne"]);
    }
  }
  if (id) {
    const { error } = await supabase.from("asset_maintenance").update(payload).eq("id", id);
    if (error) return { ok: false, error: humanError(error) };
    revalidatePath(`/dashboard/${orgSlug}/inventaire`);
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("asset_maintenance").insert(payload).select("id").single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/inventaire`);
  return { ok: true, id: data.id };
}

export async function deleteMaintenance(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("asset_maintenance").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/inventaire`);
  return { ok: true };
}

// ── Chaîne : ticket maintenance → dépense auto ───────────────────
export async function maintenanceToExpense(orgId: string, orgSlug: string, maintenanceId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("asset_maintenance")
    .select("id, title, cost, expense_id, reported_at, asset_id")
    .eq("id", maintenanceId)
    .maybeSingle();
  if (!m) return { ok: false, error: "Ticket introuvable." };
  if (m.expense_id) return { ok: false, error: "Une dépense est déjà liée à ce ticket." };
  if (!m.cost || Number(m.cost) <= 0) return { ok: false, error: "Renseignez d'abord un coût sur le ticket." };

  // Pôle et lieu hérités du bien si disponible
  let poleId: string | null = null;
  let establishmentId: string | null = null;
  if (m.asset_id) {
    const { data: asset } = await supabase.from("assets").select("pole_id, establishment_id").eq("id", m.asset_id).maybeSingle();
    poleId = asset?.pole_id ?? null;
    establishmentId = asset?.establishment_id ?? null;
  }

  const { data: exp, error } = await supabase
    .from("expenses")
    .insert({
      organization_id: orgId,
      label: `Maintenance — ${m.title}`,
      amount_ttc: Number(m.cost),
      vat_applicable: false,
      vat_amount: null,
      category: "materiel",
      pole_id: poleId,
      establishment_id: establishmentId,
      spent_at: m.reported_at,
      notes: "Généré depuis un ticket de maintenance (Inventaire).",
    })
    .select("id")
    .single();
  if (error || !exp) return { ok: false, error: humanError(error ?? new Error("échec")) };

  await supabase.from("asset_maintenance").update({ expense_id: exp.id }).eq("id", m.id);
  revalidatePath(`/dashboard/${orgSlug}/inventaire`);
  revalidatePath(`/dashboard/${orgSlug}/depenses`);
  return { ok: true, id: exp.id };
}
