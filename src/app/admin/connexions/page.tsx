import { LogIn, User, Building2, Clock } from "lucide-react";
import { getUserLoginSummary, getUserLoginHistory, type LoginSummaryRow, type LoginEventRow } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-coral/15 text-[11px] font-bold text-coral-dark">
      {initials}
    </div>
  );
}

function SummaryRow({ row }: { row: LoginSummaryRow }) {
  return (
    <li className="grid grid-cols-1 gap-2 px-5 py-3.5 md:grid-cols-[2fr_1.4fr_1fr_0.8fr] md:items-center md:gap-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={row.full_name} email={row.email} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.full_name ?? "—"}</div>
          <div className="truncate text-[11px] text-warmgray">{row.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        {row.org_name ? (
          <>
            <Building2 className="size-3.5 shrink-0 text-warmgray" />
            <span className="truncate text-[13px] text-ink">{row.org_name}</span>
          </>
        ) : (
          <span className="text-[12px] text-warmgray italic">—</span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-[13px] text-ink">{fmtDateTime(row.last_login)}</span>
        <span className="text-[11px] text-warmgray">{fmtRelative(row.last_login)}</span>
      </div>
      <div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
          row.logins_30d >= 10 ? "bg-emerald-100 text-emerald-700" :
          row.logins_30d >= 3  ? "bg-blue-100 text-blue-700" :
          "bg-slate-100 text-slate-600"
        }`}>
          {row.logins_30d} ce mois
        </span>
      </div>
    </li>
  );
}

function HistoryRow({ ev }: { ev: LoginEventRow }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Clock className="size-3.5 shrink-0 text-warmgray" />
      <span className="flex-1 text-[13px] text-ink">{fmtDateTime(ev.created_at)}</span>
      <span className="text-[12px] text-warmgray">{fmtRelative(ev.created_at)}</span>
    </li>
  );
}

export default async function ConnexionsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { user: selectedUserId } = await searchParams;

  const summary = await getUserLoginSummary();

  const selectedUser = selectedUserId
    ? summary.find((r) => r.user_id === selectedUserId)
    : null;

  const history =
    selectedUserId ? await getUserLoginHistory(selectedUserId) : [];

  const totalToday = summary.filter(
    (r) => Date.now() - new Date(r.last_login).getTime() < 24 * 60 * 60 * 1000
  ).length;
  const total7d = summary.filter(
    (r) => Date.now() - new Date(r.last_login).getTime() < 7 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <LogIn className="size-5 text-coral-dark" />
          <h1 className="font-heading text-2xl font-extrabold text-ink">Connexions</h1>
        </div>
        <p className="mt-1 text-sm text-warmgray">
          Historique des connexions par utilisateur — {summary.length} comptes enregistrés.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="font-heading text-3xl font-extrabold text-ink">{summary.length}</div>
          <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-warmgray">Utilisateurs</div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="font-heading text-3xl font-extrabold" style={{ color: "#2f8a4c" }}>{totalToday}</div>
          <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-warmgray">Connectés aujourd&apos;hui</div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="font-heading text-3xl font-extrabold" style={{ color: "#0e6e7a" }}>{total7d}</div>
          <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-warmgray">Connectés (7 j)</div>
        </div>
      </div>

      {/* Drill-down */}
      {selectedUser && (
        <section className="rounded-2xl border border-coral/30 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={selectedUser.full_name} email={selectedUser.email} />
              <div>
                <div className="font-semibold text-ink">{selectedUser.full_name ?? selectedUser.email}</div>
                <div className="text-[12px] text-warmgray">{selectedUser.email}</div>
              </div>
            </div>
            <a
              href="/admin/connexions"
              className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-warmgray transition-colors hover:bg-cream"
            >
              ← Retour
            </a>
          </div>
          <h2 className="mb-2 font-heading text-[14px] font-bold text-ink">
            Historique — {history.length} connexion{history.length !== 1 ? "s" : ""}
          </h2>
          <ul className="divide-y divide-border">
            {history.length === 0 ? (
              <li className="py-4 text-center text-[13px] text-warmgray">Aucun historique</li>
            ) : (
              history.map((ev) => <HistoryRow key={ev.id} ev={ev} />)
            )}
          </ul>
        </section>
      )}

      {/* Liste résumé */}
      <section>
        <h2 className="mb-3 font-heading text-[15px] font-bold text-ink">
          {selectedUser ? "Tous les utilisateurs" : `${summary.length} utilisateur${summary.length !== 1 ? "s" : ""}`}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[2fr_1.4fr_1fr_0.8fr] gap-4 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
            <span className="flex items-center gap-1.5"><User className="size-3.5" /> Personne</span>
            <span className="flex items-center gap-1.5"><Building2 className="size-3.5" /> Organisation · lieu</span>
            <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> Dernière connexion</span>
            <span>Activité</span>
          </div>
          <ul className="divide-y divide-border">
            {summary.length === 0 ? (
              <li className="py-8 text-center text-[13px] text-warmgray">Aucune connexion enregistrée</li>
            ) : (
              summary.map((row) => (
                <a
                  key={row.user_id}
                  href={`/admin/connexions?user=${row.user_id}`}
                  className="block transition-colors hover:bg-cream/60"
                >
                  <SummaryRow row={row} />
                </a>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
