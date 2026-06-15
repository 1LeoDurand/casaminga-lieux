"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import { contractTypeLabel, fmtDate } from "@/lib/contracts-meta";
import type { Contract, ContractType, ContractPeriod, ContractStatus } from "@/lib/types";

type ActionResult = { ok: boolean; error?: string; id?: string };

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "Contrats disponibles une fois Supabase configuré.",
};

export interface ContractInput {
  title: string;
  contract_type: ContractType;
  counterparty_name: string | null;
  counterparty_person_id: string | null;
  pole_id: string | null;
  amount: number | null;
  amount_period: ContractPeriod;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  auto_renew: boolean;
  notice_period_days: number | null;
  status: ContractStatus;
  document_id: string | null;
  signed: boolean;
  notes: string | null;
}

export async function getContractsForOrg(orgId: string): Promise<Contract[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("organization_id", orgId)
    .order("renewal_date", { ascending: true, nullsFirst: false });
  return (data as Contract[] | null) ?? [];
}

export async function saveContract(
  orgId: string,
  orgSlug: string,
  input: ContractInput,
  id?: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const payload = {
    organization_id: orgId,
    title: input.title.trim(),
    contract_type: input.contract_type,
    counterparty_name: input.counterparty_name?.trim() || null,
    counterparty_person_id: input.counterparty_person_id || null,
    pole_id: input.pole_id || null,
    amount: input.amount,
    amount_period: input.amount_period,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    renewal_date: input.renewal_date || null,
    auto_renew: input.auto_renew,
    notice_period_days: input.notice_period_days,
    status: input.status,
    document_id: input.document_id || null,
    signed: input.signed,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { error } = await supabase.from("contracts").update(payload).eq("id", id);
    if (error) return { ok: false, error: humanError(error) };
    revalidatePath(`/dashboard/${orgSlug}/contrats`);
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("contracts").insert(payload).select("id").single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/contrats`);
  return { ok: true, id: data.id };
}

export async function deleteContract(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/contrats`);
  return { ok: true };
}

/**
 * Chaîne : échéance → tâche de suivi.
 * Crée une tâche (module Tâches) avec la date butoir = renouvellement.
 */
export async function createRenewalTask(
  orgId: string,
  orgSlug: string,
  contractId: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contracts")
    .select("title, contract_type, renewal_date, end_date, notice_period_days, counterparty_name")
    .eq("id", contractId)
    .maybeSingle();
  if (!c) return { ok: false, error: "Contrat introuvable." };

  const base = c.renewal_date ?? c.end_date;
  let due = base;
  if (base && c.notice_period_days) {
    const d = new Date(base);
    d.setDate(d.getDate() - c.notice_period_days);
    due = d.toISOString().slice(0, 10);
  }

  const { error } = await supabase.from("tasks").insert({
    organization_id: orgId,
    title: `Renouveler : ${c.title}`,
    description: `${contractTypeLabel(c.contract_type)}${c.counterparty_name ? ` — ${c.counterparty_name}` : ""}. Échéance ${fmtDate(base)}${c.notice_period_days ? ` (préavis ${c.notice_period_days} j)` : ""}.`,
    priority: "haute",
    status: "a_faire",
    due_date: due,
    related_label: "Contrat",
  });
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/taches`);
  return { ok: true };
}

/**
 * Chaîne : rappel d'échéance par email groupé aux contreparties.
 * Cible : une sélection de contrats. Envoi individuel, journalisé, safe-démo.
 */
export async function sendRenewalReminders(
  orgId: string,
  orgSlug: string,
  contractIds: string[],
  message: string
): Promise<ActionResult & { sent?: number }> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  if (contractIds.length === 0) return { ok: false, error: "Aucun contrat sélectionné." };
  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, title, counterparty_person_id, renewal_date, end_date")
    .in("id", contractIds);
  if (!contracts?.length) return { ok: false, error: "Contrats introuvables." };

  // Emails des contreparties (via fiches CRM liées)
  const personIds = contracts.map((c) => c.counterparty_person_id).filter((p): p is string => !!p);
  if (personIds.length === 0) return { ok: false, error: "Aucune contrepartie n'a de fiche CRM avec email." };

  const { data: persons } = await supabase
    .from("persons")
    .select("id, name, email")
    .in("id", personIds);
  const emailById = new Map((persons ?? []).filter((p) => p.email).map((p) => [p.id, { name: p.name, email: p.email as string }]));

  let sent = 0;
  for (const c of contracts) {
    const party = c.counterparty_person_id ? emailById.get(c.counterparty_person_id) : null;
    if (!party?.email) continue;
    const deadline = c.renewal_date ?? c.end_date;
    const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#2C2C2C">
      <p>Bonjour ${party.name ?? ""},</p>
      <div>${message.replace(/\n/g, "<br>")}</div>
      <p style="margin-top:12px;color:#6B6460">Contrat concerné : <strong>${c.title}</strong>${deadline ? ` — échéance ${fmtDate(deadline)}` : ""}.</p>
    </div>`;
    const ok = await sendMail({
      to: party.email,
      subject: `Échéance de contrat — ${c.title}`,
      html,
      category: "contrats",
      organizationId: orgId,
    });
    if (ok) sent++;
  }

  if (sent === 0) return { ok: false, error: "Aucune contrepartie joignable par email." };
  return { ok: true, sent };
}
