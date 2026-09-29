import { NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Send queue of the contacts module (spec 5.1). Secured by CRON_SECRET.
 * For every active mailbox whose SMTP variables are present: health check,
 * due messages inside the sending window and the caps, copy in "Envoyés", then
 * the delay tasks. Answers 200 "skipped" when no mailbox can send (variables
 * absent, no active program): nothing leaves and the queue is kept. The log
 * line and the response carry counts only (no address, no mail body).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const { runSendQueue } = await import("@/lib/outreach/queue");
  const { runs, configured, delays } = await runSendQueue();

  if (!configured) {
    await logCronRun("outreach-send", "error", { durationMs: Date.now() - started, errorMsg: "service role manquant" });
    return NextResponse.json({ error: "service role manquant" }, { status: 500 });
  }

  const active = runs.filter((r) => r.status !== "skipped");
  const delayed = delays.closedNoReply + delays.slaFlagged + delays.resolvedClosed;
  if (active.length === 0) {
    if (delayed > 0) await logCronRun("outreach-send", "ok", { durationMs: Date.now() - started, rowsAffected: delayed });
    return NextResponse.json({ ok: true, skipped: true, mailboxes: runs.length, delays });
  }

  const sent = active.reduce((n, r) => n + r.sent, 0);
  const failed = active.filter((r) => r.status === "error");
  if (failed.length > 0) {
    await logCronRun("outreach-send", "error", {
      durationMs: Date.now() - started,
      rowsAffected: sent + delayed,
      errorMsg: failed.map((r) => `${r.mailbox}: ${r.reason ?? "erreur"}`).join(" | ").slice(0, 500),
    });
  } else {
    await logCronRun("outreach-send", "ok", { durationMs: Date.now() - started, rowsAffected: sent + delayed });
  }
  return NextResponse.json({ ok: failed.length === 0, runs, delays }, { status: failed.length === 0 ? 200 : 502 });
}
