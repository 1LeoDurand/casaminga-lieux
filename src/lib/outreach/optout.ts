/**
 * « Ne plus m'écrire » (spec 7.5 et 12.3).
 *
 * Effets, dans cet ordre (la base n'a pas de transaction côté PostgREST : le
 * premier effet est celui qui protège, le garde `outreach_guard_outbound` lit
 * `do_not_contact` avant tout envoi) :
 *   1. le contact passe en `do_not_contact` (date et origine du PREMIER clic conservées) ;
 *   2. toutes ses adresses vont dans `outreach_suppressions` (raison `opt_out`,
 *      un rebond ou une plainte déjà inscrits ne sont pas écrasés) et passent
 *      en `opt_out` ;
 *   3. tout message sortant NON SOLLICITÉ (premier contact, relance) ou
 *      AUTOMATIQUE, en attente de validation ou planifié, est annulé, dans tous
 *      les programmes ; les réponses de Léo à une demande entrante restent
 *      possibles (portée de 3.3) ;
 *   4. les fils actifs du contact dans les programmes SORTANTS sont clos avec le
 *      motif `ne_plus_ecrire` et annulent leurs relances. Les fils d'un
 *      programme entrant (SAV, billets) restent ouverts : la personne a écrit
 *      la première, et l'opposition ne concerne que la prospection ;
 *   5. un événement (`link.opt_out` ou `link.list_unsubscribe`).
 *
 * Idempotent : un second appel ne crée ni doublon ni erreur ; il n'écrit un
 * événement que s'il a changé quelque chose. Aucune confirmation n'est envoyée
 * (décision de Léo). Le client de service est INJECTÉ : ce fichier ne lit
 * aucun secret et reste testable.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OptOutSource = "lien" | "list_unsubscribe" | "reponse" | "leo" | "plainte";

export interface OptOutInput {
  contactId: string;
  /** Fil d'origine du clic (lien signé), s'il existe. */
  threadId?: string | null;
  source: OptOutSource;
  /** `page` (page du lien) ou `one_click` (POST RFC 8058). */
  via?: "page" | "one_click";
  now?: Date;
}

export interface OptOutResult {
  found: boolean;
  /** Vrai si quelque chose a changé (première fois, fil clos ou message annulé). */
  changed: boolean;
  alreadyOptedOut: boolean;
  addressesSuppressed: number;
  messagesCancelled: number;
  threadsClosed: number;
}

const EMPTY: OptOutResult = {
  found: false, changed: false, alreadyOptedOut: false,
  addressesSuppressed: 0, messagesCancelled: 0, threadsClosed: 0,
};

export async function optOutContact(admin: SupabaseClient, input: OptOutInput): Promise<OptOutResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const { data: contact } = await admin
    .from("outreach_contacts")
    .select("id, do_not_contact")
    .eq("id", input.contactId)
    .maybeSingle<{ id: string; do_not_contact: boolean }>();
  if (!contact) return EMPTY;

  // 1. Le drapeau d'abord : c'est lui que lit le garde d'envoi.
  const alreadyOptedOut = contact.do_not_contact;
  if (!alreadyOptedOut) {
    const { error } = await admin
      .from("outreach_contacts")
      .update({ do_not_contact: true, do_not_contact_at: nowIso, do_not_contact_source: input.source })
      .eq("id", contact.id)
      .eq("do_not_contact", false);
    if (error) throw new Error("optout: contact update failed");
  }

  // 2. Adresses : liste de suppression + état d'adresse.
  const { data: addresses } = await admin
    .from("outreach_addresses")
    .select("id, email, status")
    .eq("contact_id", contact.id)
    .returns<{ id: string; email: string; status: string }[]>();
  const addrs = addresses ?? [];
  let addressesSuppressed = 0;
  if (addrs.length > 0) {
    const { data: existing } = await admin
      .from("outreach_suppressions")
      .select("email")
      .in("email", addrs.map((a) => a.email))
      .returns<{ email: string }[]>();
    const known = new Set((existing ?? []).map((s) => s.email));
    const fresh = addrs.filter((a) => !known.has(a.email));
    if (fresh.length > 0) {
      const { error } = await admin.from("outreach_suppressions").upsert(
        fresh.map((a) => ({
          email: a.email,
          reason: "opt_out",
          source: input.source,
          thread_id: input.threadId ?? null,
        })),
        { onConflict: "email", ignoreDuplicates: true }
      );
      if (error) throw new Error("optout: suppression insert failed");
      addressesSuppressed = fresh.length;
    }
    // Une adresse invalide (rebond) reste invalide : elle bloque tout, pas seulement la prospection.
    const toMark = addrs.filter((a) => a.status === "valide" || a.status === "rebond_temporaire").map((a) => a.id);
    if (toMark.length > 0) {
      await admin
        .from("outreach_addresses")
        .update({ status: "opt_out", status_at: nowIso })
        .in("id", toMark);
    }
  }

  // Fils du contact, avec sens du programme et rôle de l'étape courante.
  const { data: threadRows } = await admin
    .from("outreach_threads")
    .select("id, program_id, status")
    .eq("contact_id", contact.id)
    .returns<{ id: string; program_id: string; status: string }[]>();
  const threads = threadRows ?? [];
  const programIds = [...new Set(threads.map((t) => t.program_id))];

  let messagesCancelled = 0;
  let threadsClosed = 0;

  if (threads.length > 0) {
    // 3. Messages sortants non sollicités ou automatiques, pas encore partis.
    const { data: pending } = await admin
      .from("outreach_messages")
      .select("id, kind, author")
      .in("thread_id", threads.map((t) => t.id))
      .eq("direction", "out")
      .in("send_status", ["a_valider", "planifie"])
      .returns<{ id: string; kind: string; author: string }[]>();
    const toCancel = (pending ?? [])
      .filter((m) => m.kind === "initial" || m.kind === "relance" || m.author === "auto")
      .map((m) => m.id);
    if (toCancel.length > 0) {
      const { error } = await admin
        .from("outreach_messages")
        .update({ send_status: "annule" })
        .in("id", toCancel)
        .in("send_status", ["a_valider", "planifie"]);
      if (!error) messagesCancelled = toCancel.length;
    }

    // 4. Fils actifs des programmes sortants.
    const [{ data: programs }, { data: stages }] = await Promise.all([
      admin.from("outreach_programs").select("id, direction").in("id", programIds)
        .returns<{ id: string; direction: string }[]>(),
      admin.from("outreach_program_stages").select("program_id, slug, role").in("program_id", programIds)
        .returns<{ program_id: string; slug: string; role: string }[]>(),
    ]);
    const outbound = new Set((programs ?? []).filter((p) => p.direction === "sortant").map((p) => p.id));
    const closedSlug = new Map<string, string>();
    const roleOf = new Map<string, string>();
    for (const s of stages ?? []) {
      roleOf.set(`${s.program_id}/${s.slug}`, s.role);
      if (s.role === "clos") closedSlug.set(s.program_id, s.slug);
    }

    for (const t of threads) {
      if (!outbound.has(t.program_id)) continue;
      if (roleOf.get(`${t.program_id}/${t.status}`) === "clos") continue;
      const clos = closedSlug.get(t.program_id);
      if (!clos) continue;
      const { error } = await admin
        .from("outreach_threads")
        .update({ status: clos, closed_reason: "ne_plus_ecrire", opted_out_at: nowIso })
        .eq("id", t.id)
        .eq("status", t.status);
      if (!error) threadsClosed++;
      // Transition refusée par la base : le drapeau du contact protège déjà, on n'insiste pas.
    }
  }

  // Le fil d'origine garde la trace du clic même s'il était déjà clos.
  if (input.threadId) {
    await admin
      .from("outreach_threads")
      .update({ opted_out_at: nowIso })
      .eq("id", input.threadId)
      .is("opted_out_at", null);
  }

  const changed = !alreadyOptedOut || threadsClosed > 0 || messagesCancelled > 0 || addressesSuppressed > 0;

  // 5. Événement (clic du lien uniquement ; les autres origines journalisent chez l'appelant).
  if (changed && input.threadId && (input.source === "lien" || input.source === "list_unsubscribe")) {
    try {
      const origin = threads.find((t) => t.id === input.threadId);
      const { data: t } = await admin
        .from("outreach_threads")
        .select("last_outbound_at")
        .eq("id", input.threadId)
        .maybeSingle<{ last_outbound_at: string | null }>();
      const sentAt = t?.last_outbound_at ? Date.parse(t.last_outbound_at) : NaN;
      await admin.from("outreach_events").insert({
        program_id: origin?.program_id ?? null,
        thread_id: input.threadId,
        contact_id: contact.id,
        actor: "lien",
        type: input.source === "list_unsubscribe" ? "link.list_unsubscribe" : "link.opt_out",
        data: {
          via: input.via ?? null,
          already: alreadyOptedOut,
          threads_closed: threadsClosed,
          messages_cancelled: messagesCancelled,
          // Marque les désinscriptions suspectes d'être un robot de messagerie (spec 8.2).
          within_60s_of_send: Number.isFinite(sentAt) ? now.getTime() - sentAt >= 0 && now.getTime() - sentAt < 60_000 : false,
        },
      });
    } catch {
      // journal facultatif
    }
  }

  return {
    found: true,
    changed,
    alreadyOptedOut,
    addressesSuppressed,
    messagesCancelled,
    threadsClosed,
  };
}
