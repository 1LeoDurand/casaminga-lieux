"use client";

import { useState, useTransition } from "react";
import { Check, Wallet } from "lucide-react";
import { toast } from "sonner";
import { setPoleBudget } from "@/lib/pole-budgets";
import type { Pole } from "@/lib/types";

function fmtEuros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function Gauge({ allocated, spent, earned, color }: { allocated: number; spent: number; earned: number; color: string }) {
  const pct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
  const over = allocated > 0 && spent > allocated;
  const remaining = allocated - spent;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? "#dc2626" : color }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px]">
        <span className="text-warmgray">Alloué <b className="text-ink">{fmtEuros(allocated)}</b></span>
        <span className="text-red-600">Dépensé <b>{fmtEuros(spent)}</b></span>
        <span className="text-emerald-700">Encaissé <b>{fmtEuros(earned)}</b></span>
        <span className={`ml-auto font-semibold ${remaining < 0 ? "text-red-600" : "text-ink"}`}>
          Reste {fmtEuros(remaining)}
        </span>
      </div>
    </div>
  );
}

function PoleBudgetRow({ pole, year, orgId, orgSlug, allocated, spent, earned }: {
  pole: Pole; year: number; orgId: string; orgSlug: string;
  allocated: number; spent: number; earned: number;
}) {
  const [value, setValue] = useState(allocated ? String(allocated) : "");
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  function save() {
    const amount = parseFloat(value.replace(",", ".")) || 0;
    start(async () => {
      const res = await setPoleBudget(orgSlug, orgId, pole.id, year, amount);
      if (res.ok) { toast.success(`Budget ${pole.name} enregistré`); setDirty(false); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: pole.color }} />
        <span className="text-[13px] font-semibold text-ink">{pole.name}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] text-warmgray">Budget {year} :</span>
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); setDirty(true); }}
            inputMode="decimal" placeholder="0"
            className="w-24 rounded-lg border border-border bg-[#FAFAF7] px-2 py-1 text-right text-[13px] outline-none focus:border-coral"
          />
          <span className="text-[11px] text-warmgray">€</span>
          {dirty && (
            <button onClick={save} disabled={pending}
              className="rounded-lg bg-coral p-1.5 text-white hover:bg-coral-dark disabled:opacity-50" title="Enregistrer">
              <Check className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <Gauge allocated={parseFloat(value.replace(",", ".")) || 0} spent={spent} earned={earned} color={pole.color} />
    </div>
  );
}

export function PoleBudgetsPanel({ poles, year, orgId, orgSlug, budgets, financials }: {
  poles: Pole[]; year: number; orgId: string; orgSlug: string;
  budgets: Record<string, number>;
  financials: Record<string, { spent: number; earned: number }>;
}) {
  if (poles.length === 0) {
    return <p className="text-[13px] text-warmgray">Créez d&apos;abord des pôles pour leur allouer un budget.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-warmgray">
        <Wallet className="size-3.5" /> Exercice {year} · alloué vs. réalisé
      </div>
      {poles.map((p) => (
        <PoleBudgetRow
          key={p.id} pole={p} year={year} orgId={orgId} orgSlug={orgSlug}
          allocated={budgets[p.id] ?? 0}
          spent={financials[p.id]?.spent ?? 0}
          earned={financials[p.id]?.earned ?? 0}
        />
      ))}
    </div>
  );
}
