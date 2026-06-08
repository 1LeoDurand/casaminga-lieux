import { CheckCircle2, XCircle, AlertTriangle, Mail, Clock, Zap } from "lucide-react";
import { getHealthStats } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

const CRON_LABEL: Record<string, string> = {
  "coworking-invoices":  "Factures coworking",
  "payment-reminders":   "Relances paiement",
  "reminders":           "Rappels J-1 / J-30",
  "newsletters":         "Newsletters auto",
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "jamais";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "< 1h";
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function SantePage() {
  const { crons, email } = await getHealthStats();

  const emailOk = email.rate7d >= 95;
  const emailWarn = email.rate7d >= 80 && email.rate7d < 95;

  const cronsAlert = crons.filter((c) => {
    if (c.status === "jamais") return false; // jamais tourné = pas encore alertant
    if (c.status === "error") return true;
    if (!c.ran_at) return false;
    const h = (Date.now() - new Date(c.ran_at).getTime()) / 3_600_000;
    return h > 30; // cron censé tourner quotidiennement → alerte après 30h
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-coral-dark" />
          <h1 className="font-heading text-2xl font-extrabold text-ink">Santé technique</h1>
        </div>
        <p className="mt-1 text-sm text-warmgray">
          Délivrabilité email + statut des jobs cron quotidiens.
        </p>
      </header>

      {/* Email délivrabilité */}
      <section className="rounded-2xl border border-border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="size-4 text-warmgray" />
          <h2 className="font-heading text-[15px] font-bold text-ink">Délivrabilité email (7 derniers jours)</h2>
          <span className={`ml-auto rounded-full px-3 py-1 text-[12px] font-bold ${emailOk ? "bg-emerald-100 text-emerald-700" : emailWarn ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
            {emailOk ? "✅ OK" : emailWarn ? "⚠️ Dégradé" : "❌ Problème"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Envoyés", value: email.sent7d, color: "#2f8a4c" },
            { label: "Échecs", value: email.failed7d, color: email.failed7d > 0 ? "#c2410c" : "#9c9590" },
            { label: "Total", value: email.total7d, color: "#2c2c2c" },
            { label: "Taux succès", value: `${email.rate7d} %`, color: emailOk ? "#2f8a4c" : "#c2410c" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-cream p-4 text-center">
              <div className="font-heading text-2xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-warmgray">{k.label}</div>
            </div>
          ))}
        </div>

        {email.lastFailure && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <strong>Dernier échec</strong> — {fmtTs(email.lastFailure)}
            {email.lastFailureMsg && <span className="ml-2 text-[12px] opacity-80">· {email.lastFailureMsg}</span>}
          </div>
        )}

        {/* Barre visuelle */}
        {email.total7d > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-warmgray">
              <span>{email.sent7d} succès</span><span>{email.failed7d} échecs</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-red-200">
              <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${email.rate7d}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* Crons */}
      <section className="rounded-2xl border border-border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="size-4 text-warmgray" />
          <h2 className="font-heading text-[15px] font-bold text-ink">Jobs cron — dernière exécution</h2>
          {cronsAlert.length > 0 && (
            <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-[12px] font-bold text-amber-700">
              ⚠️ {cronsAlert.length} alerte{cronsAlert.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="divide-y divide-border">
          {crons.map((c) => {
            const isOk = c.status === "ok";
            const isError = c.status === "error";
            const isNever = c.status === "jamais" || !c.ran_at;
            const h = c.ran_at ? (Date.now() - new Date(c.ran_at).getTime()) / 3_600_000 : 999;
            const isStale = !isNever && h > 30;
            return (
              <div key={c.job_key} className="flex items-center gap-4 py-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full">
                  {isNever ? <Clock className="size-4 text-slate-400" /> :
                   isError || isStale ? <XCircle className="size-4 text-red-500" /> :
                   <CheckCircle2 className="size-4 text-emerald-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">{CRON_LABEL[c.job_key] ?? c.job_key}</div>
                  <div className="text-[11px] text-warmgray font-mono">/api/cron/{c.job_key}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[13px] font-semibold ${isNever ? "text-slate-400" : isError || isStale ? "text-red-600" : "text-emerald-700"}`}>
                    {isNever ? "Jamais exécuté" : fmtRelative(c.ran_at)}
                  </div>
                  {c.ran_at && <div className="text-[11px] text-warmgray">{fmtTs(c.ran_at)}</div>}
                  {c.rows_affected != null && <div className="text-[11px] text-warmgray">{c.rows_affected} ligne{c.rows_affected !== 1 ? "s" : ""}</div>}
                </div>
                {isStale && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    <AlertTriangle className="inline size-3" /> Retard
                  </span>
                )}
                {isError && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Erreur</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-warmgray">
          Schedule attendu : quotidien 07h UTC via GitHub Actions (<code>invoicing-cron.yml</code>).
          Alerte si le dernier run date de plus de 30h.
        </p>
      </section>
    </div>
  );
}
