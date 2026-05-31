import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { demoOrgBySlug, demoPublicSiteBySlug } from "@/lib/demo/data";
import {
  addDemoDocument,
  addDemoEvenement,
  addDemoPerson,
  addDemoResidence,
  addDemoTransaction,
  addDemoRequest,
  addDemoReservation,
  addDemoSpace,
  deleteDemoDocument,
  deleteDemoEvenement,
  deleteDemoPerson,
  deleteDemoResidence,
  deleteDemoTransaction,
  deleteDemoReservation,
  deleteDemoSpace,
  findDemoReservationConflict,
  getDemoDocuments,
  getDemoEvenements,
  getDemoPersons,
  getDemoResidences,
  getDemoTransactions,
  getDemoRequests,
  getDemoReservationById,
  getDemoReservations,
  getDemoSpaces,
  updateDemoDocument,
  updateDemoEvenement,
  updateDemoPerson,
  updateDemoResidence,
  updateDemoTransaction,
  updateDemoRequestStatus,
  updateDemoReservation,
  updateDemoSpace,
} from "@/lib/demo/store";
import type {
  Document,
  Evenement,
  IncomingRequest,
  Organization,
  Person,
  PublicSite,
  Reservation,
  RequestStatus,
  Residence,
  Space,
  Transaction,
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
  title: string;
  discipline: string;
  status: Residence["status"];
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  notes: string | null;
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
