"use server";
import { revalidatePath } from "next/cache";
import {
  addCashEntry, voidCashEntry, closeCashRegister, verifyCashChain,
  type CashEntryInput,
} from "@/lib/data";
import type { CashEntry, CashClosureType } from "@/lib/types";

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/caisse`);
  revalidatePath(`/dashboard/${orgSlug}`);
}

export async function addCashEntryAction(orgSlug: string, input: CashEntryInput) {
  const res = await addCashEntry(input);
  if (res.ok) refresh(orgSlug);
  return res;
}

export async function voidCashEntryAction(orgSlug: string, orgId: string, target: CashEntry, operator: string, reason: string) {
  const res = await voidCashEntry(orgId, target, operator, reason);
  if (res.ok) refresh(orgSlug);
  return res;
}

export async function closeCashRegisterAction(orgSlug: string, orgId: string, type: CashClosureType, operator: string) {
  const res = await closeCashRegister(orgId, type, operator);
  if (res.ok) refresh(orgSlug);
  return res;
}

export async function verifyCashChainAction(orgId: string) {
  return verifyCashChain(orgId);
}
