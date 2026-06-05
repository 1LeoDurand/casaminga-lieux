"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserX, Plus, X, Download } from "lucide-react";
import { toast } from "sonner";
import {
  getRegistrationsForEvent, addRegistrationManual,
  checkInRegistration, cancelRegistration,
  type EventRegistration,
} from "@/lib/registrations";
import type { Evenement } from "@/lib/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function Badge({ status }: { status: EventRegistration["status"] }) {
  const cls = status === "inscrit" ? "bg-emerald-100 text-emerald-700"
    : status === "liste_attente" ? "bg-amber-100 text-amber-700"
    : "bg-slate-100 text-slate-500";
  const label = status === "inscrit" ? "Inscrit" : status === "liste_attente" ? "Liste d'attente" : "Annulé";
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

export function EventRegistrationsPanel({ event, orgSlug, orgId }: {
  event: Evenement; orgSlug: string; orgId: string;
}) {
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSeats, setNewSeats] = useState("1");
  const [, startTransition] = useTransition();

  async function load() {
    if (loaded) return;
    setLoading(true);
    const data = await getRegistrationsForEvent(event.id);
    setRegistrations(data);
    setLoaded(true);
    setLoading(false);
  }

  function addManual() {
    if (!newName.trim() || !newEmail.trim()) { toast.error("Nom et email obligatoires."); return; }
    startTransition(async () => {
      const res = await addRegistrationManual(orgSlug, orgId, event.id, {
        full_name: newName, email: newEmail, phone: newPhone, seats: parseInt(newSeats) || 1,
      });
      if (res.ok) {
        toast.success("Inscription ajoutée ✓");
        setNewName(""); setNewEmail(""); setNewPhone(""); setNewSeats("1"); setAddOpen(false);
        const data = await getRegistrationsForEvent(event.id);
        setRegistrations(data);
      } else toast.error(res.error ?? "Erreur");
    });
  }

  function toggleCheckIn(reg: EventRegistration) {
    startTransition(async () => {
      const res = await checkInRegistration(orgSlug, reg.id, !reg.checked_in_at);
      if (res.ok) {
        setRegistrations((prev) => prev.map((r) =>
          r.id === reg.id ? { ...r, checked_in_at: reg.checked_in_at ? null : new Date().toISOString() } : r
        ));
      } else toast.error(res.error ?? "Erreur");
    });
  }

  function cancel(reg: EventRegistration) {
    if (!confirm(`Annuler l'inscription de ${reg.full_name} ?`)) return;
    startTransition(async () => {
      const res = await cancelRegistration(orgSlug, reg.id);
      if (res.ok) {
        setRegistrations((prev) => prev.map((r) => r.id === reg.id ? { ...r, status: "annule" } : r));
      } else toast.error(res.error ?? "Erreur");
    });
  }

  function exportCsv() {
    const rows = [["Nom", "Email", "Téléphone", "Places", "Statut", "Présence", "Date inscription"]];
    for (const r of registrations) {
      rows.push([r.full_name, r.email, r.phone ?? "", String(r.seats), r.status,
        r.checked_in_at ? "Oui" : "Non", fmtDate(r.created_at)]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `inscrits-${event.title.slice(0, 30)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const actifs = registrations.filter((r) => r.status === "inscrit");
  const attente = registrations.filter((r) => r.status === "liste_attente");
  const presences = registrations.filter((r) => !!r.checked_in_at);

  return (
    <div className="mt-4 border-t border-border pt-4">
      {!loaded ? (
        <button onClick={load} disabled={loading}
          className="text-[13px] font-semibold text-coral-dark hover:underline">
          {loading ? "Chargement…" : `📋 Voir les inscrits${event.capacity ? ` (${event.capacity} places)` : ""}`}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <span className="font-semibold text-emerald-700">{actifs.length} inscrits</span>
            {attente.length > 0 && <span className="font-semibold text-amber-600">{attente.length} en attente</span>}
            {event.capacity && <span className="text-warmgray">{event.capacity - actifs.length} places restantes</span>}
            <span className="text-warmgray">✅ {presences.length} présences</span>
            <button onClick={exportCsv} className="ml-auto flex items-center gap-1 text-warmgray hover:text-ink">
              <Download className="size-3.5" /> CSV
            </button>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 text-coral-dark hover:underline">
              <Plus className="size-3.5" /> Ajouter
            </button>
          </div>

          {/* Formulaire ajout manuel */}
          {addOpen && (
            <div className="rounded-xl border border-coral/30 bg-peach-pale p-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input className="mc-input flex-1" placeholder="Nom *" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                <input className="mc-input flex-1" placeholder="Email *" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <input className="mc-input flex-1" placeholder="Téléphone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                <input className="mc-input w-20" type="number" min={1} placeholder="Places" value={newSeats} onChange={(e) => setNewSeats(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAddOpen(false)} className="mc-btn mc-btn-outline mc-btn-sm"><X className="size-3.5" /></button>
                <button onClick={addManual} className="mc-btn mc-btn-lime mc-btn-sm">Ajouter</button>
              </div>
            </div>
          )}

          {/* Liste inscrits */}
          {registrations.length === 0 ? (
            <p className="text-[13px] text-warmgray">Aucune inscription pour le moment.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <ul className="divide-y divide-border">
                {registrations.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ink">{r.full_name}</div>
                      <div className="text-[11px] text-warmgray">{r.email}{r.phone ? ` · ${r.phone}` : ""}</div>
                    </div>
                    <Badge status={r.status} />
                    {r.status === "inscrit" && (
                      <button onClick={() => toggleCheckIn(r)}
                        className={`rounded-lg p-1.5 ${r.checked_in_at ? "bg-emerald-100 text-emerald-700" : "text-warmgray hover:bg-emerald-50 hover:text-emerald-600"}`}
                        title={r.checked_in_at ? "Marquer absent" : "Marquer présent"}>
                        <UserCheck className="size-4" />
                      </button>
                    )}
                    {r.status !== "annule" && (
                      <button onClick={() => cancel(r)} className="rounded-lg p-1.5 text-warmgray hover:text-red-600" title="Annuler">
                        <UserX className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
