/**
 * Logger pour les jobs cron — écrit dans la table cron_log via service_role.
 * Appelé en fin de chaque route /api/cron/* pour tracer le statut.
 */
import { createAdminClient } from "@/lib/admin/guard";

export async function logCronRun(
  jobKey: string,
  status: "ok" | "error",
  opts: { durationMs?: number; rowsAffected?: number; errorMsg?: string } = {}
) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.from("cron_log").insert({
      job_key: jobKey,
      status,
      duration_ms: opts.durationMs ?? null,
      rows_affected: opts.rowsAffected ?? null,
      error_msg: opts.errorMsg ?? null,
    });
  } catch {
    // Ne jamais faire planter le cron à cause du log
  }
}
