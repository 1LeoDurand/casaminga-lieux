"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import type { Evenement } from "@/lib/types";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // lundi = 0
  const d = new Date(first);
  d.setDate(1 - dow);
  return d;
}
function hourLabel(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, "0") : ""}`;
}

const TYPE_COLOR: Record<string, string> = {
  atelier: "#4DB6AC", concert: "#BA68C8", exposition: "#F06292",
  conference: "#7986CB", marche: "#81C784", autre: "#FF8A65",
};
const STATUS_DIM: Record<string, number> = { brouillon: 0.45, publie: 1, annule: 0.3 };

export function EventCalendar({ evenements, onSelect }: {
  evenements: Evenement[];
  onSelect: (e: Evenement) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const byDay = useMemo(() => {
    const map = new Map<string, Evenement[]>();
    for (const e of evenements) {
      const key = ymd(new Date(e.start_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_at.localeCompare(b.start_at));
    return map;
  }, [evenements]);

  const gridStart = startOfMonthGrid(cursor.year, cursor.month);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const todayKey = ymd(today);

  function prev() {
    setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  }
  function next() {
    setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
  }
  function goToday() {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      {/* En-tête navigation */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <h3 className="font-heading text-base font-bold text-ink">
          {MONTHS[cursor.month]} {cursor.year}
        </h3>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={goToday} className="mr-1 rounded-lg border border-border px-2.5 py-1 text-[12px] font-semibold text-warmgray hover:border-coral/40">
            Aujourd&apos;hui
          </button>
          <button onClick={prev} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40"><ChevronLeft className="size-4" /></button>
          <button onClick={next} className="rounded-lg border border-border p-1.5 text-warmgray hover:border-coral/40"><ChevronRight className="size-4" /></button>
        </div>
      </div>

      {/* En-têtes jours */}
      <div className="grid grid-cols-7 border-b border-border bg-cream">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-warmgray">{d}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === cursor.month;
          const isToday = key === todayKey;
          const items = byDay.get(key) ?? [];
          return (
            <div key={i}
              className={`min-h-[96px] border-b border-r border-border p-1.5 ${inMonth ? "bg-white" : "bg-slate-50/60"} ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}>
              <div className={`mb-1 flex items-center justify-center text-[12px] ${isToday ? "" : inMonth ? "text-ink" : "text-warmgray/50"}`}>
                <span className={isToday ? "flex size-6 items-center justify-center rounded-full bg-coral font-bold text-white" : "font-medium"}>
                  {d.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {items.slice(0, 3).map((e) => (
                  <button key={e.id} onClick={() => onSelect(e)}
                    title={`${hourLabel(e.start_at)} · ${e.title}`}
                    className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: TYPE_COLOR[e.type] ?? "#FF8A65", opacity: STATUS_DIM[e.status] ?? 1 }}>
                    {e.show_on_public_site && <Globe className="size-2.5 shrink-0" />}
                    <span className="truncate">{hourLabel(e.start_at)} {e.title}</span>
                  </button>
                ))}
                {items.length > 3 && (
                  <span className="px-1 text-[10px] font-semibold text-warmgray">+{items.length - 3} autre{items.length - 3 > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-2.5 text-[11px] text-warmgray">
        <span className="flex items-center gap-1"><Globe className="size-3" /> Visible sur le site public</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "#FF8A65", opacity: 0.45 }} /> Brouillon</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "#4DB6AC" }} /> Publié</span>
        <span className="ml-auto">Cliquez un événement pour le détail</span>
      </div>
    </div>
  );
}
