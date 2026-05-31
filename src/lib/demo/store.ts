import {
  DEMO_ANNOUNCEMENTS,
  DEMO_DOCUMENTS,
  DEMO_EVENEMENTS,
  DEMO_MEDIA,
  DEMO_PERSONS,
  DEMO_REQUESTS,
  DEMO_RESERVATIONS,
  DEMO_RESIDENCES,
  DEMO_SPACES,
  DEMO_TRANSACTIONS,
} from "@/lib/demo/data";
import type {
  Announcement,
  Document,
  Evenement,
  IncomingRequest,
  Media,
  Person,
  Reservation,
  RequestStatus,
  Residence,
  Space,
  Transaction,
} from "@/lib/types";

/**
 * Store mutable en mémoire pour le MODE DÉMO uniquement.
 * Permet de tester le flux end-to-end (formulaire → demande → dashboard)
 * sans Supabase.
 *
 * Stocké sur `globalThis` : en dev, le route handler et les Server Components
 * vivent dans des bundles distincts mais le même process Node — un singleton
 * global garantit qu'ils partagent le MÊME tableau. L'état est réinitialisé au
 * redémarrage du serveur. Ne JAMAIS utiliser comme stockage de production.
 */

const globalForDemo = globalThis as unknown as {
  __cmRequests?: IncomingRequest[];
  __cmPersons?: Person[];
  __cmSpaces?: Space[];
  __cmReservations?: Reservation[];
  __cmEvenements?: Evenement[];
  __cmResidences?: Residence[];
  __cmDocuments?: Document[];
  __cmTransactions?: Transaction[];
  __cmMedia?: Media[];
  __cmAnnouncements?: Announcement[];
};

function store(): IncomingRequest[] {
  if (!globalForDemo.__cmRequests) {
    globalForDemo.__cmRequests = DEMO_REQUESTS.map((r) => ({ ...r }));
  }
  return globalForDemo.__cmRequests;
}

export function getDemoRequests(orgId: string): IncomingRequest[] {
  return store()
    .filter((r) => r.organization_id === orgId)
    .sort((a, b) => b.received_at.localeCompare(a.received_at));
}

export function addDemoRequest(
  input: Omit<IncomingRequest, "id" | "status" | "priority" | "received_at"> &
    Partial<Pick<IncomingRequest, "status" | "priority">>
): IncomingRequest {
  const created: IncomingRequest = {
    id: `req-${Date.now()}`,
    status: input.status ?? "nouvelle",
    priority: input.priority ?? "normale",
    received_at: new Date().toISOString(),
    organization_id: input.organization_id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    organization_ext: input.organization_ext,
    type: input.type,
    summary: input.summary,
    message: input.message,
  };
  store().unshift(created);
  return created;
}

export function updateDemoRequestStatus(
  id: string,
  status: RequestStatus
): IncomingRequest | null {
  const found = store().find((r) => r.id === id);
  if (!found) return null;
  found.status = status;
  return found;
}

// ── Personnes (mode démo) ───────────────────────────────────
function personStore(): Person[] {
  if (!globalForDemo.__cmPersons) {
    globalForDemo.__cmPersons = DEMO_PERSONS.map((p) => ({ ...p, tags: [...p.tags] }));
  }
  return globalForDemo.__cmPersons;
}

export function getDemoPersons(orgId: string): Person[] {
  return personStore()
    .filter((p) => p.organization_id === orgId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addDemoPerson(
  input: Omit<Person, "id" | "created_at" | "updated_at">
): Person {
  const now = new Date().toISOString();
  const created: Person = { ...input, id: `person-${Date.now()}`, created_at: now, updated_at: now };
  personStore().unshift(created);
  return created;
}

export function updateDemoPerson(
  id: string,
  patch: Partial<Omit<Person, "id" | "organization_id" | "created_at">>
): Person | null {
  const found = personStore().find((p) => p.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() });
  return found;
}

export function deleteDemoPerson(id: string): boolean {
  const arr = personStore();
  const i = arr.findIndex((p) => p.id === id);
  if (i === -1) return false;
  arr.splice(i, 1);
  return true;
}

// ── Espaces (mode démo) ─────────────────────────────────────
function spaceStore(): Space[] {
  if (!globalForDemo.__cmSpaces) {
    globalForDemo.__cmSpaces = DEMO_SPACES.map((s) => ({ ...s, photos: [...s.photos] }));
  }
  return globalForDemo.__cmSpaces;
}

export function getDemoSpaces(orgId: string): Space[] {
  return spaceStore()
    .filter((s) => s.organization_id === orgId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addDemoSpace(
  input: Omit<Space, "id" | "created_at" | "updated_at">
): Space {
  const now = new Date().toISOString();
  const created: Space = { ...input, id: `space-${Date.now()}`, created_at: now, updated_at: now };
  spaceStore().unshift(created);
  return created;
}

export function updateDemoSpace(
  id: string,
  patch: Partial<Omit<Space, "id" | "organization_id" | "created_at">>
): Space | null {
  const found = spaceStore().find((s) => s.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() });
  return found;
}

export function deleteDemoSpace(id: string): boolean {
  const arr = spaceStore();
  const i = arr.findIndex((s) => s.id === id);
  if (i === -1) return false;
  arr.splice(i, 1);
  return true;
}

// ── Réservations (mode démo) ────────────────────────────────
function reservationStore(): Reservation[] {
  if (!globalForDemo.__cmReservations) {
    globalForDemo.__cmReservations = DEMO_RESERVATIONS.map((r) => ({ ...r }));
  }
  return globalForDemo.__cmReservations;
}

export function getDemoReservations(orgId: string): Reservation[] {
  return reservationStore()
    .filter((r) => r.organization_id === orgId)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

export function getDemoReservationById(id: string): Reservation | null {
  return reservationStore().find((r) => r.id === id) ?? null;
}

/**
 * Cherche un créneau en conflit sur le même espace (statut ≠ annulée).
 * `excludeId` permet d'ignorer la réservation en cours de modification.
 */
export function findDemoReservationConflict(
  orgId: string,
  spaceId: string,
  startAt: string,
  endAt: string,
  excludeId?: string
): Reservation | null {
  return (
    reservationStore().find(
      (r) =>
        r.organization_id === orgId &&
        r.space_id === spaceId &&
        r.status !== "annulee" &&
        r.id !== excludeId &&
        startAt < r.end_at &&
        endAt > r.start_at
    ) ?? null
  );
}

export function addDemoReservation(
  input: Omit<Reservation, "id" | "created_at" | "updated_at">
): Reservation {
  const now = new Date().toISOString();
  const created: Reservation = {
    ...input,
    id: `resa-${Date.now()}`,
    created_at: now,
    updated_at: now,
  };
  reservationStore().unshift(created);
  return created;
}

export function updateDemoReservation(
  id: string,
  patch: Partial<Omit<Reservation, "id" | "organization_id" | "created_at">>
): Reservation | null {
  const found = reservationStore().find((r) => r.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() });
  return found;
}

export function deleteDemoReservation(id: string): boolean {
  const arr = reservationStore();
  const i = arr.findIndex((r) => r.id === id);
  if (i === -1) return false;
  arr.splice(i, 1);
  return true;
}

// ── Événements (mode démo) ──────────────────────────────────
function evenementStore(): Evenement[] {
  if (!globalForDemo.__cmEvenements) {
    globalForDemo.__cmEvenements = DEMO_EVENEMENTS.map((e) => ({ ...e, photos: [...e.photos] }));
  }
  return globalForDemo.__cmEvenements;
}

export function getDemoEvenements(orgId: string): Evenement[] {
  return evenementStore()
    .filter((e) => e.organization_id === orgId)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

export function addDemoEvenement(
  input: Omit<Evenement, "id" | "created_at" | "updated_at">
): Evenement {
  const now = new Date().toISOString();
  const created: Evenement = { ...input, id: `event-${Date.now()}`, created_at: now, updated_at: now };
  evenementStore().unshift(created);
  return created;
}

export function updateDemoEvenement(
  id: string,
  patch: Partial<Omit<Evenement, "id" | "organization_id" | "created_at">>
): Evenement | null {
  const found = evenementStore().find((e) => e.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() });
  return found;
}

export function deleteDemoEvenement(id: string): boolean {
  const arr = evenementStore();
  const i = arr.findIndex((e) => e.id === id);
  if (i === -1) return false;
  arr.splice(i, 1);
  return true;
}

// ── Résidences (mode démo) ──────────────────────────────────
function residenceStore(): Residence[] {
  if (!globalForDemo.__cmResidences) {
    globalForDemo.__cmResidences = DEMO_RESIDENCES.map((r) => ({ ...r }));
  }
  return globalForDemo.__cmResidences;
}
export function getDemoResidences(orgId: string): Residence[] {
  return residenceStore().filter((r) => r.organization_id === orgId)
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
}
export function addDemoResidence(input: Omit<Residence, "id" | "created_at" | "updated_at">): Residence {
  const now = new Date().toISOString();
  const r: Residence = { ...input, id: `res-${Date.now()}`, created_at: now, updated_at: now };
  residenceStore().unshift(r); return r;
}
export function updateDemoResidence(id: string, patch: Partial<Omit<Residence, "id" | "organization_id" | "created_at">>): Residence | null {
  const found = residenceStore().find((r) => r.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() }); return found;
}
export function deleteDemoResidence(id: string): boolean {
  const arr = residenceStore();
  const i = arr.findIndex((r) => r.id === id);
  if (i === -1) return false; arr.splice(i, 1); return true;
}

// ── Documents (mode démo) ───────────────────────────────────
function documentStore(): Document[] {
  if (!globalForDemo.__cmDocuments) {
    globalForDemo.__cmDocuments = DEMO_DOCUMENTS.map((d) => ({ ...d }));
  }
  return globalForDemo.__cmDocuments;
}
export function getDemoDocuments(orgId: string): Document[] {
  return documentStore().filter((d) => d.organization_id === orgId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function addDemoDocument(input: Omit<Document, "id" | "created_at" | "updated_at">): Document {
  const now = new Date().toISOString();
  const d: Document = { ...input, id: `doc-${Date.now()}`, created_at: now, updated_at: now };
  documentStore().unshift(d); return d;
}
export function updateDemoDocument(id: string, patch: Partial<Omit<Document, "id" | "organization_id" | "created_at">>): Document | null {
  const found = documentStore().find((d) => d.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() }); return found;
}
export function deleteDemoDocument(id: string): boolean {
  const arr = documentStore();
  const i = arr.findIndex((d) => d.id === id);
  if (i === -1) return false; arr.splice(i, 1); return true;
}

// ── Transactions / Finances (mode démo) ────────────────────
function txStore(): Transaction[] {
  if (!globalForDemo.__cmTransactions) {
    globalForDemo.__cmTransactions = DEMO_TRANSACTIONS.map((t) => ({ ...t }));
  }
  return globalForDemo.__cmTransactions;
}
export function getDemoTransactions(orgId: string): Transaction[] {
  return txStore().filter((t) => t.organization_id === orgId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function addDemoTransaction(input: Omit<Transaction, "id" | "created_at" | "updated_at">): Transaction {
  const now = new Date().toISOString();
  const t: Transaction = { ...input, id: `tx-${Date.now()}`, created_at: now, updated_at: now };
  txStore().unshift(t); return t;
}
export function updateDemoTransaction(id: string, patch: Partial<Omit<Transaction, "id" | "organization_id" | "created_at">>): Transaction | null {
  const found = txStore().find((t) => t.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() }); return found;
}
export function deleteDemoTransaction(id: string): boolean {
  const arr = txStore();
  const i = arr.findIndex((t) => t.id === id);
  if (i === -1) return false; arr.splice(i, 1); return true;
}

// ── Médiathèque (mode démo) ─────────────────────────────────
function mediaStore(): Media[] {
  if (!globalForDemo.__cmMedia) {
    globalForDemo.__cmMedia = DEMO_MEDIA.map((m) => ({ ...m, tags: [...m.tags] }));
  }
  return globalForDemo.__cmMedia;
}
export function getDemoMedia(orgId: string): Media[] {
  return mediaStore().filter((m) => m.organization_id === orgId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function addDemoMedia(input: Omit<Media, "id" | "created_at" | "updated_at">): Media {
  const now = new Date().toISOString();
  const m: Media = { ...input, id: `media-${Date.now()}`, created_at: now, updated_at: now };
  mediaStore().unshift(m); return m;
}
export function updateDemoMedia(id: string, patch: Partial<Omit<Media, "id" | "organization_id" | "created_at">>): Media | null {
  const found = mediaStore().find((m) => m.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() }); return found;
}
export function deleteDemoMedia(id: string): boolean {
  const arr = mediaStore();
  const i = arr.findIndex((m) => m.id === id);
  if (i === -1) return false; arr.splice(i, 1); return true;
}

// ── Annonces / Communication (mode démo) ────────────────────
function announcementStore(): Announcement[] {
  if (!globalForDemo.__cmAnnouncements) {
    globalForDemo.__cmAnnouncements = DEMO_ANNOUNCEMENTS.map((a) => ({ ...a }));
  }
  return globalForDemo.__cmAnnouncements;
}
export function getDemoAnnouncements(orgId: string): Announcement[] {
  return announcementStore().filter((a) => a.organization_id === orgId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function addDemoAnnouncement(input: Omit<Announcement, "id" | "created_at" | "updated_at">): Announcement {
  const now = new Date().toISOString();
  const a: Announcement = { ...input, id: `ann-${Date.now()}`, created_at: now, updated_at: now };
  announcementStore().unshift(a); return a;
}
export function updateDemoAnnouncement(id: string, patch: Partial<Omit<Announcement, "id" | "organization_id" | "created_at">>): Announcement | null {
  const found = announcementStore().find((a) => a.id === id);
  if (!found) return null;
  Object.assign(found, patch, { updated_at: new Date().toISOString() }); return found;
}
export function deleteDemoAnnouncement(id: string): boolean {
  const arr = announcementStore();
  const i = arr.findIndex((a) => a.id === id);
  if (i === -1) return false; arr.splice(i, 1); return true;
}
