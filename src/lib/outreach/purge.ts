import "server-only";
/**
 * Retention of the contacts module (spec 12.4), called by the daily
 * rgpd-purge cron.
 *
 *  - Threads with no exchange for `retention_months` of their program (36 by
 *    default): the thread, its messages, its events and its files are deleted.
 *  - A contact left with no thread is deleted with its addresses, EXCEPT when it
 *    is linked to a member organisation or holds a photo grant still in force.
 *  - A thread that holds a photo grant not revoked is kept whole.
 *  - Identity proofs (threads/<id>/justificatifs/) are deleted 30 days after the
 *    thread is closed.
 *  - Kept: outreach_suppressions (address only), grants in force, context
 *    versions, approved answers.
 *
 * Only counts come back: no address, no name, no path.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgramSettings } from "./types";

const BUCKET = "outreach-files";
const BATCH = 200;
const PROOF_DAYS = 30;

type Admin = SupabaseClient;

export interface OutreachPurge {
  threads: number;
  contacts: number;
  files: number;
  proofs: number;
  total: number;
}

/** All object paths under a prefix (Storage lists one level at a time). */
async function listAll(admin: Admin, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  const { data } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const o of data ?? []) {
    const full = `${prefix}/${o.name}`;
    if (o.id) out.push(full);
    else out.push(...(await listAll(admin, full, depth + 1)));
  }
  return out;
}

async function removeFiles(admin: Admin, paths: string[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    n += data?.length ?? 0;
  }
  return n;
}

export async function purgeOutreach(admin: Admin, now: Date = new Date()): Promise<OutreachPurge> {
  const res: OutreachPurge = { threads: 0, contacts: 0, files: 0, proofs: 0, total: 0 };

  // 1. Identity proofs, 30 days after the closing of their thread.
  const proofCut = new Date(now.getTime() - PROOF_DAYS * 86_400_000).toISOString();
  const { data: stages } = await admin.from("outreach_program_stages").select("program_id, slug").eq("role", "clos");
  const closedBy = new Map<string, string[]>();
  for (const s of (stages ?? []) as { program_id: string; slug: string }[]) {
    const l = closedBy.get(s.program_id) ?? [];
    l.push(s.slug);
    closedBy.set(s.program_id, l);
  }
  for (const [programId, slugs] of closedBy) {
    const { data: closed } = await admin.from("outreach_threads").select("id")
      .eq("program_id", programId).in("status", slugs).lt("status_changed_at", proofCut).limit(BATCH);
    for (const t of (closed ?? []) as { id: string }[]) {
      const paths = await listAll(admin, `threads/${t.id}/justificatifs`);
      if (paths.length > 0) res.proofs += await removeFiles(admin, paths);
    }
  }

  // 2. Threads with no exchange for the retention period of their program.
  const { data: settings } = await admin.from("outreach_settings").select("program_id, retention_months");
  for (const s of (settings ?? []) as Pick<ProgramSettings, "program_id" | "retention_months">[]) {
    const cut = new Date(now);
    cut.setMonth(cut.getMonth() - s.retention_months);
    const cutIso = cut.toISOString();
    const { data: old } = await admin.from("outreach_threads").select("id, contact_id")
      .eq("program_id", s.program_id).lt("created_at", cutIso)
      .or(`last_inbound_at.is.null,last_inbound_at.lt.${cutIso}`)
      .or(`last_outbound_at.is.null,last_outbound_at.lt.${cutIso}`)
      .limit(BATCH);
    const candidates = (old ?? []) as { id: string; contact_id: string }[];
    if (candidates.length === 0) continue;

    // A grant in force keeps its thread and its contact (the FK is RESTRICT anyway).
    const ids = candidates.map((c) => c.id);
    const { data: grants } = await admin.from("outreach_photo_grants").select("id, thread_id, revoked_at").in("thread_id", ids);
    const kept = new Set(((grants ?? []) as { thread_id: string; revoked_at: string | null }[])
      .filter((g) => g.revoked_at === null).map((g) => g.thread_id));
    const doomed = candidates.filter((c) => !kept.has(c.id));
    if (doomed.length === 0) continue;
    const doomedIds = doomed.map((d) => d.id);

    // Files first: once the rows are gone nothing points to them any more.
    for (const id of doomedIds) {
      const paths = await listAll(admin, `threads/${id}`);
      if (paths.length > 0) res.files += await removeFiles(admin, paths);
    }
    // A revoked grant no longer protects anything (its FK would block the deletion).
    await admin.from("outreach_photo_grants").delete().in("thread_id", doomedIds).not("revoked_at", "is", null);
    const { data: gone, error } = await admin.from("outreach_threads").delete().in("id", doomedIds).select("id");
    if (error) {
      console.error("[rgpd-purge] outreach threads not deleted:", error.code);
      continue;
    }
    res.threads += (gone ?? []).length;

    // Contacts left with no thread, no member organisation and no grant.
    const contactIds = [...new Set(doomed.map((d) => d.contact_id))];
    for (const cid of contactIds) {
      const [{ count: left }, { data: c }] = await Promise.all([
        admin.from("outreach_threads").select("id", { count: "exact", head: true }).eq("contact_id", cid),
        admin.from("outreach_contacts").select("organization_id").eq("id", cid).maybeSingle<{ organization_id: string | null }>(),
      ]);
      if ((left ?? 0) > 0 || !c || c.organization_id) continue;
      const { data: removed } = await admin.from("outreach_contacts").delete().eq("id", cid).select("id");
      res.contacts += (removed ?? []).length;
    }
  }

  res.total = res.threads + res.contacts + res.files + res.proofs;
  return res;
}
