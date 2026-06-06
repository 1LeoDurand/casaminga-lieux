import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { humanError } from "@/lib/errors";
import { demoOrgBySlug, demoPublicSiteBySlug } from "@/lib/demo/data";
import {
  addDemoApplication,
  addDemoCampaign,
  addDemoTier,
  addDemoAnnouncement,
  addDemoAutomation,
  addDemoCommunityPost,
  addDemoDocument,
  addDemoImpactIndicator,
  addDemoMandate,
  addDemoMeeting,
  addDemoPartner,
  addDemoEvenement,
  addDemoMedia,
  addDemoPerson,
  addDemoResidence,
  addDemoTask,
  addDemoTransaction,
  addDemoRequest,
  addDemoReservation,
  addDemoSpace,
  deleteDemoCampaign,
  deleteDemoTier,
  deleteDemoAnnouncement,
  deleteDemoAutomation,
  deleteDemoCommunityPost,
  deleteDemoDocument,
  deleteDemoImpactIndicator,
  deleteDemoMandate,
  deleteDemoMeeting,
  deleteDemoPartner,
  deleteDemoEvenement,
  deleteDemoMedia,
  deleteDemoPerson,
  deleteDemoResidence,
  deleteDemoTask,
  deleteDemoTransaction,
  deleteDemoReservation,
  deleteDemoSpace,
  findDemoReservationConflict,
  getDemoApplications,
  getDemoApplicationsForOrg,
  getDemoCampaignBySlug,
  getDemoCampaigns,
  getDemoTiers,
  getDemoAnnouncements,
  getDemoAutomations,
  getDemoCommunityPosts,
  getDemoDocuments,
  getDemoImpactIndicators,
  getDemoMandates,
  getDemoMeetings,
  getDemoPartners,
  getDemoEvenements,
  getDemoMedia,
  getDemoPersons,
  getDemoResidences,
  getDemoTasks,
  getDemoTransactions,
  getDemoRequests,
  getDemoReservationById,
  getDemoReservations,
  getDemoSpaces,
  updateDemoApplication,
  updateDemoCampaign,
  updateDemoTier,
  updateDemoAnnouncement,
  updateDemoAutomation,
  updateDemoCommunityPost,
  updateDemoDocument,
  updateDemoImpactIndicator,
  updateDemoMandate,
  updateDemoMeeting,
  updateDemoPartner,
  updateDemoEvenement,
  updateDemoMedia,
  updateDemoPerson,
  updateDemoResidence,
  updateDemoTask,
  updateDemoTransaction,
  updateDemoRequestStatus,
  updateDemoReservation,
  updateDemoSpace,
} from "@/lib/demo/store";
import type {
  Announcement,
  Automation,
  CommunityPost,
  Document,
  Evenement,
  ImpactIndicator,
  IncomingRequest,
  Mandate,
  Media,
  MembershipApplication,
  MembershipCampaign,
  MembershipTier,
  Meeting,
  Organization,
  Partner,
  Person,
  PublicSite,
  Reservation,
  RequestStatus,
  Residence,
  Space,
  Task,
  Transaction,
  Grant,
  GrantTranche,
  CashEntry,
  CashClosure,
  CashPaymentMethod,
  CashSource,
  CashClosureType,
  CashVerifyResult,
  Artist,
  ArtistMilestone,
  TeamMember,
  OrgRole,
} from "@/lib/types";

/**
 * Accès aux données du socle.
 * Mode démo (Supabase non configuré) → données seed locales.
 * Sinon → requêtes Supabase (isolation par RLS / organization_id).
 */

export async function getOrganizationBySlug(
  slug: string
): Promise<Organization | null> {
  if (!isSupabaseConfigured()) return demoOrgBySlug(slug) ?? null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getPublicSiteBySlug(
  slug: string
): Promise<PublicSite | null> {
  if (!isSupabaseConfigured()) return demoPublicSiteBySlug(slug) ?? null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("public_sites")
    .select("organization_id, slug, title, status, seo_description")
    .eq("slug", slug)
    .eq("status", "publie")
    .maybeSingle();
  return data;
}

export async function getRequestsForOrg(
  orgId: string
): Promise<IncomingRequest[]> {
  if (!isSupabaseConfigured()) return getDemoRequests(orgId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("*")
    .eq("organization_id", orgId)
    .order("received_at", { ascending: false });
  return data ?? [];
}

export interface NewRequestInput {
  organization_id: string;
  name: string;
  email: string;
  phone: string | null;
  organization_ext: string | null;
  type: string;
  message: string;
}

/** Crée une demande. Demo → store local ; sinon → insert Supabase (RLS). */
export async function createRequest(
  input: NewRequestInput
): Promise<IncomingRequest | null> {
  const summary =
    input.message.length > 120
      ? `${input.message.slice(0, 117)}…`
      : input.message;

  if (!isSupabaseConfigured()) {
    return addDemoRequest({ ...input, summary });
  }

  // Insertion via le client anon (policy `requests_insert_from_public_site`).
  // On NE fait PAS de `.select()` de retour : aucune policy SELECT n'autorise
  // l'anonyme à relire une demande (lecture réservée aux membres), donc un
  // `RETURNING *` reviendrait vide et ferait échouer l'enregistrement à tort.
  // On génère donc l'id côté serveur et on reconstruit la ligne créée.
  const supabase = await createClient();
  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  const { error } = await supabase.from("requests").insert({
    id,
    ...input,
    summary,
    status: "nouvelle",
    priority: "normale",
    received_at: receivedAt,
  });

  if (error) {
    console.error("createRequest: échec insertion Supabase", error);
    return null;
  }

  return {
    id,
    organization_id: input.organization_id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    organization_ext: input.organization_ext,
    type: input.type,
    status: "nouvelle",
    priority: "normale",
    summary,
    message: input.message,
    received_at: receivedAt,
  };
}

/** Met à jour le statut d'une demande. Demo → store ; sinon → update Supabase. */
export async function updateRequestStatus(
  id: string,
  status: RequestStatus
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return updateDemoRequestStatus(id, status) !== null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", id);
  return !error;
}

/** Récupère une demande par son id (pour les emails de statut). */
export async function getRequestById(id: string): Promise<{ name: string; email: string | null } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("name, email")
    .eq("id", id)
    .single();
  return data ?? null;
}

/** Récupère une candidature d'adhésion par id (pour les emails). */
export async function getMembershipApplicationById(id: string): Promise<{
  first_name: string; last_name: string; email: string;
  amount_paid: number; membership_start: string; membership_end: string;
} | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("membership_applications")
    .select("first_name, last_name, email, amount_paid, membership_start, membership_end")
    .eq("id", id)
    .single();
  return data ?? null;
}

// ════════════════════════════════════════════════════════════
// PERSONNES (CRM) — démo ⇆ Supabase (isolation par RLS)
// ════════════════════════════════════════════════════════════

export async function getPersonsForOrg(orgId: string): Promise<Person[]> {
  if (!isSupabaseConfigured()) return getDemoPersons(orgId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("persons")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface PersonInput {
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  newsletter_opt_out?: boolean;
  unsubscribe_token?: string;
  status: Person["status"];
  tags: string[];
  notes: string | null;
}

/** Crée une personne. Membre uniquement (RLS). */
export async function createPerson(input: PersonInput): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return addDemoPerson(input) !== null;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("persons").insert(input);
  if (error) console.error("createPerson: échec insertion Supabase", error);
  return !error;
}

/** Met à jour une personne (champs éditables). */
export async function updatePerson(
  id: string,
  patch: Partial<PersonInput>
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return updateDemoPerson(id, patch) !== null;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("persons").update(patch).eq("id", id);
  if (error) console.error("updatePerson: échec maj Supabase", error);
  return !error;
}

/** Supprime une personne. */
export async function deletePerson(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return deleteDemoPerson(id);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("persons").delete().eq("id", id);
  if (error) console.error("deletePerson: échec suppression Supabase", error);
  return !error;
}

// ── Espaces ─────────────────────────────────────────────────
export async function getSpacesForOrg(orgId: string): Promise<Space[]> {
  if (!isSupabaseConfigured()) return getDemoSpaces(orgId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface SpaceInput {
  organization_id: string;
  name: string;
  type: string;
  capacity: number | null;
  area: number | null;
  price_hour: number | null;
  price_day: number | null;
  description: string | null;
  photos: string[];
  status: Space["status"];
  establishment_id: string | null;
}

/** Crée un espace. Membre uniquement (RLS). */
export async function createSpace(input: SpaceInput): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return addDemoSpace(input) !== null;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("spaces").insert(input);
  if (error) console.error("createSpace: échec insertion Supabase", error);
  return !error;
}

/** Met à jour un espace (champs éditables). */
export async function updateSpace(
  id: string,
  patch: Partial<SpaceInput>
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return updateDemoSpace(id, patch) !== null;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("spaces").update(patch).eq("id", id);
  if (error) console.error("updateSpace: échec maj Supabase", error);
  return !error;
}

/** Supprime un espace. */
export async function deleteSpace(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return deleteDemoSpace(id);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("spaces").delete().eq("id", id);
  if (error) console.error("deleteSpace: échec suppression Supabase", error);
  return !error;
}

// ── Réservations ────────────────────────────────────────────
export async function getReservationsForOrg(
  orgId: string
): Promise<Reservation[]> {
  if (!isSupabaseConfigured()) return getDemoReservations(orgId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("*")
    .eq("organization_id", orgId)
    .order("start_at", { ascending: true });
  return data ?? [];
}

export interface ReservationInput {
  organization_id: string;
  space_id: string;
  person_id: string | null;
  title: string | null;
  start_at: string;
  end_at: string;
  status: Reservation["status"];
  price: number | null;
  notes: string | null;
}

/** Résultat d'écriture : `conflict` distingue un chevauchement de créneau. */
export interface ReservationWriteResult {
  ok: boolean;
  conflict?: boolean;
}

// Code Postgres d'une violation de contrainte EXCLUDE (anti-chevauchement).
const PG_EXCLUSION_VIOLATION = "23P01";

/** Crée une réservation (refuse les chevauchements d'espace). Membre uniquement. */
export async function createReservation(
  input: ReservationInput
): Promise<ReservationWriteResult> {
  if (!isSupabaseConfigured()) {
    if (input.status !== "annulee") {
      const clash = findDemoReservationConflict(
        input.organization_id,
        input.space_id,
        input.start_at,
        input.end_at
      );
      if (clash) return { ok: false, conflict: true };
    }
    addDemoReservation(input);
    return { ok: true };
  }

  const supabase = await createClient();

  // Pré-contrôle pour un message clair (la contrainte EXCLUDE reste le garde-fou).
  if (input.status !== "annulee") {
    const { data: clash } = await supabase
      .from("reservations")
      .select("id")
      .eq("organization_id", input.organization_id)
      .eq("space_id", input.space_id)
      .neq("status", "annulee")
      .lt("start_at", input.end_at)
      .gt("end_at", input.start_at)
      .limit(1);
    if (clash && clash.length) return { ok: false, conflict: true };
  }

  const { error } = await supabase.from("reservations").insert(input);
  if (error) {
    if (error.code === PG_EXCLUSION_VIOLATION) return { ok: false, conflict: true };
    console.error("createReservation: échec insertion Supabase", error);
    return { ok: false };
  }
  return { ok: true };
}

/** Met à jour une réservation (refuse les chevauchements). */
export async function updateReservation(
  id: string,
  patch: Partial<ReservationInput>
): Promise<ReservationWriteResult> {
  if (!isSupabaseConfigured()) {
    const current = getDemoReservationById(id);
    if (!current) return { ok: false };
    // Calcule le créneau effectif (fusion) AVANT toute mutation.
    const effective = { ...current, ...patch };
    if (effective.status !== "annulee") {
      const clash = findDemoReservationConflict(
        effective.organization_id,
        effective.space_id,
        effective.start_at,
        effective.end_at,
        id
      );
      if (clash) return { ok: false, conflict: true };
    }
    return updateDemoReservation(id, patch) ? { ok: true } : { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update(patch)
    .eq("id", id);
  if (error) {
    if (error.code === PG_EXCLUSION_VIOLATION) return { ok: false, conflict: true };
    console.error("updateReservation: échec maj Supabase", error);
    return { ok: false };
  }
  return { ok: true };
}

/** Supprime une réservation. */
export async function deleteReservation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return deleteDemoReservation(id);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) console.error("deleteReservation: échec suppression Supabase", error);
  return !error;
}

// ── Événements ───────────────────────────────────────────────
export async function getEvenementsForOrg(orgId: string): Promise<Evenement[]> {
  if (!isSupabaseConfigured()) return getDemoEvenements(orgId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("evenements")
    .select("*")
    .eq("organization_id", orgId)
    .order("start_at", { ascending: true });
  return data ?? [];
}

export async function getEvenementById(id: string): Promise<Evenement | null> {
  if (!isSupabaseConfigured()) {
    const all = getDemoEvenements("demo");
    return all.find((e) => e.id === id) ?? null;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("evenements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export interface EvenementInput {
  organization_id: string;
  space_id: string | null;
  title: string;
  type: string;
  status: Evenement["status"];
  start_at: string;
  end_at: string;
  capacity: number | null;
  price: number | null;
  description: string | null;
  photos: string[];
  show_on_public_site: boolean;
  establishment_id: string | null;
}

export async function createEvenement(input: EvenementInput): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    addDemoEvenement(input);
    return true;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("evenements").insert(input);
  if (error) console.error("createEvenement: échec insertion Supabase", error);
  return !error;
}

export async function updateEvenement(id: string, patch: Partial<EvenementInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return updateDemoEvenement(id, patch) !== null;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("evenements").update(patch).eq("id", id);
  if (error) console.error("updateEvenement: échec maj Supabase", error);
  return !error;
}

export async function deleteEvenement(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return deleteDemoEvenement(id);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("evenements").delete().eq("id", id);
  if (error) console.error("deleteEvenement: échec suppression Supabase", error);
  return !error;
}

// ── Résidences ───────────────────────────────────────────────
export async function getResidencesForOrg(orgId: string): Promise<Residence[]> {
  if (!isSupabaseConfigured()) return getDemoResidences(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("residences").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface ResidenceInput {
  organization_id: string;
  space_id: string | null;
  person_id: string | null;
  artist_id: string | null;
  title: string;
  discipline: string;
  status: Residence["status"];
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  notes: string | null;
  budget: number | null;
  logement_fourni: boolean;
  logement_notes: string | null;
  convention_signee: boolean;
  convention_date: string | null;
  restitution_date: string | null;
  restitution_status: Residence["restitution_status"];
  projet_description: string | null;
}

export async function createResidence(input: ResidenceInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoResidence(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("residences").insert(input);
  if (error) console.error("createResidence:", error);
  return !error;
}

export async function updateResidence(id: string, patch: Partial<ResidenceInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoResidence(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("residences").update(patch).eq("id", id);
  if (error) console.error("updateResidence:", error);
  return !error;
}

export async function deleteResidence(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoResidence(id);
  const supabase = await createClient();
  const { error } = await supabase.from("residences").delete().eq("id", id);
  if (error) console.error("deleteResidence:", error);
  return !error;
}

// ── Documents ────────────────────────────────────────────────
export async function getDocumentsForOrg(orgId: string): Promise<Document[]> {
  if (!isSupabaseConfigured()) return getDemoDocuments(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface DocumentInput {
  organization_id: string;
  person_id: string | null;
  title: string;
  type: string;
  status: Document["status"];
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
}

export async function createDocument(input: DocumentInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoDocument(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert(input);
  if (error) console.error("createDocument:", error);
  return !error;
}

export async function updateDocument(id: string, patch: Partial<DocumentInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoDocument(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("documents").update(patch).eq("id", id);
  if (error) console.error("updateDocument:", error);
  return !error;
}

export async function deleteDocument(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoDocument(id);
  const supabase = await createClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) console.error("deleteDocument:", error);
  return !error;
}

// ── Transactions / Finances ──────────────────────────────────
export async function getTransactionsForOrg(orgId: string): Promise<Transaction[]> {
  if (!isSupabaseConfigured()) return getDemoTransactions(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("transactions").select("*")
    .eq("organization_id", orgId).order("date", { ascending: false });
  return data ?? [];
}

export interface TransactionInput {
  organization_id: string;
  person_id: string | null;
  type: Transaction["type"];
  category: string;
  amount: number;
  date: string;
  label: string;
  status: Transaction["status"];
  notes: string | null;
}

export async function createTransaction(input: TransactionInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoTransaction(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(input);
  if (error) console.error("createTransaction:", error);
  return !error;
}

export async function updateTransaction(id: string, patch: Partial<TransactionInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoTransaction(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").update(patch).eq("id", id);
  if (error) console.error("updateTransaction:", error);
  return !error;
}

export async function deleteTransaction(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoTransaction(id);
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) console.error("deleteTransaction:", error);
  return !error;
}

// ── Médiathèque ──────────────────────────────────────────────
export async function getMediaForOrg(orgId: string): Promise<Media[]> {
  if (!isSupabaseConfigured()) return getDemoMedia(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("media").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface MediaInput {
  organization_id: string;
  title: string;
  type: Media["type"];
  url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  tags: string[];
}

export async function createMedia(input: MediaInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoMedia(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("media").insert(input);
  if (error) console.error("createMedia:", error);
  return !error;
}

export async function updateMedia(id: string, patch: Partial<MediaInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoMedia(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("media").update(patch).eq("id", id);
  if (error) console.error("updateMedia:", error);
  return !error;
}

export async function deleteMedia(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoMedia(id);
  const supabase = await createClient();
  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) console.error("deleteMedia:", error);
  return !error;
}

// ── Communication / Annonces ─────────────────────────────────
export async function getAnnouncementsForOrg(orgId: string): Promise<Announcement[]> {
  if (!isSupabaseConfigured()) return getDemoAnnouncements(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface AnnouncementInput {
  organization_id: string;
  title: string;
  content: string;
  status: Announcement["status"];
  audience: Announcement["audience"];
}

export async function createAnnouncement(input: AnnouncementInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoAnnouncement(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert(input);
  if (error) console.error("createAnnouncement:", error);
  return !error;
}

export async function updateAnnouncement(id: string, patch: Partial<AnnouncementInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoAnnouncement(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update(patch).eq("id", id);
  if (error) console.error("updateAnnouncement:", error);
  return !error;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoAnnouncement(id);
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) console.error("deleteAnnouncement:", error);
  return !error;
}

// ── Tâches ───────────────────────────────────────────────────
export async function getTasksForOrg(orgId: string): Promise<Task[]> {
  if (!isSupabaseConfigured()) return getDemoTasks(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("*")
    .eq("organization_id", orgId).order("due_date", { ascending: true, nullsFirst: false });
  return data ?? [];
}

export interface TaskInput {
  organization_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  priority: Task["priority"];
  status: Task["status"];
  due_date: string | null;
  related_label: string | null;
}

export async function createTask(input: TaskInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoTask(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert(input);
  if (error) console.error("createTask:", error);
  return !error;
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoTask(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) console.error("updateTask:", error);
  return !error;
}

export async function deleteTask(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoTask(id);
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) console.error("deleteTask:", error);
  return !error;
}

// ── Communauté ───────────────────────────────────────────────
export async function getCommunityPostsForOrg(orgId: string): Promise<CommunityPost[]> {
  if (!isSupabaseConfigured()) return getDemoCommunityPosts(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("community_posts").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface CommunityPostInput {
  organization_id: string;
  author_id: string | null;
  type: CommunityPost["type"];
  title: string;
  content: string;
  status: CommunityPost["status"];
  establishment_id: string | null;
}

export async function createCommunityPost(input: CommunityPostInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoCommunityPost(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("community_posts").insert(input);
  if (error) console.error("createCommunityPost:", error);
  return !error;
}

export async function updateCommunityPost(id: string, patch: Partial<CommunityPostInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoCommunityPost(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("community_posts").update(patch).eq("id", id);
  if (error) console.error("updateCommunityPost:", error);
  return !error;
}

export async function deleteCommunityPost(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoCommunityPost(id);
  const supabase = await createClient();
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) console.error("deleteCommunityPost:", error);
  return !error;
}

// ── Gouvernance : Réunions ───────────────────────────────────
export async function getMeetingsForOrg(orgId: string): Promise<Meeting[]> {
  if (!isSupabaseConfigured()) return getDemoMeetings(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("*").eq("organization_id", orgId).order("date", { ascending: false });
  return data ?? [];
}
export interface MeetingInput {
  organization_id: string; type: Meeting["type"]; title: string; date: string;
  agenda: string | null; minutes: string | null; status: Meeting["status"];
}
export async function createMeeting(input: MeetingInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoMeeting(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert(input);
  if (error) console.error("createMeeting:", error); return !error;
}
export async function updateMeeting(id: string, patch: Partial<MeetingInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoMeeting(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update(patch).eq("id", id);
  if (error) console.error("updateMeeting:", error); return !error;
}
export async function deleteMeeting(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoMeeting(id);
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) console.error("deleteMeeting:", error); return !error;
}

// ── Gouvernance : Mandats ────────────────────────────────────
export async function getMandatesForOrg(orgId: string): Promise<Mandate[]> {
  if (!isSupabaseConfigured()) return getDemoMandates(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("mandates").select("*").eq("organization_id", orgId).order("status", { ascending: true });
  return data ?? [];
}
export interface MandateInput {
  organization_id: string; person_id: string | null; role: string;
  start_date: string | null; end_date: string | null; status: Mandate["status"];
}
export async function createMandate(input: MandateInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoMandate(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("mandates").insert(input);
  if (error) console.error("createMandate:", error); return !error;
}
export async function updateMandate(id: string, patch: Partial<MandateInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoMandate(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("mandates").update(patch).eq("id", id);
  if (error) console.error("updateMandate:", error); return !error;
}
export async function deleteMandate(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoMandate(id);
  const supabase = await createClient();
  const { error } = await supabase.from("mandates").delete().eq("id", id);
  if (error) console.error("deleteMandate:", error); return !error;
}

// ── Partenaires ──────────────────────────────────────────────
export async function getPartnersForOrg(orgId: string): Promise<Partner[]> {
  if (!isSupabaseConfigured()) return getDemoPartners(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("partners").select("*").eq("organization_id", orgId).order("name", { ascending: true });
  return data ?? [];
}
export interface PartnerInput {
  organization_id: string; contact_id: string | null; name: string;
  type: Partner["type"]; status: Partner["status"];
  email: string | null; phone: string | null; website: string | null; notes: string | null;
}
export async function createPartner(input: PartnerInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoPartner(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("partners").insert(input);
  if (error) console.error("createPartner:", error); return !error;
}
export async function updatePartner(id: string, patch: Partial<PartnerInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoPartner(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("partners").update(patch).eq("id", id);
  if (error) console.error("updatePartner:", error); return !error;
}
export async function deletePartner(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoPartner(id);
  const supabase = await createClient();
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) console.error("deletePartner:", error); return !error;
}

// ── Impact ───────────────────────────────────────────────────
export async function getImpactIndicatorsForOrg(orgId: string): Promise<ImpactIndicator[]> {
  if (!isSupabaseConfigured()) return getDemoImpactIndicators(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("impact_indicators").select("*").eq("organization_id", orgId).order("category", { ascending: true });
  return data ?? [];
}
export interface ImpactIndicatorInput {
  organization_id: string; label: string; value: number;
  unit: string | null; period: string | null; category: ImpactIndicator["category"];
}
export async function createImpactIndicator(input: ImpactIndicatorInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoImpactIndicator(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("impact_indicators").insert(input);
  if (error) console.error("createImpactIndicator:", error); return !error;
}
export async function updateImpactIndicator(id: string, patch: Partial<ImpactIndicatorInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoImpactIndicator(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("impact_indicators").update(patch).eq("id", id);
  if (error) console.error("updateImpactIndicator:", error); return !error;
}
export async function deleteImpactIndicator(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoImpactIndicator(id);
  const supabase = await createClient();
  const { error } = await supabase.from("impact_indicators").delete().eq("id", id);
  if (error) console.error("deleteImpactIndicator:", error); return !error;
}

// ── Automatisations ──────────────────────────────────────────
export async function getAutomationsForOrg(orgId: string): Promise<Automation[]> {
  if (!isSupabaseConfigured()) return getDemoAutomations(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("automations").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}
export interface AutomationInput {
  organization_id: string; name: string;
  trigger_type: Automation["trigger_type"]; condition: string | null;
  action_type: Automation["action_type"]; action_detail: string | null; active: boolean;
}
export async function createAutomation(input: AutomationInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoAutomation({ ...input, last_run_at: null, run_count: 0 }); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("automations").insert(input);
  if (error) console.error("createAutomation:", error); return !error;
}
export async function updateAutomation(id: string, patch: Partial<AutomationInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoAutomation(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("automations").update(patch).eq("id", id);
  if (error) console.error("updateAutomation:", error); return !error;
}
export async function deleteAutomation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoAutomation(id);
  const supabase = await createClient();
  const { error } = await supabase.from("automations").delete().eq("id", id);
  if (error) console.error("deleteAutomation:", error); return !error;
}

// ── Adhésions : Campagnes ────────────────────────────────────
export async function getMembershipCampaignsForOrg(orgId: string): Promise<MembershipCampaign[]> {
  if (!isSupabaseConfigured()) return getDemoCampaigns(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("membership_campaigns").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getPublicCampaignBySlug(orgId: string, slug: string): Promise<MembershipCampaign | null> {
  if (!isSupabaseConfigured()) return getDemoCampaignBySlug(orgId, slug);
  const supabase = await createClient();
  const { data } = await supabase.from("membership_campaigns").select("*")
    .eq("organization_id", orgId).eq("slug", slug).eq("status", "publie").maybeSingle();
  return data;
}

export interface MembershipCampaignInput {
  organization_id: string; title: string; slug: string; description: string | null;
  status: MembershipCampaign["status"]; period_type: MembershipCampaign["period_type"];
  period_start: string | null; period_end: string | null; max_members: number | null;
  allow_donation: boolean; donation_amounts: string[];
  show_member_count: boolean; show_collected: boolean; generate_cards: boolean; photos: string[];
}

/** Retourne l'id de la campagne créée, ou null en cas d'erreur. */
export async function createMembershipCampaign(input: MembershipCampaignInput): Promise<string | null> {
  if (!isSupabaseConfigured()) { const c = addDemoCampaign(input); return c.id; }
  const supabase = await createClient();
  const { data, error } = await supabase.from("membership_campaigns").insert(input).select("id").single();
  if (error) { console.error("createMembershipCampaign:", error); return null; }
  return data?.id ?? null;
}

export async function updateMembershipCampaign(id: string, patch: Partial<MembershipCampaignInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoCampaign(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("membership_campaigns").update(patch).eq("id", id);
  if (error) console.error("updateMembershipCampaign:", error); return !error;
}

export async function deleteMembershipCampaign(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoCampaign(id);
  const supabase = await createClient();
  const { error } = await supabase.from("membership_campaigns").delete().eq("id", id);
  if (error) console.error("deleteMembershipCampaign:", error); return !error;
}

// ── Adhésions : Formules ─────────────────────────────────────
export async function getTiersForCampaign(campaignId: string): Promise<MembershipTier[]> {
  if (!isSupabaseConfigured()) return getDemoTiers(campaignId);
  const supabase = await createClient();
  const { data } = await supabase.from("membership_tiers").select("*")
    .eq("campaign_id", campaignId).order("sort_order", { ascending: true });
  return data ?? [];
}

export interface MembershipTierInput {
  campaign_id: string; organization_id: string;
  name: string; description: string | null; amount: number; sort_order: number;
}

export async function createMembershipTier(input: MembershipTierInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoTier(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("membership_tiers").insert(input);
  if (error) console.error("createMembershipTier:", error); return !error;
}

export async function updateMembershipTier(id: string, patch: Partial<MembershipTierInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoTier(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("membership_tiers").update(patch).eq("id", id);
  if (error) console.error("updateMembershipTier:", error); return !error;
}

export async function deleteMembershipTier(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return deleteDemoTier(id);
  const supabase = await createClient();
  const { error } = await supabase.from("membership_tiers").delete().eq("id", id);
  if (error) console.error("deleteMembershipTier:", error); return !error;
}

// ── Adhésions : Souscriptions ────────────────────────────────
export async function getApplicationsForCampaign(campaignId: string): Promise<MembershipApplication[]> {
  if (!isSupabaseConfigured()) return getDemoApplications(campaignId);
  const supabase = await createClient();
  const { data } = await supabase.from("membership_applications").select("*")
    .eq("campaign_id", campaignId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getMembershipApplicationsForOrg(orgId: string): Promise<MembershipApplication[]> {
  if (!isSupabaseConfigured()) return getDemoApplicationsForOrg(orgId);
  const supabase = await createClient();
  const { data } = await supabase.from("membership_applications").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface MembershipApplicationInput {
  campaign_id: string; tier_id: string | null; organization_id: string;
  first_name: string; last_name: string; email: string | null; phone: string | null;
  payer_name: string | null; payer_email: string | null;
  amount_paid: number; donation_amount: number | null;
  status: MembershipApplication["status"];
  membership_start: string | null; membership_end: string | null; notes: string | null;
  payment_method?: string | null | undefined; payment_ref?: string | null | undefined;
}

/** Souscription publique (anon). */
export async function createMembershipApplication(input: MembershipApplicationInput): Promise<boolean> {
  if (!isSupabaseConfigured()) { addDemoApplication(input); return true; }
  const supabase = await createClient();
  const { error } = await supabase.from("membership_applications").insert(input);
  if (error) console.error("createMembershipApplication:", error); return !error;
}

/** Admin : changer le statut d'une souscription. */
export async function updateMembershipApplication(id: string, patch: Partial<MembershipApplicationInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return updateDemoApplication(id, patch) !== null;
  const supabase = await createClient();
  const { error } = await supabase.from("membership_applications").update(patch).eq("id", id);
  if (error) console.error("updateMembershipApplication:", error); return !error;
}

// ── Subventions ───────────────────────────────────────────────
export async function getGrantsForOrg(orgId: string): Promise<Grant[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("grants").select("*")
    .eq("organization_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getGrantTranches(grantId: string): Promise<GrantTranche[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("grant_tranches").select("*")
    .eq("grant_id", grantId).order("due_date", { ascending: true });
  return data ?? [];
}

export interface GrantInput {
  organization_id: string;
  title: string;
  funder: string;
  funder_type: Grant["funder_type"];
  amount: number;
  amount_received: number;
  start_date: string | null;
  end_date: string | null;
  status: Grant["status"];
  convention_ref: string | null;
  description: string | null;
  reporting_due_date: string | null;
  kpi_beneficiaires: number | null;
  kpi_heures: number | null;
  kpi_artistes: number | null;
  kpi_evenements: number | null;
  kpi_note: string | null;
}

export async function createGrant(input: GrantInput): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("grants").insert(input).select("id").single();
  if (error) { console.error("createGrant:", error); return null; }
  return data?.id ?? null;
}

export async function updateGrant(id: string, patch: Partial<GrantInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("grants").update(patch).eq("id", id);
  if (error) console.error("updateGrant:", error);
  return !error;
}

export async function deleteGrant(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("grants").delete().eq("id", id);
  if (error) console.error("deleteGrant:", error);
  return !error;
}

export interface GrantTrancheInput {
  grant_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  received_date: string | null;
  status: GrantTranche["status"];
}

export async function createGrantTranche(input: GrantTrancheInput): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("grant_tranches").insert(input);
  if (error) console.error("createGrantTranche:", error);
  return !error;
}

export async function updateGrantTranche(id: string, patch: Partial<GrantTrancheInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("grant_tranches").update(patch).eq("id", id);
  if (error) console.error("updateGrantTranche:", error);
  return !error;
}

export async function deleteGrantTranche(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("grant_tranches").delete().eq("id", id);
  if (error) console.error("deleteGrantTranche:", error);
  return !error;
}

// ── Caisse certifiée (NF525) ──────────────────────────────────
export async function getCashEntries(orgId: string, limit = 200): Promise<CashEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("cash_entries").select("*")
    .eq("organization_id", orgId).order("seq", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function getCashClosures(orgId: string): Promise<CashClosure[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("cash_closures").select("*")
    .eq("organization_id", orgId).order("closed_at", { ascending: false }).limit(100);
  return data ?? [];
}

export interface CashEntryInput {
  organization_id: string;
  label: string;
  amount_ttc: number;
  vat_rate: number;
  payment_method: CashPaymentMethod;
  source: CashSource;
  operator: string;
  source_ref?: string | null;
  pole_id?: string | null;
}

/** Ajoute une écriture immuable via la fonction atomique (seq continu + hash chaîné). */
export async function addCashEntry(input: CashEntryInput): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cash_add_entry", {
    p_org: input.organization_id,
    p_label: input.label,
    p_amount_ttc: input.amount_ttc,
    p_vat_rate: input.vat_rate,
    p_payment_method: input.payment_method,
    p_source: input.source,
    p_operator: input.operator,
    p_source_ref: input.source_ref ?? null,
    p_pole_id: input.pole_id ?? null,
  });
  if (error) { console.error("addCashEntry:", error); return { ok: false, error: humanError(error) }; }
  return { ok: true };
}

/** Écriture de correction (extourne) : montant négatif lié à une écriture existante. */
export async function voidCashEntry(orgId: string, target: CashEntry, operator: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cash_add_entry", {
    p_org: orgId,
    p_label: `Annulation #${target.seq} — ${reason}`.slice(0, 200),
    p_amount_ttc: -Math.abs(target.amount_ttc),
    p_vat_rate: target.vat_rate,
    p_payment_method: target.payment_method,
    p_source: target.source,
    p_operator: operator,
    p_source_ref: target.ticket_ref,
    p_is_void: true,
    p_voids_seq: target.seq,
    p_pole_id: target.pole_id ?? null,
  });
  if (error) { console.error("voidCashEntry:", error); return { ok: false, error: humanError(error) }; }
  return { ok: true };
}

export async function closeCashRegister(orgId: string, type: CashClosureType, operator: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase non configuré" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cash_close", { p_org: orgId, p_type: type, p_operator: operator });
  if (error) { console.error("closeCashRegister:", error); return { ok: false, error: humanError(error) }; }
  return { ok: true };
}

export async function verifyCashChain(orgId: string): Promise<CashVerifyResult | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cash_verify", { p_org: orgId });
  if (error) { console.error("verifyCashChain:", error); return null; }
  return data as CashVerifyResult;
}

// ── Artistes ──────────────────────────────────────────────────
export async function getArtistsForOrg(orgId: string): Promise<Artist[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("artists").select("*")
    .eq("organization_id", orgId).order("name", { ascending: true });
  return data ?? [];
}

export interface ArtistInput {
  organization_id: string;
  name: string;
  discipline: string;
  bio: string | null;
  portfolio_url: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  origin_city: string | null;
  nationality: string | null;
  instagram: string | null;
  tags: string[];
  photo_url: string | null;
  status: Artist["status"];
}

export async function createArtist(input: ArtistInput): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("artists").insert(input).select("id").single();
  if (error) { console.error("createArtist:", error); return null; }
  return data?.id ?? null;
}

export async function updateArtist(id: string, patch: Partial<ArtistInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("artists").update(patch).eq("id", id);
  if (error) console.error("updateArtist:", error);
  return !error;
}

export async function deleteArtist(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("artists").delete().eq("id", id);
  if (error) console.error("deleteArtist:", error);
  return !error;
}

// ── Jalons de résidence ───────────────────────────────────────
export async function getMilestonesForResidence(residenceId: string): Promise<ArtistMilestone[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("artist_milestones").select("*")
    .eq("residence_id", residenceId).order("due_date", { ascending: true });
  return data ?? [];
}

export interface ArtistMilestoneInput {
  residence_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  done_at: string | null;
  status: ArtistMilestone["status"];
}

export async function createMilestone(input: ArtistMilestoneInput): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("artist_milestones").insert(input);
  if (error) console.error("createMilestone:", error);
  return !error;
}

export async function updateMilestone(id: string, patch: Partial<ArtistMilestoneInput>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("artist_milestones").update(patch).eq("id", id);
  if (error) console.error("updateMilestone:", error);
  return !error;
}

export async function deleteMilestone(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("artist_milestones").delete().eq("id", id);
  if (error) console.error("deleteMilestone:", error);
  return !error;
}

// ── Équipe / membres de l'organisation ────────────────────────
export async function getTeamMembers(orgId: string): Promise<TeamMember[]> {
  if (!isSupabaseConfigured()) {
    // Démo : un seul admin fictif
    return [{
      user_id: "demo-user", organization_id: orgId, role: "admin",
      zones: [], status: "actif", created_at: new Date().toISOString(),
      full_name: "Léo Durand", email: "leo@example.org",
    }];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, organization_id, role, zones, status, created_at, profiles(full_name, email)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error) { console.error("getTeamMembers:", error); return []; }
  return (data ?? []).map((m: Record<string, unknown>) => {
    const profile = m.profiles as { full_name: string | null; email: string | null } | null;
    return {
      user_id: m.user_id as string,
      organization_id: m.organization_id as string,
      role: m.role as OrgRole,
      zones: (m.zones as string[]) ?? [],
      status: (m.status as string) ?? "actif",
      created_at: m.created_at as string,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    };
  });
}

export async function updateTeamMemberRole(
  orgId: string, userId: string, role: OrgRole, zones: string[]
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ role, zones })
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) console.error("updateTeamMemberRole:", error);
  return !error;
}

export async function removeTeamMember(orgId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) console.error("removeTeamMember:", error);
  return !error;
}
