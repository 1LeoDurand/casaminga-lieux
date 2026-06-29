"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, DownloadCloud, Search } from "lucide-react";
import {
  type GrantOpportunity,
  type FunderType,
  FUNDER_TYPE_LABELS,
  GRANT_THEMES,
  FRENCH_REGIONS,
} from "@/lib/grants/types";
import { saveOpportunity, deleteOpportunity, importAidesTerritoires, type OpportunityInput } from "@/app/admin/subventions-veille/actions";

const input = "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-coral";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

const STRUCTURE_TYPES = ["association", "scic", "scop", "collectif", "etablissement", "autre"];

function emptyOpp(): OpportunityInput {
  return {
    title: "", funder: "", funder_type: "region", themes: [], regions: [], structure_types: [],
    amount_min: null, amount_max: null, deadline: null, recurring: false,
    application_url: "", required_documents: [], description: "", published: true,
  };
}

const PAGE = 50;

export function OpportunityEditor({ opportunities }: { opportunities: GrantOpportunity[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<GrantOpportunity | "new" | null>(null);
  const [importing, startImport] = useTransition();

  // Filtres / monitoring super-admin
  const [query, setQuery] = useState("");
  const [funderFilter, setFunderFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("deadline");
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { setLimit(PAGE); }, [query, funderFilter, sourceFilter, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const total = opportunities.length;
    const published = opportunities.filter((o) => o.published).length;
    const at = opportunities.filter((o) => o.source === "aides-territoires").length;
    const soon = opportunities.filter((o) => {
      if (!o.deadline) return false;
      const d = new Date(o.deadline).getTime() - Date.now();
      return d > 0 && d < 30 * 86_400_000;
    }).length;
    return { total, published, hidden: total - published, at, manual: total - at, soon };
  }, [opportunities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = opportunities.filter((o) => {
      if (funderFilter && o.funder_type !== funderFilter) return false;
      if (sourceFilter && o.source !== sourceFilter) return false;
      if (statusFilter === "published" && !o.published) return false;
      if (statusFilter === "hidden" && o.published) return false;
      if (q) {
        const hay = `${o.title} ${o.funder ?? ""} ${o.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title, "fr");
      if (sortBy === "funder") return (a.funder ?? "").localeCompare(b.funder ?? "", "fr");
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ad - bd;
    });
  }, [opportunities, query, funderFilter, sourceFilter, statusFilter, sortBy]);

  const shown = filtered.slice(0, limit);
  const hasFilter = !!(query || funderFilter || sourceFilter || statusFilter);

  function remove(o: GrantOpportunity) {
    if (!confirm(`Supprimer « ${o.title} » ?`)) return;
    startTransition(async () => {
      const res = await deleteOpportunity(o.id);
      if (res.ok) { toast.success("Supprimé"); router.refresh(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  function runImport() {
    startImport(async () => {
      const res = await importAidesTerritoires();
      if (res.ok) {
        toast.success(`Import terminé : ${res.imported ?? 0} nouvelle(s), ${res.updated ?? 0} mise(s) à jour. API : ${res.apiTotal ?? "?"} aides disponibles. Toutes visibles par les lieux.`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erreur d'import");
      }
    });
  }

  const selCls = "rounded-xl border border-border bg-[#FAFAF7] px-3 py-2 text-[13px] text-ink outline-none focus:border-coral";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-warmgray">{stats.total} opportunité(s)</span>
        <div className="flex items-center gap-2">
          <button
            onClick={runImport}
            disabled={importing}
            title="Récupère les aides associatives depuis Aides-Territoires (publiées, visibles des lieux)"
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-4 py-2 text-[13px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            <DownloadCloud className="size-4" /> {importing ? "Import…" : "Importer Aides-Territoires"}
          </button>
          <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] font-bold text-white hover:bg-coral-dark">
            <Plus className="size-4" /> Nouvelle opportunité
          </button>
        </div>
      </div>

      {/* Stats monitoring */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "#2c2c2c" },
          { label: "Publiées", value: stats.published, color: "#2f8a4c" },
          { label: "Échéance < 30j", value: stats.soon, color: "#c2410c" },
          { label: "Aides-Territoires", value: stats.at, color: "#0e6e7a" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-white p-4">
            <div className="font-heading text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-warmgray">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-warmgray" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Rechercher un titre, un financeur…" className="w-full rounded-xl border border-border bg-[#FAFAF7] py-2 pl-9 pr-3 text-[13px] text-ink outline-none focus:border-coral" />
        </div>
        <select value={funderFilter} onChange={(e) => setFunderFilter(e.target.value)} className={selCls}>
          <option value="">Tous financeurs</option>
          {Object.entries(FUNDER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selCls}>
          <option value="">Toutes sources</option>
          <option value="aides-territoires">Aides-Territoires</option>
          <option value="manuel">Manuel</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selCls}>
          <option value="">Tous statuts</option>
          <option value="published">Publiées</option>
          <option value="hidden">Masquées</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selCls}>
          <option value="deadline">Tri : échéance</option>
          <option value="title">Tri : titre</option>
          <option value="funder">Tri : financeur</option>
        </select>
      </div>

      <div className="px-1 text-[12.5px] text-warmgray">
        {filtered.length} résultat{filtered.length > 1 ? "s" : ""}{filtered.length !== stats.total ? ` sur ${stats.total}` : ""}
        {hasFilter && (
          <button onClick={() => { setQuery(""); setFunderFilter(""); setSourceFilter(""); setStatusFilter(""); }} className="ml-2 font-semibold text-coral-dark hover:underline">réinitialiser</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
          {hasFilter ? "Aucune opportunité ne correspond." : "Ajoutez une première opportunité de financement."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <ul className="divide-y divide-border">
            {shown.map((o) => (
              <li key={o.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{o.title}</span>
                    {!o.published && <span className="rounded bg-slate-200 px-1.5 py-px text-[10px] font-bold text-slate-500">MASQUÉ</span>}
                    {o.source === "aides-territoires" && <span className="rounded bg-blue-100 px-1.5 py-px text-[10px] font-bold text-blue-700">AT</span>}
                  </div>
                  <div className="truncate text-[12px] text-warmgray">
                    {o.funder ?? "—"}{o.funder_type ? ` · ${FUNDER_TYPE_LABELS[o.funder_type]}` : ""}
                    {o.deadline ? ` · échéance ${new Date(o.deadline).toLocaleDateString("fr-FR")}` : ""}
                  </div>
                </div>
                <button onClick={() => setEditing(o)} className="rounded-lg p-2 text-warmgray hover:text-coral-dark"><Pencil className="size-4" /></button>
                <button onClick={() => remove(o)} className="rounded-lg p-2 text-warmgray hover:text-red-600"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {filtered.length > shown.length && (
        <button onClick={() => setLimit((l) => l + PAGE)} className="mx-auto rounded-full border border-border bg-white px-6 py-2.5 text-[13px] font-semibold text-ink hover:border-coral/40">
          Afficher plus ({filtered.length - shown.length} restantes)
        </button>
      )}

      {editing && (
        <OppModal
          opp={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function OppModal({ opp, onClose, onSaved }: { opp: GrantOpportunity | null; onClose: () => void; onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<OpportunityInput>(opp ? { ...opp } : emptyOpp());
  const [docs, setDocs] = useState((opp?.required_documents ?? []).join("\n"));

  function toggleArr(key: "themes" | "regions" | "structure_types", val: string) {
    setF((cur) => {
      const arr = cur[key];
      return { ...cur, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });
  }

  function submit() {
    startTransition(async () => {
      const res = await saveOpportunity({
        ...f,
        id: opp?.id,
        required_documents: docs.split("\n").map((d) => d.trim()).filter(Boolean),
      });
      if (res.ok) { toast.success("Enregistré ✓"); onSaved(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${on ? "border-coral bg-coral text-white" : "border-border bg-white text-warmgray hover:border-coral/40"}`}>
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-ink">{opp ? "Modifier" : "Nouvelle opportunité"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-cream"><X className="size-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={labelCls}>Titre *</label><input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><label className={labelCls}>Financeur</label><input className={input} value={f.funder ?? ""} onChange={(e) => setF({ ...f, funder: e.target.value })} placeholder="Région Île-de-France…" /></div>
          <div><label className={labelCls}>Type de financeur</label>
            <select className={input} value={f.funder_type ?? "region"} onChange={(e) => setF({ ...f, funder_type: e.target.value as FunderType })}>
              {Object.entries(FUNDER_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Montant min (€)</label><input type="number" className={input} value={f.amount_min ?? ""} onChange={(e) => setF({ ...f, amount_min: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><label className={labelCls}>Montant max (€)</label><input type="number" className={input} value={f.amount_max ?? ""} onChange={(e) => setF({ ...f, amount_max: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><label className={labelCls}>Date limite</label><input type="date" className={input} value={f.deadline ?? ""} onChange={(e) => setF({ ...f, deadline: e.target.value || null })} /></div>
          <div><label className={labelCls}>Lien officiel</label><input className={input} value={f.application_url ?? ""} onChange={(e) => setF({ ...f, application_url: e.target.value })} placeholder="https://…" /></div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Thématiques</label>
            <div className="flex flex-wrap gap-1.5">{GRANT_THEMES.map((t) => <Chip key={t} on={f.themes.includes(t)} onClick={() => toggleArr("themes", t)}>{t}</Chip>)}</div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Régions éligibles <span className="font-normal text-warmgray">(aucune = national)</span></label>
            <div className="flex flex-wrap gap-1.5">{FRENCH_REGIONS.map((r) => <Chip key={r} on={f.regions.includes(r)} onClick={() => toggleArr("regions", r)}>{r}</Chip>)}</div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Structures éligibles <span className="font-normal text-warmgray">(aucune = toutes)</span></label>
            <div className="flex flex-wrap gap-1.5">{STRUCTURE_TYPES.map((s) => <Chip key={s} on={f.structure_types.includes(s)} onClick={() => toggleArr("structure_types", s)}>{s}</Chip>)}</div>
          </div>

          <div className="sm:col-span-2"><label className={labelCls}>Description</label><textarea className={`${input} min-h-[80px] resize-y`} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Pièces du dossier (une par ligne)</label><textarea className={`${input} min-h-[80px] resize-y`} value={docs} onChange={(e) => setDocs(e.target.value)} placeholder={"Statuts\nRIB\nBudget prévisionnel\nRapport d'activité"} /></div>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} className="size-4 accent-coral" /> Récurrent (chaque année)</label>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} className="size-4 accent-coral" /> Publié (visible des lieux)</label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-coral/40">Annuler</button>
          <button onClick={submit} disabled={pending || !f.title.trim()} className="rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">{pending ? "…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}
