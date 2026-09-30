/**
 * Couche données du portail adhérent.
 * Lecture multi-org par email (service-role, pas de RLS).
 * Server-only : jamais importé côté client.
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

/** Registration on the waiting list: no ticket yet, so no link. */
export interface PortalAttente {
  eventTitle: string;
  eventStartAt: string;
  seats: number;
}

export interface PortalRecu {
  id: string;
  number: string | null;
  year: number;
  amount: number;
  donationDate: string;
}

export type FactureStatus = "payee" | "a_regler" | "en_retard" | "declaree";

export interface PortalFacture {
  id: string;
  number: string | null;
  object: string | null;
  amountTtc: number;
  dueDate: string | null;
  issueDate: string | null;
  derivedStatus: FactureStatus;
  /** Le client peut encore déclarer un paiement (ni payée, ni déjà déclarée). */
  canDeclare: boolean;
}

/** Réservation d'espace à venir (salle, bureau), annulable depuis l'espace. */
export interface PortalReservation {
  id: string;
  title: string | null;
  spaceName: string | null;
  startAt: string;
  endAt: string | null;
  status: string;            // "demandee" ou "confirmee"
}

interface TicketLite {
  registration_id: string | null;
  holder_name: string;
  ticket_token: string;
  event_id: string;
  payment_status: string | null;
  created_at: string;
}

export interface PortalOrgData {
  orgId: string;
  orgSlug: string;
  orgName: string;
  displayName: string;        // nom de la fiche persons si disponible, sinon orgName
  adhesion: PortalAdhesion | null;
  billets: PortalBillet[];
  attente: PortalAttente[];
  recus: PortalRecu[];
  factures: PortalFacture[];
  reservations: PortalReservation[];
  activeCampaignSlug: string | null;  // slug pour le lien renouvellement
}

export interface PortalData {
  email: string;
  orgs: PortalOrgData[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Motif ILIKE qui ne correspond qu'à ce courriel. ILIKE sert ici à ignorer la
 * casse, mais "_" et "%" y sont des jokers : sans échappement, le jeton de
 * a_b@exemple.fr ouvrirait aussi les données de axb@exemple.fr.
 */
export function exactEmailPattern(email: string): string {
  return email.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Seconde barrière, côté code : ne garder que les lignes dont le courriel est
 * exactement celui du jeton. Elle couvre ce que l'échappement ne couvre pas
 * (PostgREST traduit aussi "*" en joker).
 */
function sameEmail(value: string | null | undefined, email: string): boolean {
  return normalizeEmail(value ?? "") === email;
}

function deriveStatus(
  status: string,
  membershipEnd: string | null
): AdhesionStatus {
  if (status === "en_attente") return "en_attente";
  // Le statut d'une adhésion validée est "confirmee" (cf. MembershipApplicationStatus).
  // "validee" existe pour les demandes et les transactions, PAS ici.
  if (status !== "confirmee") return "aucune";
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
  const pattern = exactEmailPattern(email);

  // ── 1. Collecter tous les org_ids qui contiennent cet email ──────────────
  const [personsRes, adhesionsRes, billetsRes, facturesRes] = await Promise.all([
    admin
      .from("persons")
      .select("id, organization_id, name, email")
      .ilike("email", pattern)
      .is("anonymized_at", null),
    admin
      .from("membership_applications")
      .select("id, organization_id, tier_id, status, membership_start, membership_end, amount_paid, first_name, last_name, created_at, email")
      .ilike("email", pattern)
      .order("created_at", { ascending: false }),
    admin
      .from("event_registrations")
      .select("id, ticket_token, full_name, event_id, organization_id, email, status, seats")
      .in("status", ["inscrit", "liste_attente"]) // cancelled ones never show up
      .ilike("email", pattern),
    // Factures émises au nom de cet email. Les brouillons et annulées ne
    // concernent pas le client ; les avoirs sont des pièces comptables internes.
    admin
      .from("invoices")
      .select("id, organization_id, number, object, total_ttc, status, due_date, issue_date, payment_declared_at, client_email")
      .ilike("client_email", pattern)
      .eq("kind", "facture")
      .not("status", "in", "(brouillon,annulee)")
      .order("issue_date", { ascending: false }),
  ]);

  const personsRows = (personsRes.data ?? []).filter((r) => sameEmail(r.email, email));
  const adhesionsRows = (adhesionsRes.data ?? []).filter((r) => sameEmail(r.email, email));
  const billetsRows = (billetsRes.data ?? []).filter((r) => sameEmail(r.email, email));

  // Tickets live in event_tickets (one per participant), linked by
  // registration_id. The legacy event_registrations.ticket_token is only
  // trusted when it matches an existing ticket of the same event.
  const confirmedRows = billetsRows.filter((r) => r.status === "inscrit");
  const regIds = confirmedRows.map((r) => r.id);
  const legacyTokens = confirmedRows.map((r) => r.ticket_token).filter((t): t is string => !!t);
  const [ticketsByRegRes, ticketsByTokenRes] = await Promise.all([
    regIds.length
      ? admin
          .from("event_tickets")
          .select("registration_id, holder_name, ticket_token, event_id, payment_status, created_at")
          .in("registration_id", regIds)
      : Promise.resolve({ data: [] as TicketLite[] }),
    legacyTokens.length
      ? admin
          .from("event_tickets")
          .select("registration_id, holder_name, ticket_token, event_id, payment_status, created_at")
          .in("ticket_token", legacyTokens)
      : Promise.resolve({ data: [] as TicketLite[] }),
  ]);
  const ticketsByReg = new Map<string, TicketLite[]>();
  for (const t of (ticketsByRegRes.data ?? []) as TicketLite[]) {
    if (!t.registration_id) continue;
    if (!ticketsByReg.has(t.registration_id)) ticketsByReg.set(t.registration_id, []);
    ticketsByReg.get(t.registration_id)!.push(t);
  }
  const ticketsByToken = new Map<string, TicketLite>(
    ((ticketsByTokenRes.data ?? []) as TicketLite[]).map((t) => [t.ticket_token, t])
  );
  /** Tickets to show for a confirmed registration ([] = no link at all). */
  const ticketsOf = (r: { id: string; ticket_token: string | null; event_id: string }): TicketLite[] => {
    const linked = ticketsByReg.get(r.id);
    const list = linked?.length
      ? linked
      : (() => {
          const legacy = r.ticket_token ? ticketsByToken.get(r.ticket_token) : undefined;
          return legacy && legacy.event_id === r.event_id ? [legacy] : [];
        })();
    // Unpaid tickets (online payment pending) have no valid QR yet.
    return list
      .filter((t) => t.payment_status !== "pending")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  };
  const facturesRows = (facturesRes.data ?? []).filter((r) => sameEmail(r.client_email, email));

  const allOrgIds = new Set<string>();
  for (const p of personsRows) allOrgIds.add(p.organization_id);
  for (const a of adhesionsRows) allOrgIds.add(a.organization_id);
  for (const b of billetsRows) allOrgIds.add(b.organization_id);
  for (const f of facturesRows) allOrgIds.add(f.organization_id);

  if (allOrgIds.size === 0) return { email, orgs: [] };

  const orgIds = Array.from(allOrgIds);

  // Index persons IDs par org (pour la jointure tax_receipts via donor_person_id)
  const personIdsByOrg = new Map<string, string[]>();
  const allPersonIds: string[] = [];
  for (const p of personsRows) {
    if (!personIdsByOrg.has(p.organization_id)) personIdsByOrg.set(p.organization_id, []);
    personIdsByOrg.get(p.organization_id)!.push(p.id);
    allPersonIds.push(p.id);
  }

  // ── 2. Infos orgs ─────────────────────────────────────────────────────────
  const [orgsRes, tiersRes, campaignsRes, eventsRes, taxReceiptsRes, reservationsRes] = await Promise.all([
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
      const eventIds = [...new Set(billetsRows.map((b) => b.event_id))];
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
    // Réservations d'espace à venir, rattachées aux fiches persons de ce
    // courriel : c'est la même jointure que la page d'annulation vérifie.
    (() => {
      if (!allPersonIds.length) return Promise.resolve({ data: [] });
      return admin
        .from("reservations")
        .select("id, title, start_at, end_at, status, organization_id, person_id, spaces(name)")
        .in("person_id", allPersonIds)
        .in("status", ["demandee", "confirmee"])
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true });
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
  for (const p of personsRows) {
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
    const adhesionRow = adhesionsRows.find(
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

    // Upcoming tickets (one per participant) and waiting-list entries for this org
    const billets: PortalBillet[] = [];
    const attente: PortalAttente[] = [];
    for (const b of billetsRows) {
      if (b.organization_id !== orgId) continue;
      const ev = eventsMap.get(b.event_id);
      if (!ev) continue; // filtré par gte(now) au-dessus : pas dans la map = passé
      if (b.status === "liste_attente") {
        attente.push({ eventTitle: ev.title, eventStartAt: ev.start_at, seats: b.seats ?? 1 });
        continue;
      }
      for (const t of ticketsOf(b)) {
        billets.push({
          ticketToken: t.ticket_token,
          holderName: t.holder_name ?? "",
          eventTitle: ev.title,
          eventStartAt: ev.start_at,
          eventSlug: ev.slug ?? null,
        });
      }
    }
    attente.sort(
      (a, b) => new Date(a.eventStartAt).getTime() - new Date(b.eventStartAt).getTime()
    );
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

    // Factures de cette org
    const today = new Date().toISOString().slice(0, 10);
    const factures: PortalFacture[] = facturesRows
      .filter((f) => f.organization_id === orgId)
      .map((f) => {
        const paid = f.status === "payee";
        const declared = Boolean(f.payment_declared_at);
        const late = !paid && !declared && !!f.due_date && f.due_date < today;
        return {
          id: f.id,
          number: f.number,
          object: f.object,
          amountTtc: Number(f.total_ttc),
          dueDate: f.due_date,
          issueDate: f.issue_date,
          derivedStatus: paid ? "payee" : declared ? "declaree" : late ? "en_retard" : "a_regler",
          // Cohérent avec le garde-fou de l'action : une seule déclaration par facture.
          canDeclare: !paid && !declared,
        } satisfies PortalFacture;
      });

    // Réservations d'espace à venir pour cette org
    const reservations: PortalReservation[] = ((reservationsRes.data ?? []) as unknown as Array<{
      id: string; title: string | null; start_at: string; end_at: string | null;
      status: string; organization_id: string; spaces: { name: string } | null;
    }>)
      .filter((r) => r.organization_id === orgId)
      .map((r) => ({
        id: r.id,
        title: r.title,
        spaceName: r.spaces?.name ?? null,
        startAt: r.start_at,
        endAt: r.end_at,
        status: r.status,
      }));

    result.push({
      orgId,
      orgSlug: org.slug,
      orgName: org.name,
      displayName: displayNameByOrg.get(orgId) ?? org.name,
      adhesion,
      billets,
      attente,
      recus,
      factures,
      reservations,
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
  const pattern = exactEmailPattern(email);

  const [p, a, b, f] = await Promise.all([
    admin
      .from("persons")
      .select("id", { count: "exact", head: true })
      .ilike("email", pattern)
      .is("anonymized_at", null),
    admin
      .from("membership_applications")
      .select("id", { count: "exact", head: true })
      .ilike("email", pattern),
    admin
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .ilike("email", pattern),
    // Un coworker facturé n'a parfois ni fiche, ni adhésion, ni billet : sans
    // cette ligne, /espace lui répondait « aucun dossier » et il ne pouvait
    // obtenir aucun lien de portail.
    admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .ilike("client_email", pattern)
      .eq("kind", "facture")
      .not("status", "in", "(brouillon,annulee)"),
  ]);

  return ((p.count ?? 0) + (a.count ?? 0) + (b.count ?? 0) + (f.count ?? 0)) > 0;
}
