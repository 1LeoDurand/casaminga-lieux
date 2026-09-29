/**
 * Attaching an incoming mail to a thread (spec 6.4). Order, first hit wins,
 * always inside the mailbox being read:
 *   1. In-Reply-To = known message_id      -> in_reply_to
 *   2. a References id = known message_id  -> references
 *   3. sender = address of a live thread (or closed < 90 days) + same normalised
 *      subject                             -> adresse_sujet
 *   4. sender = address with exactly one live thread -> adresse (uncertain)
 * The pure decision helpers are exported for scripts/outreach-parse-check.mjs;
 * the database lookups are in matchThread and load the admin client lazily.
 */
import type { ParsedInbound } from "./parse";

export type MatchMethod = "in_reply_to" | "references" | "adresse_sujet" | "adresse";

export interface MatchResult {
  threadId: string;
  method: MatchMethod;
  /** Message the mail answers (headers 1 and 2 only). */
  replyToMessageId: string | null;
}

const PREFIX = /^\s*(?:(?:re|réf|ref|tr|fw|fwd|aw|wg|rv|sv|vs|r)(?:\[\d+\])?\s*:\s*)+/i;

/** Subject without reply/forward prefixes, accents and case, single-spaced. */
export function normalizeSubject(s: string): string {
  return (s ?? "")
    .replace(PREFIX, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface AddressThreadCandidate {
  threadId: string;
  emailSubject: string;
  /** Stage role is not "clos". */
  live: boolean;
  /** status_changed_at, used for closed threads. */
  changedAt: Date;
}

const CLOSED_WINDOW_DAYS = 90;

/** Steps 3 and 4 on already-loaded candidates (all belong to the sender's address). */
export function decideByAddress(
  candidates: AddressThreadCandidate[],
  subject: string,
  now: Date = new Date(),
): { threadId: string; method: "adresse_sujet" | "adresse" } | null {
  const norm = normalizeSubject(subject);
  const limit = now.getTime() - CLOSED_WINDOW_DAYS * 86_400_000;
  const eligible = candidates.filter((c) => c.live || c.changedAt.getTime() >= limit);
  const bySubject = eligible
    .filter((c) => norm !== "" && normalizeSubject(c.emailSubject) === norm)
    // Prefer a live thread, then the most recent.
    .sort((a, b) => Number(b.live) - Number(a.live) || b.changedAt.getTime() - a.changedAt.getTime());
  if (bySubject.length > 0) return { threadId: bySubject[0].threadId, method: "adresse_sujet" };
  const live = candidates.filter((c) => c.live);
  if (live.length === 1) return { threadId: live[0].threadId, method: "adresse" };
  return null;
}

/** Ids to look up for steps 1 and 2, in priority order (latest reference first). */
export function headerIds(p: Pick<ParsedInbound, "inReplyTo" | "references">): { irt: string | null; refs: string[] } {
  return { irt: p.inReplyTo, refs: [...p.references].reverse() };
}

interface MsgRow { id: string; message_id: string; thread_id: string }

/** Steps 1 and 2 only (used for the "Envoyés" folder as well). */
export async function matchByHeaders(mailboxKey: string, p: ParsedInbound): Promise<MatchResult | null> {
  const { irt, refs } = headerIds(p);
  const ids = [...new Set([...(irt ? [irt] : []), ...refs])];
  if (ids.length === 0) return null;
  const { createAdminClient } = await import("@/lib/admin/guard");
  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("outreach_messages")
    .select("id, message_id, thread_id")
    .in("message_id", ids)
    .returns<MsgRow[]>();
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const inMailbox = await threadsInMailbox(mailboxKey, [...new Set(rows.map((r) => r.thread_id))]);
  const ok = rows.filter((r) => inMailbox.has(r.thread_id));
  const byId = new Map(ok.map((r) => [r.message_id, r]));
  if (irt && byId.has(irt)) {
    const r = byId.get(irt)!;
    return { threadId: r.thread_id, method: "in_reply_to", replyToMessageId: r.id };
  }
  for (const ref of refs) {
    const r = byId.get(ref);
    if (r) return { threadId: r.thread_id, method: "references", replyToMessageId: r.id };
  }
  return null;
}

/** Subset of `threadIds` whose program is served by this mailbox. */
async function threadsInMailbox(mailboxKey: string, threadIds: string[]): Promise<Set<string>> {
  if (threadIds.length === 0) return new Set();
  const { createAdminClient } = await import("@/lib/admin/guard");
  const admin = createAdminClient();
  if (!admin) return new Set();
  const { data } = await admin
    .from("outreach_threads")
    .select("id, outreach_programs!inner(mailbox_key)")
    .in("id", threadIds)
    .eq("outreach_programs.mailbox_key", mailboxKey)
    .returns<{ id: string }[]>();
  return new Set((data ?? []).map((t) => t.id));
}

export async function matchThread(mailboxKey: string, p: ParsedInbound): Promise<MatchResult | null> {
  const byHeader = await matchByHeaders(mailboxKey, p);
  if (byHeader) return byHeader;
  if (!p.fromEmail) return null;

  const { createAdminClient } = await import("@/lib/admin/guard");
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: addrs } = await admin
    .from("outreach_addresses").select("id").eq("email", p.fromEmail).returns<{ id: string }[]>();
  if (!addrs || addrs.length === 0) return null;

  const { data: threads } = await admin
    .from("outreach_threads")
    .select("id, program_id, status, email_subject, status_changed_at, outreach_programs!inner(mailbox_key)")
    .in("address_id", addrs.map((a) => a.id))
    .eq("outreach_programs.mailbox_key", mailboxKey)
    .returns<{ id: string; program_id: string; status: string; email_subject: string; status_changed_at: string }[]>();
  if (!threads || threads.length === 0) return null;

  const { data: stages } = await admin
    .from("outreach_program_stages")
    .select("program_id, slug, role")
    .in("program_id", [...new Set(threads.map((t) => t.program_id))])
    .returns<{ program_id: string; slug: string; role: string }[]>();
  const role = new Map((stages ?? []).map((s) => [`${s.program_id}/${s.slug}`, s.role]));

  const res = decideByAddress(
    threads.map((t) => ({
      threadId: t.id,
      emailSubject: t.email_subject,
      live: role.get(`${t.program_id}/${t.status}`) !== "clos",
      changedAt: new Date(t.status_changed_at),
    })),
    p.subject,
  );
  return res ? { threadId: res.threadId, method: res.method, replyToMessageId: null } : null;
}
