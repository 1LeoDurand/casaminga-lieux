"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import { createTaxReceipt } from "@/lib/tax-receipts/data";
import type { DonationType as CerfaDonationType } from "@/lib/invoicing/types";
import type {
  Donation,
  DonationCampaign,
  DonationType,
  DonationPaymentStatus,
} from "@/lib/types";

/** Mappe le don (type + mode de règlement) vers le type Cerfa (numeraire/cheque/virement/bien). */
function toCerfaDonationType(donationType: string, paymentMethod: string | null): CerfaDonationType {
  if (donationType === "nature") return "bien";
  switch (paymentMethod) {
    case "cheque": return "cheque";
    case "virement": return "virement";
    case "especes": return "numeraire";
    case "cb":
    case "en_ligne": return "virement";
    default: return "numeraire";
  }
}

type ActionResult = { ok: boolean; error?: string; id?: string };

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "Dons disponibles une fois Supabase configuré.",
};

export interface DonationInput {
  donor_name: string;
  donor_person_id: string | null;
  donor_email: string | null;
  donor_address: string | null;
  amount: number;
  donation_type: DonationType;
  received_at: string;
  payment_method: string | null;
  payment_status: DonationPaymentStatus;
  campaign_id: string | null;
  pole_id: string | null;
  notes: string | null;
}

export interface DonationCampaignInput {
  title: string;
  slug: string;
  description: string | null;
  goal_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  status: DonationCampaign["status"];
  is_public: boolean;
}

// ── Lecture ────────────────────────────────────────────────────────────────

export async function getDonationsForOrg(orgId: string): Promise<Donation[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("donations")
    .select("*")
    .eq("organization_id", orgId)
    .order("received_at", { ascending: false });
  return (data as Donation[] | null) ?? [];
}

export async function getDonationCampaignsForOrg(orgId: string): Promise<DonationCampaign[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("donation_campaigns")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return (data as DonationCampaign[] | null) ?? [];
}

// ── Chaîne : lien donateur → fiche CRM (tag « donateur ») ───────────────────

/**
 * Rattache un don à une fiche Personne :
 *  - person_id fourni  → s'assure que le tag « donateur » est présent ;
 *  - email connu        → réutilise la fiche existante (tag ajouté) ;
 *  - sinon              → crée une fiche (rôle prospect, tag « donateur »).
 * Best-effort : ne bloque jamais l'enregistrement du don.
 */
async function linkDonorToPerson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  orgId: string,
  input: DonationInput
): Promise<string | null> {
  try {
    // 1. Fiche déjà désignée
    if (input.donor_person_id) {
      const { data: p } = await db.from("persons").select("id, tags").eq("id", input.donor_person_id).maybeSingle();
      if (p) {
        const tags: string[] = p.tags ?? [];
        if (!tags.includes("donateur")) {
          await db.from("persons").update({ tags: [...tags, "donateur"] }).eq("id", p.id);
        }
        return p.id;
      }
    }
    // 2. Fiche retrouvée par email
    if (input.donor_email) {
      const { data: existing } = await db
        .from("persons")
        .select("id, tags")
        .eq("organization_id", orgId)
        .ilike("email", input.donor_email)
        .limit(1)
        .maybeSingle();
      if (existing) {
        const tags: string[] = existing.tags ?? [];
        if (!tags.includes("donateur")) {
          await db.from("persons").update({ tags: [...tags, "donateur"] }).eq("id", existing.id);
        }
        return existing.id;
      }
    }
    // 3. Nouvelle fiche
    const { data: created } = await db
      .from("persons")
      .insert({
        organization_id: orgId,
        name: input.donor_name,
        email: input.donor_email,
        phone: null,
        role: "prospect",
        status: "actif",
        tags: ["donateur"],
        notes: "Créé depuis un don.",
      })
      .select("id")
      .single();
    return created?.id ?? null;
  } catch (e) {
    console.error("linkDonorToPerson:", e);
    return null;
  }
}

// ── Chaîne : don confirmé → recette auto dans Finances ──────────────────────

/**
 * Synchronise la recette liée à un don (calque facture→transactions).
 * Don confirmé → crée la recette si absente. Don non confirmé → la retire.
 */
async function syncDonationRecette(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  donation: {
    id: string;
    organization_id: string;
    donor_name: string;
    amount: number;
    received_at: string;
    payment_status: string;
    donor_person_id: string | null;
    pole_id: string | null;
  }
) {
  if (donation.payment_status === "confirme") {
    const { count } = await db
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("donation_id", donation.id);
    if ((count ?? 0) === 0) {
      let category = "Dons";
      if (donation.pole_id) {
        const { data: pole } = await db.from("poles").select("name").eq("id", donation.pole_id).maybeSingle();
        if (pole?.name) category = pole.name;
      }
      await db.from("transactions").insert({
        organization_id: donation.organization_id,
        type: "recette",
        category,
        amount: Number(donation.amount),
        date: donation.received_at,
        label: `Don de ${donation.donor_name}`,
        status: "validee",
        person_id: donation.donor_person_id ?? null,
        donation_id: donation.id,
      });
    }
  } else {
    // en_attente → pas de recette comptabilisée
    await db.from("transactions").delete().eq("donation_id", donation.id);
  }
}

// ── Écriture : don ──────────────────────────────────────────────────────────

export async function saveDonation(
  orgId: string,
  orgSlug: string,
  input: DonationInput,
  id?: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Lien CRM (best-effort) — réutilise la fiche existante ou en crée une
  const personId = await linkDonorToPerson(db, orgId, input);

  const payload = {
    organization_id: orgId,
    donor_name: input.donor_name.trim(),
    donor_person_id: personId,
    donor_email: input.donor_email || null,
    donor_address: input.donor_address || null,
    amount: input.amount,
    donation_type: input.donation_type,
    received_at: input.received_at,
    payment_method: input.payment_method || null,
    payment_status: input.payment_status,
    campaign_id: input.campaign_id || null,
    pole_id: input.pole_id || null,
    updated_at: new Date().toISOString(),
  };

  let donationId = id;
  if (id) {
    const { error } = await db.from("donations").update(payload).eq("id", id);
    if (error) return { ok: false, error: humanError(error) };
  } else {
    const { data, error } = await db.from("donations").insert(payload).select("id").single();
    if (error) return { ok: false, error: humanError(error) };
    donationId = data.id;
  }

  // Recette auto dans Finances
  await syncDonationRecette(db, {
    id: donationId!,
    organization_id: orgId,
    donor_name: payload.donor_name,
    amount: payload.amount,
    received_at: payload.received_at,
    payment_status: payload.payment_status,
    donor_person_id: personId,
    pole_id: payload.pole_id,
  });

  revalidatePath(`/dashboard/${orgSlug}/dons`);
  revalidatePath(`/dashboard/${orgSlug}/finances`);
  return { ok: true, id: donationId };
}

export async function deleteDonation(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  await db.from("transactions").delete().eq("donation_id", id); // retire la recette liée
  const { error } = await db.from("donations").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/dons`);
  revalidatePath(`/dashboard/${orgSlug}/finances`);
  return { ok: true };
}

/**
 * Émet un vrai reçu fiscal Cerfa pour un don (réutilise le système Lot 6) :
 * crée un `tax_receipts` numéroté, lie sa référence au don. Le PDF est
 * téléchargeable via /dashboard/[org]/factures/recus/[receiptId]/pdf.
 */
export async function issueDonationReceipt(
  orgId: string,
  orgSlug: string,
  donationId: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();

  const { data: don } = await supabase
    .from("donations")
    .select("id, donor_name, donor_person_id, donor_address, amount, received_at, donation_type, payment_method, tax_receipt_issued")
    .eq("id", donationId)
    .maybeSingle();
  if (!don) return { ok: false, error: "Don introuvable." };
  if (don.tax_receipt_issued) return { ok: false, error: "Un reçu a déjà été émis pour ce don." };

  const res = await createTaxReceipt({
    organization_id: orgId,
    donor_person_id: don.donor_person_id ?? null,
    donor_name: don.donor_name,
    donor_address: don.donor_address ?? null,
    amount: Number(don.amount),
    donation_date: don.received_at,
    donation_type: toCerfaDonationType(don.donation_type, don.payment_method),
    fiscal_year: new Date(don.received_at).getFullYear(),
    transaction_id: null,
  });
  if (!res.ok || !res.receipt) return { ok: false, error: res.error ?? "Échec de l'émission du reçu." };

  await supabase
    .from("donations")
    .update({ tax_receipt_issued: true, tax_receipt_ref: res.receipt.number, updated_at: new Date().toISOString() })
    .eq("id", donationId);

  revalidatePath(`/dashboard/${orgSlug}/dons`);
  return { ok: true, id: res.receipt.id };
}

// ── Écriture : campagne ──────────────────────────────────────────────────────

export async function saveDonationCampaign(
  orgId: string,
  orgSlug: string,
  input: DonationCampaignInput,
  id?: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const payload = {
    organization_id: orgId,
    title: input.title.trim(),
    slug: input.slug,
    description: input.description || null,
    goal_amount: input.goal_amount,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status,
    is_public: input.is_public,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { error } = await supabase.from("donation_campaigns").update(payload).eq("id", id);
    if (error) return { ok: false, error: humanError(error) };
    revalidatePath(`/dashboard/${orgSlug}/dons`);
    return { ok: true, id };
  }
  const { data, error } = await supabase
    .from("donation_campaigns")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/dons`);
  return { ok: true, id: data.id };
}

export async function deleteDonationCampaign(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("donation_campaigns").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/dons`);
  return { ok: true };
}

// ── Chaîne : mail groupé aux donateurs ──────────────────────────────────────

/**
 * Envoi groupé aux donateurs (remerciement, info campagne, appel à renouveler).
 * Cible : tous les dons d'une campagne, ou une sélection de dons.
 * Anti-doublon par email ; respecte le court-circuit démo de sendMail.
 */
export async function sendDonorsEmail(
  orgId: string,
  orgSlug: string,
  opts: { campaignId?: string | null; donationIds?: string[]; subject: string; message: string }
): Promise<ActionResult & { sent?: number }> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  if (!opts.subject.trim() || !opts.message.trim()) {
    return { ok: false, error: "Sujet et message obligatoires." };
  }
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  let q = db.from("donations").select("donor_email, donor_name").eq("organization_id", orgId);
  if (opts.campaignId) q = q.eq("campaign_id", opts.campaignId);
  if (opts.donationIds?.length) q = q.in("id", opts.donationIds);
  const { data } = await q;

  const recipients = Array.from(
    new Set(
      ((data as { donor_email: string | null }[] | null) ?? [])
        .map((d) => d.donor_email)
        .filter((e): e is string => !!e && e.includes("@"))
        .map((e) => e.trim().toLowerCase())
    )
  );
  if (recipients.length === 0) return { ok: false, error: "Aucun donateur avec email." };

  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#2C2C2C">${
    opts.message.replace(/\n/g, "<br>")
  }</div>`;

  // Envoi individuel (le destinataire ne voit pas les autres adresses)
  let sent = 0;
  for (const to of recipients) {
    const ok = await sendMail({
      to,
      subject: opts.subject,
      html,
      category: "dons",
      organizationId: orgId,
    });
    if (ok) sent++;
  }

  revalidatePath(`/dashboard/${orgSlug}/dons`);
  return { ok: true, sent };
}
