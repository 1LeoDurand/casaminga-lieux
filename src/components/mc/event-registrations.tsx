"use client";

import { useState, useTransition } from "react";
import { UserCheck, Plus, X, Download, QrCode, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getTicketsForEvent, addRegistrationManual,
  checkInTicket, removeTicket,
  type EventTicket,
} from "@/lib/registrations";
import { getOrCreateScanLink } from "@/lib/tickets";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";
import type { Evenement } from "@/lib/types";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function EventRegistrationsPanel({ event, orgSlug, orgId }: {
  event: Evenement; orgSlug: string; orgId: string;
}) {
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [, startTransition] = useTransition();

  async function refresh() {
    const data = await getTicketsForEvent(event.id);
    setTickets(data);
  }
  async function load() {
    if (loaded) return;
    setLoading(true);
    await refresh();
    setLoaded(true);
    setLoading(false);
  }

  function openScanner() {
    startTransition(async () => {
      const res = await getOrCreateScanLink(orgSlug, orgId, event.id);
      if (res.ok && res.token) window.open(`${window.location.origin}/scan/${res.token}`, "_blank");
      else toast.error(res.error ?? "Erreur");
    });
  }
  function copyScanLink() {
    startTransition(async () => {
      const res = await getOrCreateScanLink(orgSlug, orgId, event.id);
      if (res.ok && res.token) {
        await navigator.clipboard.writeText(`${PUBLIC_SITE_BASE}/scan/${res.token}`);
        toast.success("Lien de scan copié — partagez-le aux bénévoles");
      } else toast.error(res.error ?? "Erreur");
    });
  }

  function addManual() {
    if (!newName.trim() || !newEmail.trim()) { toast.error("Nom et email obligatoires."); return; }
    startTransition(async () => {
      const res = await addRegistrationManual(orgSlug, orgId, event.id, { full_name: newName, email: newEmail });
      if (res.ok) {
        toast.success("Billet ajouté ✓");
        setNewName(""); setNewEmail(""); setAddOpen(false);
        await refresh();
      } else toast.error(res.error ?? "Erreur");
    });
  }

  function toggleCheckIn(t: EventTicket) {
    startTransition(async () => {
      const res = await checkInTicket(orgSlug, t.id, !t.checked_in_at);
      if (res.ok) setTickets((prev) => prev.map((x) => x.id === t.id ? { ...x, checked_in_at: t.checked_in_at ? null : new Date().toISOString() } : x));
      else toast.error(res.error ?? "Erreur");
    });
  }
  function remove(t: EventTicket) {
    if (!confirm(`Supprimer le billet de ${t.holder_name} ?`)) return;
    startTransition(async () => {
      const res = await removeTicket(orgSlug, t.id);
      if (res.ok) setTickets((prev) => prev.filter((x) => x.id !== t.id));
      else toast.error(res.error ?? "Erreur");
    });
  }

  function exportCsv() {
    const rows = [["Participant", "Email acheteur", "Présent", "Heure", "Billet"]];
    for (const t of tickets) rows.push([t.holder_name, t.email ?? "", t.checked_in_at ? "Oui" : "Non", t.checked_in_at ? fmtTime(t.checked_in_at) : "", t.ticket_token]);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `billets-${event.title.slice(0, 30)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const presents = tickets.filter((t) => !!t.checked_in_at).length;

  return (
    <div className="mt-4 border-t border-border pt-4">
      {!loaded ? (
        <button onClick={load} disabled={loading} className="text-[13px] font-semibold text-coral-dark hover:underline">
          {loading ? "Chargement…" : `🎟️ Voir les billets${event.capacity ? ` (${event.capacity} places)` : ""}`}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <span className="font-semibold text-emerald-700">{tickets.length} billets</span>
            {event.capacity && <span className="text-warmgray">{event.capacity - tickets.length} places restantes</span>}
            <span className="text-warmgray">✅ {presents} présents</span>
            <button onClick={exportCsv} className="ml-auto flex items-center gap-1 text-warmgray hover:text-ink">
              <Download className="size-3.5" /> CSV
            </button>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 text-coral-dark hover:underline">
              <Plus className="size-3.5" /> Ajouter
            </button>
          </div>

          {/* Scan billets QR */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            <QrCode className="size-4 text-slate-500" />
            <span className="text-[12px] font-semibold text-slate-700">Scanner les billets à l&apos;entrée</span>
            <button onClick={openScanner} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-700">
              <ExternalLink className="size-3.5" /> Ouvrir le scanner
            </button>
            <button onClick={copyScanLink} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-slate-400" title="Lien à partager aux bénévoles (sans compte)">
              <Copy className="size-3.5" /> Copier le lien bénévole
            </button>
          </div>

          {/* Ajout manuel */}
          {addOpen && (
            <div className="flex gap-2 rounded-xl border border-coral/30 bg-peach-pale p-3">
              <input className="mc-input flex-1" placeholder="Nom du participant *" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <input className="mc-input flex-1" placeholder="Email *" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <button onClick={() => setAddOpen(false)} className="mc-btn mc-btn-outline mc-btn-sm"><X className="size-3.5" /></button>
              <button onClick={addManual} className="mc-btn mc-btn-lime mc-btn-sm">Ajouter</button>
            </div>
          )}

          {/* Liste billets */}
          {tickets.length === 0 ? (
            <p className="text-[13px] text-warmgray">Aucun billet pour le moment.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <ul className="divide-y divide-border">
                {tickets.map((t) => (
                  <li key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${t.checked_in_at ? "bg-emerald-50/40" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ink">{t.holder_name}</div>
                      <div className="text-[11px] text-warmgray">
                        {t.email ?? "—"}{t.checked_in_at ? ` · ✅ entré à ${fmtTime(t.checked_in_at)}` : ""}
                      </div>
                    </div>
                    <button onClick={() => toggleCheckIn(t)}
                      className={`rounded-lg p-1.5 ${t.checked_in_at ? "bg-emerald-100 text-emerald-700" : "text-warmgray hover:bg-emerald-50 hover:text-emerald-600"}`}
                      title={t.checked_in_at ? "Marquer absent" : "Marquer présent"}>
                      <UserCheck className="size-4" />
                    </button>
                    <button onClick={() => remove(t)} className="rounded-lg p-1.5 text-warmgray hover:text-red-600" title="Supprimer">
                      <Trash2 className="size-4" />
                    </button>
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
