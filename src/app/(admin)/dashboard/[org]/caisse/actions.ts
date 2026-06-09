"use server";
import { revalidatePath } from "next/cache";
import {
  addCashEntry, voidCashEntry, closeCashRegister, verifyCashChain,
  getCashEntries, getOrganizationBySlug, createTransaction, getPersonsForOrg,
  saveCashShortcuts,
  type CashEntryInput,
} from "@/lib/data";
import type { CashShortcut } from "@/lib/types";
import type { CashEntry, CashClosureType } from "@/lib/types";
import { saveInvoice, type InvoiceInput } from "@/app/(admin)/dashboard/[org]/factures/actions";
import type { PaymentMethod } from "@/lib/invoicing/types";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/caisse`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function addCashEntryAction(
  orgSlug: string,
  input: CashEntryInput,
  receipt?: { email: string; name?: string }
) {
  const res = await addCashEntry(input);
  if (res.ok) {
    refresh(orgSlug);
    // Reçu par email (optionnel, non bloquant) — ne touche pas le registre immuable.
    if (receipt?.email) {
      void (async () => {
        try {
          const entries = await getCashEntries(input.organization_id, 5);
          // L'écriture qu'on vient de créer = seq max
          const latest = entries.reduce<CashEntry | null>(
            (max, e) => (!max || e.seq > max.seq ? e : max), null
          );
          if (!latest) return;
          const [org, { sendMail }, { tplCaisseRecu }] = await Promise.all([
            getOrganizationBySlug(orgSlug),
            import("@/lib/mail"),
            import("@/lib/mail-templates"),
          ]);
          await sendMail({
            to: receipt.email,
            subject: `Reçu ${latest.ticket_ref} · ${org?.name ?? "Casa Minga Lieux"}`,
            html: tplCaisseRecu({
              orgName: org?.name ?? "Casa Minga Lieux",
              contactName: receipt.name,
              ticketRef: latest.ticket_ref,
              label: latest.label,
              amountTtc: latest.amount_ttc,
              paymentMethod: latest.payment_method,
              occurredAt: latest.occurred_at,
            }),
            category: "recu",
            organizationId: input.organization_id,
          });
        } catch (e) {
          console.error("[reçu caisse] échec envoi:", e);
        }
      })();
    }
  }
  return res;
}

export async function voidCashEntryAction(orgSlug: string, orgId: string, target: CashEntry, operator: string, reason: string) {
  const res = await voidCashEntry(orgId, target, operator, reason);
  if (res.ok) refresh(orgSlug);
  return res;
}

export async function closeCashRegisterAction(
  orgSlug: string,
  orgId: string,
  type: CashClosureType,
  operator: string,
  openingFloat?: number | null,
  countedCash?: number | null,
) {
  const res = await closeCashRegister(orgId, type, operator, openingFloat, countedCash);
  if (!res.ok) return res;

  refresh(orgSlug);

  // Pont Caisse → Trésorerie : seule la clôture journalière (Z) crée une recette.
  // Les clôtures mois/année agrègent des jours déjà comptabilisés → pas de double comptage.
  if (type === "jour" && res.closure) {
    const c = res.closure;
    const net = Number(c.total_ttc);
    if (net !== 0) {
      await createTransaction({
        organization_id: orgId,
        person_id: null,
        type: "recette",
        category: "Encaissements caisse",
        amount: net,
        date: c.period_end.slice(0, 10),
        label: `Clôture Z — ${c.period_label}`,
        status: "validee",
        notes: `${c.entry_count} écriture(s) · sceau ${c.closure_hash?.slice(0, 8) ?? "—"}`,
        cash_closure_id: c.id,
      });
      revalidatePath(`/dashboard/${orgSlug}/finances`);
    }
  }

  return res;
}

export async function verifyCashChainAction(orgId: string) {
  return verifyCashChain(orgId);
}

/** Sauvegarde les raccourcis rapides configurés pour l'org. */
export async function saveCashShortcutsAction(
  orgId: string,
  orgSlug: string,
  shortcuts: CashShortcut[],
): Promise<{ ok: boolean }> {
  const ok = await saveCashShortcuts(orgId, shortcuts);
  if (ok) revalidatePath(`/dashboard/${orgSlug}/caisse`);
  return { ok };
}

// ── Caisse → Facture brouillon ────────────────────────────────
/** Crée une facture brouillon pré-remplie depuis une écriture de caisse.
 *  Renvoie { ok, id } — le client peut then naviguer vers /factures/${id}/modifier.
 */
export async function createInvoiceFromCashEntryAction(
  orgSlug: string,
  orgId: string,
  entry: CashEntry,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // Résoudre le client si lié
  let clientName = "";
  let clientEmail: string | null = null;
  let clientId: string | null = null;
  if (entry.person_id) {
    const persons = await getPersonsForOrg(orgId);
    const person = persons.find((p) => p.id === entry.person_id);
    if (person) {
      clientName = person.name;
      clientEmail = person.email ?? null;
      clientId = person.id;
    }
  }

  // Mapping mode de paiement caisse → facturation
  const pmMap: Record<string, PaymentMethod> = {
    especes: "cash",
    cb: "carte",
    cheque: "cheque",
    virement: "virement",
  };
  const paymentMethod: PaymentMethod | null = pmMap[entry.payment_method] ?? null;

  const input: InvoiceInput = {
    client_id: clientId,
    client_name: clientName,
    client_email: clientEmail,
    client_address: null,
    issue_date: entry.occurred_at.slice(0, 10),
    due_date: entry.occurred_at.slice(0, 10),
    lines: [
      {
        designation: entry.label,
        qty: 1,
        unit_ht: Number(entry.amount_ht),
        vat_rate: Number(entry.vat_rate),
      },
    ],
    vat_applicable: Number(entry.vat_rate) > 0,
    notes: `Généré depuis caisse — ticket ${entry.ticket_ref}`,
    object: entry.label,
    reference: entry.ticket_ref,
    pole: null,
    pole_id: entry.pole_id,
    payment_method: paymentMethod,
    paid_at: entry.occurred_at.slice(0, 10),
  };

  const result = await saveInvoice(orgId, orgSlug, input);
  return result;
}
