import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getTransactionsForOrg,
  getEvenementsForOrg,
  getReservationsForOrg,
  getResidencesForOrg,
  getMembershipApplicationsForOrg,
  getImpactIndicatorsForOrg,
  getGrantsForOrg,
  getPersonsForOrg,
} from "@/lib/data";
import type {
  CoordinationNote,
  NoteSnapshot,
  SectionKey,
  FinanceSnapshot,
  EventsSnapshot,
  ResidencesSnapshot,
  ImpactSnapshot,
} from "./types";

// Compare la portion date (yyyy-mm-dd) — bornes incluses.
function inPeriod(d: string | null | undefined, start: string, end: string): boolean {
  if (!d) return false;
  const day = d.slice(0, 10);
  return day >= start && day <= end;
}

// ── Lecture des notes ─────────────────────────────────────────────────────

export async function getCoordinationNotes(orgId: string): Promise<CoordinationNote[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("coordination_notes")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_start", { ascending: false });
  return (data as CoordinationNote[] | null) ?? [];
}

export async function getCoordinationNote(id: string): Promise<CoordinationNote | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("coordination_notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as CoordinationNote | null) ?? null;
}

// ── Agrégation : snapshot des données sur une période ─────────────────────

/**
 * Construit le snapshot des données pour les blocs demandés, sur [start, end].
 * Les données sont *figées* dans la note à la génération (et au rafraîchissement).
 */
export async function buildSnapshot(
  orgId: string,
  start: string,
  end: string,
  keys: SectionKey[],
): Promise<NoteSnapshot> {
  const snap: NoteSnapshot = {};
  const want = new Set(keys);

  if (want.has("finances")) {
    const tx = await getTransactionsForOrg(orgId);
    const inRange = tx.filter((t) => inPeriod(t.date, start, end));
    let recettes = 0, depenses = 0;
    const byCat = new Map<string, { recettes: number; depenses: number }>();
    for (const t of inRange) {
      const amt = Number(t.amount);
      const cat = t.category || "Autre";
      const e = byCat.get(cat) ?? { recettes: 0, depenses: 0 };
      if (t.type === "recette") { recettes += amt; e.recettes += amt; }
      else { depenses += amt; e.depenses += amt; }
      byCat.set(cat, e);
    }
    const fin: FinanceSnapshot = {
      recettes, depenses, solde: recettes - depenses, count: inRange.length,
      byCategory: Array.from(byCat.entries())
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => (b.recettes + b.depenses) - (a.recettes + a.depenses)),
    };
    snap.finances = fin;
  }

  if (want.has("events")) {
    const [evts, resas] = await Promise.all([
      getEvenementsForOrg(orgId),
      getReservationsForOrg(orgId),
    ]);
    const ev: EventsSnapshot = {
      events: evts
        .filter((e) => inPeriod(e.start_at, start, end))
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
        .map((e) => ({ title: e.title, date: e.start_at, status: e.status, type: e.type })),
      reservations: resas
        .filter((r) => inPeriod(r.start_at, start, end))
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
        .map((r) => ({ title: r.title ?? "Réservation", date: r.start_at, status: r.status, price: r.price })),
    };
    snap.events = ev;
  }

  if (want.has("residences")) {
    const [res, apps] = await Promise.all([
      getResidencesForOrg(orgId),
      getMembershipApplicationsForOrg(orgId),
    ]);
    const activeStatus = new Set(["candidature", "acceptee", "en_cours"]);
    const residences = res
      .filter((r) => {
        const intersect =
          (r.start_date ?? "9999") <= end && (r.end_date ?? "0000") >= start;
        return intersect || activeStatus.has(r.status);
      })
      .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
      .map((r) => ({ title: r.title, discipline: r.discipline, status: r.status, start: r.start_date, end: r.end_date }));

    const newApps = apps.filter((a) => inPeriod(a.created_at, start, end));
    const adhesions = {
      count: newApps.length,
      total: newApps.reduce((s, a) => s + Number(a.amount_paid || 0), 0),
      newMembers: newApps
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((a) => ({ name: `${a.first_name} ${a.last_name}`.trim(), date: a.created_at })),
    };
    const r: ResidencesSnapshot = { residences, adhesions };
    snap.residences = r;
  }

  if (want.has("impact")) {
    const [indicators, grants] = await Promise.all([
      getImpactIndicatorsForOrg(orgId),
      getGrantsForOrg(orgId),
    ]);
    // Dons : requête directe (pas de getter dédié dans data.ts)
    const supabase = await createClient();
    const { data: dons } = await supabase
      .from("donations")
      .select("donor_name, amount, donation_type, received_at, payment_status")
      .eq("organization_id", orgId);
    const donsInRange = ((dons as { donor_name: string; amount: number; donation_type: string; received_at: string; payment_status: string }[] | null) ?? [])
      .filter((d) => d.payment_status === "confirme" && inPeriod(d.received_at, start, end));

    const imp: ImpactSnapshot = {
      indicators: indicators.map((i) => ({ label: i.label, value: Number(i.value), unit: i.unit, period: i.period, category: i.category })),
      donations: {
        count: donsInRange.length,
        total: donsInRange.reduce((s, d) => s + Number(d.amount), 0),
        list: donsInRange
          .sort((a, b) => a.received_at.localeCompare(b.received_at))
          .map((d) => ({ donor: d.donor_name, amount: Number(d.amount), type: d.donation_type, date: d.received_at })),
      },
      grants: grants
        .filter((g) => g.status === "en_cours" || g.status === "accordee")
        .map((g) => ({ title: g.title, funder: g.funder, amount: Number(g.amount), received: Number(g.amount_received), status: g.status })),
    };
    snap.impact = imp;
  }

  // getPersonsForOrg importé pour usage futur (cohérence) — évite un import mort.
  void getPersonsForOrg;

  return snap;
}
