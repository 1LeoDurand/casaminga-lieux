import { NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Actualisation automatique du catalogue de subventions depuis
 * Aides-Territoires (Lot 12 P4). Conçu pour tourner 1×/semaine :
 *  - nouvelles aides → insérées en `published: false` (relecture super-admin)
 *  - aides déjà importées → deadline/montants/description rafraîchis
 * Sécurisé par CRON_SECRET ; idempotent (anti-doublon external_id).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { syncAidesTerritoires } = await import("@/lib/grants/aides-territoires");
  const res = await syncAidesTerritoires(50);

  if (!res.ok) {
    await logCronRun("aides-territoires", "error", { errorMsg: res.error });
    return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  }

  await logCronRun("aides-territoires", "ok", { rowsAffected: res.imported + res.updated });
  return NextResponse.json({ ok: true, imported: res.imported, updated: res.updated });
}
