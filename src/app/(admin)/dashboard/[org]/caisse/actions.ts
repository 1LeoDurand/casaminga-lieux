"use server";
import { revalidatePath } from "next/cache";
import {
  addCashEntry, voidCashEntry, closeCashRegister, verifyCashChain,
  getCashEntries, getOrganizationBySlug, createTransaction,
  type CashEntryInput,
} from "@/lib/data";
import type { CashEntry, CashClosureType } from "@/lib/types";

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
