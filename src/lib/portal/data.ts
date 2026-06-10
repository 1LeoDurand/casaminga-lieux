/**
 * Couche données du portail adhérent.
 * Lecture multi-org par email (service-role, pas de RLS).
 * Server-only — jamais importé côté client.
 */
import "server-only";
import { createAdminClient } from "@/lib/admin/guard";
import { normalizeEmail } from "@/lib/portal/token";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdhesionStatus = "active" | "expire_bientot" | "expiree" | "en_attente" | "aucune";

export interface PortalAdhesion {
  id: string;
  status: string;            // status raw de membership_applications
  derivedStatus: AdhesionStatus;
  tierName: string | null;
  amount: number;
  membershipStart: string | null;
  membershipEnd: string | null;
}

export interface PortalBillet {
  ticketToken: string;
  holderName: string;
  eventTitle: string;
  eventStartAt: string;
  eventSlug: string | null;
}

export interface PortalRecu {
  id: string;
  number: string | null;
  year: number;
  amount: number;
  donationDate: string;
}

export interface PortalOrgData {
  orgId: string;
  orgSlug: string;
  orgName: string;
  displayName: string;        // nom de la fiche persons si disponible, sinon orgName
  adhesion: PortalAdhesion | null;
  billets: PortalBillet[];
  recus: PortalRecu[];
  activeCampaignSlug: string | null;  // slug pour le lien renouvellement
}

export interface PortalData {
  email: string;
  orgs: PortalOrgData[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(
  status: string,
  membershipEnd: string | null
): AdhesionStatus {
  if (status === "en_attente") return "en_attente";
  if (status !== "validee") return "aucune";
  if (!membershipEnd) return "active";
  const end = new Date(membershipEnd);
  const now = new Date();
  const daysLeft = (end.getTime() - now.getTime()) / 86_400_000;
  if (daysLeft < 0) return "expiree";
  if (daysLeft <= 30) return "expire_bientot";
  return "active";
}

// ── Requête principale ────────────────────────────────────────────────────────

/**
 * Agrège toutes les données d'un adhérent par email, toutes orgs confondues.
 * Retourne null si Supabase n'est pas configuré (mode démo).
 */
export async function getPortalDataByEmail(
  rawEmail: string
): Promise<PortalData | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const email = normalizeEmail(rawEmail);

  // ── 1. Collecter tous les org_ids qui contiennent cet email ──────────────
  const [personsRes, adhesionsRes, billetsRes] = await Promise.all([
    admin
      .from("persons")
      .select("id, organization_id, name")
      .ilike("email", email)
      .is("anonymized_at", null),
    admin
      .from("membership_applications")
      .select("id, organization_id, tier_id, status, membership_start, membership_end, amount_paid, first_name, last_name, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false }),
    admin
      .from("event_registrations")
      .select("ticket_token, full_name, event_id, organization_id, checked_in_at")
      .ilike("email", email),
  ]);

  const allOrgIds = new Set<string>();
  for (const p of personsRes.data ?? []) allOrgIds.add(p.organization_id);
  for (const a of adhesionsRes.data ?? []) allOrgIds.add(a.organization_id);
  for (const b of billetsRes.data ?? []) allOrgIds.add(b.organization_id);

  if (allOrgIds.size === 0) return { email, orgs: [] };

  const orgIds = Array.from(allOrgIds);

  // Index persons IDs par org (pour la jointure tax_receipts via donor_person_id)
  const personIdsByOrg = new Map<string, string[]>();
  const allPersonIds: string[] = [];
  for (const p of personsRes.data ?? []) {
    if (!personIdsByOrg.has(p.organization_id)) personIdsByOrg.set(p.organization_id, []);
    personIdsByOrg.get(p.organization_id)!.push(p.id);
    allPersonIds.push(p.id);
  }

  // ── 2. Infos orgs ─────────────────────────────────────────────────────────
  const [orgsRes, tiersRes, campaignsRes, eventsRes, taxReceiptsRes] = await Promise.all([
    admin
      .from("organizations")
      .select("id, slug, name")
      .in("id", orgIds),
    // Tous les tiers des orgs concernées
    admin
      .from("membership_tiers")
      .select("id, name, organization_id")
      .in("organization_id", orgIds),
    // Campagnes actives (pour le lien renouvellement)
    admin
      .from("membership_campaigns")
      .select("id, slug, organization_id")
      .in("organization_id", orgIds)
      .eq("status", "publie"),
    // Événements à venir cités dans les billets
    (() => {
      const eventIds = [...new Set((billetsRes.data ?? []).map((b) => b.event_id))];
      if (!eventIds.length) return Promise.resolve({ data: [] });
      return admin
        .from("evenements")
        .select("id, title, start_at, slug")
        .in("id", eventIds)
        .gte("start_at", new Date().toISOString());
    })(),
    // Reçus fiscaux via donor_person_id (tax_receipts n'a pas de colonne email)
    (() => {
      if (!allPersonIds.length) return Promise.resolve({ data: [] });
      return admin
        .from("tax_receipts")
        .select("id, number, fiscal_year, amount, donation_date, donor_person_id, organization_id")
        .in("donor_person_id", allPersonIds)
        .order("donation_date", { ascending: false });
    })(),
  ]);

  const orgsMap = new Map(
    (orgsRes.data ?? []).map((o) => [o.id, o])
  );
  const tiersMap = new Map(
    (tiersRes.data ?? []).map((t) => [t.id, t])
  );
  // campagnes : première active par org
  const campaignByOrg = new Map<string, string>();
  for (const c of campaignsRes.data ?? []) {
    if (!campaignByOrg.has(c.organization_id)) {
      campaignByOrg.set(c.organization_id, c.slug);
    }
  }
  const eventsMap = new Map(
    (eventsRes.data ?? []).map((e) => [e.id, e])
  );

  // ── 3. Fiche de nom par org (persons) ─────────────────────────────────────
  const displayNameByOrg = new Map<string, string>();
  for (const p of personsRes.data ?? []) {
    if (!displayNameByOrg.has(p.organization_id) && p.name) {
      displayNameByOrg.set(p.organization_id, p.name);
    }
  }

  // ── 4. Assembler par org ──────────────────────────────────────────────────
  const result: PortalOrgData[] = [];

  for (const orgId of orgIds) {
    const org = orgsMap.get(orgId);
    if (!org) continue;

    // Dernière adhésion (déjà triée desc par created_at)
    const adhesionRow = (adhesionsRes.data ?? []).find(
      (a) => a.organization_id === orgId
    );
    let adhesion: PortalAdhesion | null = null;
    if (adhesionRow) {
      const tier = adhesionRow.tier_id ? tiersMap.get(adhesionRow.tier_id) : null;
      adhesion = {
        id: adhesionRow.id,
        status: adhesionRow.status,
        derivedStatus: deriveStatus(adhesionRow.status, adhesionRow.membership_end),
        tierName: tier?.name ?? null,
        amount: Number(adhesionRow.amount_paid),
        membershipStart: adhesionRow.membership_start,
        membershipEnd: adhesionRow.membership_end,
      };
    }

    // Billets à venir pour cette org
    const billets: PortalBillet[] = [];
    for (const b of billetsRes.data ?? []) {
      if (b.organization_id !== orgId) continue;
      const ev = eventsMap.get(b.event_id);
      if (!ev) continue; // filtré par gte(now) au-dessus — pas dans la map = passé
      billets.push({
        ticketToken: b.ticket_token,
        holderName: b.full_name ?? "",
        eventTitle: ev.title,
        eventStartAt: ev.start_at,
        eventSlug: ev.slug ?? null,
      });
    }
    billets.sort(
      (a, b) => new Date(a.eventStartAt).getTime() - new Date(b.eventStartAt).getTime()
    );

    // Reçus fiscaux pour cette org (via donor_person_id → person.email)
    const orgPersonIds = new Set(personIdsByOrg.get(orgId) ?? []);
    const recus: PortalRecu[] = (taxReceiptsRes.data ?? [])
      .filter((r) => r.donor_person_id && orgPersonIds.has(r.donor_person_id))
      .map((r) => ({
        id: r.id,
        number: r.number,
        year: r.fiscal_year,
        amount: Number(r.amount),
        donationDate: r.donation_date,
      }));

    result.push({
      orgId,
      orgSlug: org.slug,
      orgName: org.name,
      displayName: displayNameByOrg.get(orgId) ?? org.name,
      adhesion,
      billets,
      recus,
      activeCampaignSlug: campaignByOrg.get(orgId) ?? null,
    });
  }

  // Trier les orgs : celles avec adhésion active en premier
  result.sort((a, b) => {
    const rank = (o: PortalOrgData) => {
      if (!o.adhesion) return 3;
      if (o.adhesion.derivedStatus === "active") return 0;
      if (o.adhesion.derivedStatus === "expire_bientot") return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });

  return { email, orgs: result };
}

/**
 * Vérifie rapidement si un email a du contenu rattaché (gate anti-énumération).
 * Retourne false si Supabase n'est pas configuré.
 */
export async function emailHasPortalContent(rawEmail: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const email = normalizeEmail(rawEmail);

  const [p, a, b] = await Promise.all([
    admin
      .from("persons")
      .select("id", { count: "exact", head: true })
      .ilike("email", email)
      .is("anonymized_at", null),
    admin
      .from("membership_applications")
      .select("id", { count: "exact", head: true })
      .ilike("email", email),
    admin
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .ilike("email", email),
  ]);

  return ((p.count ?? 0) + (a.count ?? 0) + (b.count ?? 0)) > 0;
}
