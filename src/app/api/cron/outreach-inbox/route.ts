import { NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Reads the mailboxes of the contacts module (spec 6.1): INBOX and "Envoyés" of
 * every active mailbox, attaches replies to threads, records bounces and
 * complaints. Secured by CRON_SECRET. Idempotent: message_id is unique, a replay
 * stores nothing twice. Answers 200 "skipped" when no mailbox has its IMAP
 * variables. The log line carries counts only (no address, no mail body).
 * After the mailboxes, the AI reads the new human messages (classify.ts).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const { runInbox, setTriageHook } = await import("@/lib/outreach/inbox");
  const { classifyPending, triageInbound } = await import("@/lib/outreach/classify");
  // Shared mailboxes: the AI picks the program (spec 6.5); any doubt falls back.
  setTriageHook(triageInbound);
  const { runs, configured } = await runInbox();

  if (!configured) {
    await logCronRun("outreach-inbox", "error", { durationMs: Date.now() - started, errorMsg: "service role manquant" });
    return NextResponse.json({ error: "service role manquant" }, { status: 500 });
  }

  // Step 7: read what just arrived (and what a previous pass could not read).
  // Counts and cost only; a reading that fails is retried on the next pass.
  const ai = await classifyPending();

  const active = runs.filter((r) => r.status !== "skipped");
  if (runs.length === 0 || active.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, mailboxes: runs.length, ai });
  }

  const stored = active.reduce((n, r) => n + r.stored, 0);
  const failed = active.filter((r) => r.status === "error");
  if (failed.length > 0) {
    await logCronRun("outreach-inbox", "error", {
      durationMs: Date.now() - started,
      rowsAffected: stored,
      errorMsg: failed.map((r) => `${r.mailbox}: ${r.reason ?? "erreur"}`).join(" | ").slice(0, 500),
    });
  } else {
    await logCronRun("outreach-inbox", "ok", { durationMs: Date.now() - started, rowsAffected: stored });
  }
  return NextResponse.json({ ok: failed.length === 0, runs, ai }, { status: failed.length === 0 ? 200 : 502 });
}
