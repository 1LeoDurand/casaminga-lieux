"use client";
import { useMemo, useState, useTransition } from "react";
import {
  X, Search, RotateCcw, Plus, Pencil, Trash2, Home, User, Calendar,
  CheckCircle2, XCircle, Check, Clock, Circle, Euro, FileText, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { ResidenceForm, type ResidenceFormValues } from "@/components/mc/residence-form";
import {
  RESIDENCE_DISCIPLINES, RESIDENCE_STATUSES,
  disciplineLabel, disciplineBadge, residenceStatusLabel, residenceStatusBadge,
  formatDateRange, formatDate, durationDays, residenceInitials,
} from "@/lib/residences-meta";
import {
  createResidenceAction, deleteResidenceAction, updateResidenceAction,
  createMilestoneAction, updateMilestoneAction, deleteMilestoneAction,
} from "@/app/(admin)/dashboard/[org]/residences/actions";
import { getMilestonesForResidence } from "@/lib/data";
import type { Artist, ArtistMilestone, Person, Residence, Space } from "@/lib/types";

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set); if (n.has(v)) { n.delete(v); } else { n.add(v); } return n;
}
function DiscBadge({ d }: { d: string }) {
  return <span className={`mc-badge ${disciplineBadge(d)}`}>{disciplineLabel(d)}</span>;
}
function StatBadge({ s }: { s: string }) {
  return <span className={`mc-badge ${residenceStatusBadge(s)}`}>{residenceStatusLabel(s)}</span>;
}

const MILESTONE_STATUS_ICONS: Record<string, React.ReactNode> = {
  a_faire: <Circle className="size-4 text-warmgray" />,
  en_cours: <Clock className="size-4 text-amber-500" />,
  fait: <Check className="size-4 text-emerald-600" />,
};
const MILESTONE_STATUS_LABELS = { a_faire: "À faire", en_cours: "En cours", fait: "Fait" };

// ── Panel jalons (lazy-loaded) ────────────────────────────────
function MilestonesPanel({ residenceId }: { residenceId: string }) {
  const [milestones, setMilestones] = useState<ArtistMilestone[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [, startT] = useTransition();

  async function load() {
    if (loaded) return;
    setLoading(true);
    setMilestones(await getMilestonesForResidence(residenceId));
    setLoaded(true);
    setLoading(false);
  }

  function toggleStatus(m: ArtistMilestone) {
    const next = m.status === "fait" ? "a_faire" : m.status === "a_faire" ? "en_cours" : "fait";
    startT(async () => {
      const r = await updateMilestoneAction(m.id, {
        status: next,
        done_at: next === "fait" ? new Date().toISOString() : null,
      });
      if (r.ok) setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, status: next, done_at: next === "fait" ? new Date().toISOString() : null } : x));
      else toast.error("Erreur.");
    });
  }

  function addMilestone() {
    if (!newTitle.trim()) return;
    startT(async () => {
      const r = await createMilestoneAction({
        residence_id: residenceId,
        title: newTitle.trim(),
        description: null,
        due_date: newDue || null,
        done_at: null,
        status: "a_faire",
      });
      if (r.ok) {
        setMilestones(await getMilestonesForResidence(residenceId));
        setNewTitle(""); setNewDue(""); setAdding(false);
      } else toast.error("Erreur.");
    });
  }

  function removeMilestone(id: string) {
    if (!confirm("Supprimer ce jalon ?")) return;
    startT(async () => {
      const r = await deleteMilestoneAction(id);
      if (r.ok) setMilestones((prev) => prev.filter((m) => m.id !== id));
      else toast.error("Erreur.");
    });
  }

  return (
    <div className="mt-2">
      {!loaded ? (
        <button onClick={load} disabled={loading} className="text-[13px] font-semibold text-coral-dark hover:underline">
          {loading ? "Chargement…" : "Afficher les jalons"}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {milestones.length === 0 && !adding && (
            <p className="text-[12px] text-warmgray">Aucun jalon — <button className="text-coral-dark hover:underline" onClick={() => setAdding(true)}>Ajouter</button></p>
          )}
          {milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
              <button onClick={() => toggleStatus(m)} title={MILESTONE_STATUS_LABELS[m.status]} className="shrink-0">
                {MILESTONE_STATUS_ICONS[m.status]}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`text-[13px] font-medium ${m.status === "fait" ? "line-through text-warmgray" : "text-foreground"}`}>{m.title}</span>
                {m.due_date && <span className="ml-2 text-[11px] text-warmgray">{formatDate(m.due_date)}</span>}
              </div>
              <button onClick={() => removeMilestone(m.id)} className="shrink-0 rounded p-1 text-warmgray hover:text-red-500">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {adding ? (
            <div className="flex gap-2">
              <input
                autoFocus className="mc-input flex-1 text-[13px]" placeholder="Titre du jalon…"
                value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addMilestone(); if (e.key === "Escape") setAdding(false); }}
              />
              <input className="mc-input w-32 text-[13px]" type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
              <button className="mc-btn mc-btn-lime mc-btn-sm" onClick={addMilestone}>Ajouter</button>
              <button className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => setAdding(false)}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="self-start text-[12px] font-semibold text-coral-dark hover:underline">
              <Plus className="inline size-3.5" /> Jalon
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ResidencesView({ residences, spaces, persons, artists, orgSlug, orgId }: {
  residences: Residence[]; spaces: Space[]; persons: Person[]; artists: Artist[];
  orgSlug: string; orgId: string;
}) {
  const [search, setSearch] = useState("");
  const [discF, setDiscF] = useState<Set<string>>(new Set());
  const [statF, setStatF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Residence | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Residence | null>(null);
  const [pending, startTransition] = useTransition();

  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const spaceName = (id: string | null) => id ? spaceById.get(id)?.name ?? null : null;
  const personName = (id: string | null) => id ? personById.get(id)?.name ?? null : null;
  const artistName = (id: string | null) => id ? artistById.get(id)?.name ?? null : null;
  const selected = residences.find((r) => r.id === selectedId) ?? null;

  const kpis = useMemo(() => ({
    total: residences.length,
    enCours: residences.filter((r) => r.status === "en_cours").length,
    acceptees: residences.filter((r) => r.status === "acceptee").length,
    candidatures: residences.filter((r) => r.status === "candidature").length,
    terminees: residences.filter((r) => r.status === "terminee").length,
  }), [residences]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residences.filter((r) => {
      if (discF.size && !discF.has(r.discipline)) return false;
      if (statF.size && !statF.has(r.status)) return false;
      if (q) {
        const hay = [r.title, r.description, spaceName(r.space_id), personName(r.person_id), artistName(r.artist_id)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residences, search, discF, statF, spaceById, personById, artistById]);

  const hasFilters = search.trim() !== "" || discF.size > 0 || statF.size > 0;

  function submitForm(values: ResidenceFormValues) {
    const payload = {
      space_id: values.spaceId || null,
      person_id: values.personId || null,
      artist_id: values.artistId || null,
      title: values.title,
      discipline: values.discipline,
      status: values.status,
      start_date: values.startDate || null,
      end_date: values.endDate || null,
      description: values.description.trim() || null,
      notes: values.notes.trim() || null,
      budget: values.budget ? Number(values.budget) : null,
      logement_fourni: values.logementFourni,
      logement_notes: values.logementNotes.trim() || null,
      convention_signee: values.conventionSignee,
      convention_date: values.conventionDate || null,
      restitution_date: values.restitutionDate || null,
      restitution_status: values.restitutionStatus,
      projet_description: values.projetDescription.trim() || null,
    };
    startTransition(async () => {
      const res = editing
        ? await updateResidenceAction(orgSlug, editing.id, payload)
        : await createResidenceAction(orgSlug, { ...payload, organization_id: orgId });
      if (res.ok) { toast.success(editing ? "Résidence mise à jour" : "Résidence créée"); setFormOpen(false); setEditing(null); }
      else toast.error("Action impossible. Réessayez.");
    });
  }

  function quickStatus(r: Residence, status: Residence["status"]) {
    startTransition(async () => {
      const res = await updateResidenceAction(orgSlug, r.id, { status });
      if (res.ok) toast.success(`Résidence ${residenceStatusLabel(status).toLowerCase()}`);
      else toast.error("Action impossible. Réessayez.");
    });
  }

  function doDelete(r: Residence) {
    startTransition(async () => {
      const { ok } = await deleteResidenceAction(orgSlug, r.id);
      if (ok) { toast.success("Résidence supprimée"); setConfirmDelete(null); setSelectedId(null); }
      else toast.error("Suppression impossible.");
    });
  }

  if (residences.length === 0) {
    return (
      <>
        <div className="mc-card"><div className="mc-empty">
          <span className="mc-empty-ic"><Home className="size-6" strokeWidth={1.8} /></span>
          <div className="mc-empty-title">Aucune résidence pour le moment</div>
          <p className="mc-empty-sub">Gérez les candidatures et les résidences artistiques accueillies dans votre lieu.</p>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle résidence</button>
        </div></div>
        <ResidenceForm key="create-open" open={formOpen} residence={null} spaces={spaces} persons={persons} artists={artists} busy={pending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />
      </>
    );
  }

  const euros = (n: number | null) => n != null ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-kpi-grid">
        <div className="mc-stat"><div className="mc-stat-val">{kpis.total}</div><div className="mc-stat-lbl">Résidences</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{kpis.enCours}</div><div className="mc-stat-lbl">En cours</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#a06800" }}>{kpis.acceptees}</div><div className="mc-stat-lbl">Acceptées</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#0a6b78" }}>{kpis.candidatures}</div><div className="mc-stat-lbl">Candidatures</div></div>
        <div className="mc-stat"><div className="mc-stat-val" style={{ color: "#8a8a8a" }}>{kpis.terminees}</div><div className="mc-stat-lbl">Terminées</div></div>
      </div>

      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-search"><span className="mc-search-ic"><Search className="size-4" /></span>
            <input className="mc-input" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-3.5" /> Nouvelle</button>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm" onClick={() => { setSearch(""); setDiscF(new Set()); setStatF(new Set()); }} disabled={!hasFilters}><RotateCcw className="size-3.5" /> Réinitialiser</button>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Discipline</span>
          <div className="mc-chips">{RESIDENCE_DISCIPLINES.map((d) => (
            <button key={d.value} type="button" className={`mc-chip ${discF.has(d.value) ? "active" : ""}`} onClick={() => setDiscF((s) => toggle(s, d.value))}>{d.label}</button>
          ))}</div>
        </div>
        <div className="mc-filter-row"><span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">{RESIDENCE_STATUSES.map((s) => (
            <button key={s.value} type="button" className={`mc-chip ${statF.has(s.value) ? "active" : ""}`} onClick={() => setStatF((set) => toggle(set, s.value))}>{s.label}</button>
          ))}</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mc-card"><div className="mc-empty">
          <span className="mc-empty-ic"><Search className="size-6" strokeWidth={1.8} /></span>
          <div className="mc-empty-title">Aucun résultat</div>
          <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" onClick={() => { setSearch(""); setDiscF(new Set()); setStatF(new Set()); }}><RotateCcw className="size-3.5" /> Réinitialiser</button>
        </div></div>
      ) : (
        <div className="mc-card overflow-hidden">
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>Résidence</th><th>Discipline</th><th>Statut</th><th>Période</th><th>Artiste / Résident·e</th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => setSelectedId(r.id)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-peach-pale text-[11px] font-bold text-coral-dark">{residenceInitials(r.title)}</span>
                        <span className="font-semibold text-foreground">{r.title}</span>
                      </div>
                    </td>
                    <td><DiscBadge d={r.discipline} /></td>
                    <td><StatBadge s={r.status} /></td>
                    <td className="text-[12px] text-warmgray">{formatDateRange(r.start_date, r.end_date)}</td>
                    <td className="text-[12px] text-warmgray">
                      {artistName(r.artist_id) ?? personName(r.person_id) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Drawer détail ── */}
      {selected ? (
        <>
          <button type="button" aria-label="Fermer" className="mc-drawer-ov" onClick={() => setSelectedId(null)} />
          <aside className="mc-drawer" aria-label="Fiche résidence">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selected.title}</h2>
                <div className="mt-1 flex flex-wrap gap-1.5"><DiscBadge d={selected.discipline} /><StatBadge s={selected.status} /></div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-warmgray hover:bg-peach-pale"><X className="size-5" /></button>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto p-6">
              {/* Infos de base */}
              <dl className="grid grid-cols-1 gap-2 rounded-xl bg-white p-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 shrink-0 text-warmgray" />
                  <span className="font-medium">{formatDateRange(selected.start_date, selected.end_date)}</span>
                  {durationDays(selected.start_date, selected.end_date) ? <span className="text-warmgray">({durationDays(selected.start_date, selected.end_date)})</span> : null}
                </div>
                {spaceName(selected.space_id) ? <div className="flex items-center gap-2"><Home className="size-4 shrink-0 text-warmgray" /><span>{spaceName(selected.space_id)}</span></div> : null}
                {artistName(selected.artist_id) ? <div className="flex items-center gap-2"><User className="size-4 shrink-0 text-warmgray" /><span className="font-medium">{artistName(selected.artist_id)}</span><span className="text-warmgray">(annuaire)</span></div> : null}
                {personName(selected.person_id) ? <div className="flex items-center gap-2"><User className="size-4 shrink-0 text-warmgray" /><span>{personName(selected.person_id)}</span><span className="text-warmgray">(CRM)</span></div> : null}
              </dl>

              {/* Budget + convention + logement */}
              {(selected.budget != null || selected.convention_signee || selected.logement_fourni) ? (
                <div className="rounded-xl bg-white p-4">
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-warmgray">Conditions d'accueil</h3>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {selected.budget != null ? (
                      <div className="flex items-center gap-1.5">
                        <Euro className="size-4 text-warmgray" />
                        <span className="font-semibold">{euros(selected.budget)}</span>
                        <span className="text-warmgray">budget</span>
                      </div>
                    ) : null}
                    {selected.logement_fourni ? (
                      <div className="flex items-center gap-1.5">
                        <Home className="size-4 text-emerald-600" />
                        <span className="font-medium text-emerald-700">Logement fourni</span>
                        {selected.logement_notes ? <span className="text-warmgray">— {selected.logement_notes}</span> : null}
                      </div>
                    ) : null}
                    {selected.convention_signee ? (
                      <div className="flex items-center gap-1.5">
                        <FileText className="size-4 text-emerald-600" />
                        <span className="font-medium text-emerald-700">Convention signée</span>
                        {selected.convention_date ? <span className="text-warmgray">{formatDate(selected.convention_date)}</span> : null}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <FileText className="size-4 text-amber-500" />
                        <span className="text-amber-700">Convention non signée</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Restitution */}
              {selected.restitution_status !== "non_prevu" || selected.restitution_date ? (
                <div className="rounded-xl bg-white p-4">
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-warmgray">Restitution</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <Flag className="size-4 text-warmgray" />
                    <span>
                      {selected.restitution_status === "planifiee" ? "Planifiée" :
                       selected.restitution_status === "realisee" ? "Réalisée ✓" :
                       selected.restitution_status === "annulee" ? "Annulée" : ""}
                    </span>
                    {selected.restitution_date ? <span className="text-warmgray">{formatDate(selected.restitution_date)}</span> : null}
                  </div>
                </div>
              ) : null}

              {/* Description */}
              {selected.description ? (
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-warmgray">Projet</h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.description}</p>
                </div>
              ) : null}

              {/* Notes */}
              {selected.notes ? (
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-warmgray">Notes internes</h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">{selected.notes}</p>
                </div>
              ) : null}

              {/* Jalons */}
              <div>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-warmgray">Jalons</h3>
                <MilestonesPanel residenceId={selected.id} />
              </div>

              {/* Actions statut */}
              <div className="flex flex-wrap gap-2">
                {selected.status === "candidature" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "acceptee")} className="mc-btn mc-btn-outline mc-btn-sm"><CheckCircle2 className="size-3.5" /> Accepter</button> : null}
                {selected.status === "acceptee" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "en_cours")} className="mc-btn mc-btn-outline mc-btn-sm"><CheckCircle2 className="size-3.5" /> Démarrer</button> : null}
                {selected.status === "en_cours" ? <button type="button" disabled={pending} onClick={() => quickStatus(selected, "terminee")} className="mc-btn mc-btn-outline mc-btn-sm"><CheckCircle2 className="size-3.5" /> Terminer</button> : null}
                {(selected.status === "candidature" || selected.status === "acceptee") ? (
                  <button type="button" disabled={pending} onClick={() => quickStatus(selected, "refusee")} className="mc-btn mc-btn-outline mc-btn-sm"><XCircle className="size-3.5" /> Refuser</button>
                ) : null}
              </div>
            </div>

            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button type="button" disabled={pending} onClick={() => { setEditing(selected); setFormOpen(true); }} className="mc-btn mc-btn-lime flex-1"><Pencil className="size-4" /> Modifier</button>
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(selected)} className="mc-btn mc-btn-outline"><Trash2 className="size-4" /> Supprimer</button>
            </div>
          </aside>
        </>
      ) : null}

      <ResidenceForm
        key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen} residence={editing} spaces={spaces} persons={persons} artists={artists} busy={pending}
        onClose={() => { setFormOpen(false); setEditing(null); }} onSubmit={submitForm} />

      <ConfirmDialog open={confirmDelete !== null} title="Supprimer cette résidence ?"
        message={confirmDelete ? `« ${confirmDelete.title} » sera définitivement supprimée.` : ""}
        confirmLabel="Supprimer" tone="danger" busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)} />
    </div>
  );
}
