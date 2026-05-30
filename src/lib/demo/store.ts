import { DEMO_PERSONS, DEMO_REQUESTS, DEMO_SPACES } from "@/lib/demo/data";
import type { IncomingRequest, Person, RequestStatus, Space } from "@/lib/types";

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
