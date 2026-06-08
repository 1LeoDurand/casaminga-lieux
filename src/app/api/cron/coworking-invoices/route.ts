import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { generateMonthlyInvoices } from "@/lib/invoicing/generate";
import { logCronRun } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Génère les factures coworking dues (tous lieux). Idempotent : respecte
 * day_of_month + last_invoiced_month, donc peut tourner chaque jour sans risque.
 * Sécurisé par CRON_SECRET (header Authorization: Bearer <secret>).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service role manquant" }, { status: 500 });

  const { data: orgs } = await admin.from("organizations").select("id");
  if (!orgs) return NextResponse.json({ ok: true, orgs: 0 });

  let created = 0, emailed = 0;
  const errors: string[] = [];
  for (const o of orgs) {
    const r = await generateMonthlyInvoices(admin, o.id, { sendEmails: true });
    created += r.created;
    emailed += r.emailed;
    errors.push(...r.errors);
  }

  await logCronRun("coworking-invoices", errors.length > 0 ? "error" : "ok", { rowsAffected: created });
  return NextResponse.json({ ok: true, orgs: orgs.length, created, emailed, errors });
}
