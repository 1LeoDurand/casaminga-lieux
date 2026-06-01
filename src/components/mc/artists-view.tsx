"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Pencil, Trash2, X, ExternalLink, Mail, Phone, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { createArtistAction, updateArtistAction, deleteArtistAction } from "@/app/(admin)/dashboard/[org]/artistes/actions";
import type { Artist } from "@/lib/types";

const DISCIPLINES = [
  { value: "ceramique", label: "Céramique" },
  { value: "peinture", label: "Peinture / Arts plastiques" },
  { value: "musique", label: "Musique" },
  { value: "danse", label: "Danse" },
  { value: "theatre", label: "Théâtre / Scène" },
  { value: "litterature", label: "Littérature / Écriture" },
  { value: "numerique", label: "Arts numériques" },
  { value: "photo", label: "Photographie" },
  { value: "video", label: "Vidéo / Cinéma" },
  { value: "sculpture", label: "Sculpture" },
  { value: "autre", label: "Autre" },
];

const disciplineLabel = (v: string) => DISCIPLINES.find((d) => d.value === v)?.label ?? v;

const STATUS_META: Record<Artist["status"], { label: string; color: string }> = {
  actif:    { label: "Actif",    color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  prospect: { label: "Prospect", color: "bg-blue-50 text-blue-700 border-blue-200" },
  inactif:  { label: "Inactif",  color: "bg-slate-100 text-slate-500 border-slate-200" },
};

const inputCls = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400";

// ── Drawer ───────────────────────────────────────────────────
interface ArtistFormValues {
  name: string; discipline: string; status: Artist["status"];
  bio: string; email: string; phone: string;
  origin_city: string; nationality: string;
  portfolio_url: string; website: string; instagram: string;
  tags: string;
}

const EMPTY: ArtistFormValues = {
  name: "", discipline: "autre", status: "actif",
  bio: "", email: "", phone: "",
  origin_city: "", nationality: "",
  portfolio_url: "", website: "", instagram: "", tags: "",
};

function artistToForm(a: Artist): ArtistFormValues {
  return {
    name: a.name, discipline: a.discipline, status: a.status,
    bio: a.bio ?? "", email: a.email ?? "", phone: a.phone ?? "",
    origin_city: a.origin_city ?? "", nationality: a.nationality ?? "",
    portfolio_url: a.portfolio_url ?? "", website: a.website ?? "",
    instagram: a.instagram ?? "", tags: a.tags.join(", "),
  };
}

function ArtistDrawer({ open, onClose, orgId, orgSlug, editing }: {
  open: boolean; onClose: () => void; orgId: string; orgSlug: string; editing: Artist | null;
}) {
  const [form, setForm] = useState<ArtistFormValues>(editing ? artistToForm(editing) : EMPTY);
  const [tab, setTab] = useState<"profil" | "contact">("profil");
  const [pending, start] = useTransition();

  const set = (k: keyof ArtistFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const input = {
      organization_id: orgId,
      name: form.name.trim(),
      discipline: form.discipline,
      status: form.status,
      bio: form.bio.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      origin_city: form.origin_city.trim() || null,
      nationality: form.nationality.trim() || null,
      portfolio_url: form.portfolio_url.trim() || null,
      website: form.website.trim() || null,
      instagram: form.instagram.trim() || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      photo_url: null,
    };
    start(async () => {
      const ok = editing
        ? (await updateArtistAction(orgSlug, editing.id, input)).ok
        : (await createArtistAction(orgSlug, input)).ok;
      if (ok) { toast.success(editing ? "Artiste mis à jour" : "Artiste créé"); onClose(); }
      else toast.error("Une erreur est survenue");
    });
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{editing ? "Modifier l'artiste" : "Nouvel artiste"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
        </div>
        <div className="flex border-b border-slate-100 px-6">
          {(["profil", "contact"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors capitalize ${tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              {t === "profil" ? "Profil artistique" : "Contact & liens"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 p-6">
            {tab === "profil" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Nom *</label>
                  <input required value={form.name} onChange={set("name")} placeholder="Prénom Nom" className={inputCls + " w-full"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Discipline</label>
                    <select value={form.discipline} onChange={set("discipline")} className={inputCls + " w-full cursor-pointer"}>
                      {DISCIPLINES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Statut</label>
                    <select value={form.status} onChange={set("status")} className={inputCls + " w-full cursor-pointer"}>
                      {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Ville d'origine</label>
                    <input value={form.origin_city} onChange={set("origin_city")} placeholder="Paris" className={inputCls + " w-full"} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Nationalité</label>
                    <input value={form.nationality} onChange={set("nationality")} placeholder="Française" className={inputCls + " w-full"} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Biographie</label>
                  <textarea rows={5} value={form.bio} onChange={set("bio")} placeholder="Présentation de la démarche artistique…" className={inputCls + " w-full resize-none"} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Tags (séparés par des virgules)</label>
                  <input value={form.tags} onChange={set("tags")} placeholder="sculpture, résidence, clay" className={inputCls + " w-full"} />
                </div>
              </>
            )}
            {tab === "contact" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Email</label>
                  <input type="email" value={form.email} onChange={set("email")} placeholder="artiste@mail.com" className={inputCls + " w-full"} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Téléphone</label>
                  <input value={form.phone} onChange={set("phone")} placeholder="+33 6 …" className={inputCls + " w-full"} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Portfolio / Site personnel</label>
                  <input type="url" value={form.portfolio_url} onChange={set("portfolio_url")} placeholder="https://…" className={inputCls + " w-full"} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Site web</label>
                  <input type="url" value={form.website} onChange={set("website")} placeholder="https://…" className={inputCls + " w-full"} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Instagram</label>
                  <input value={form.instagram} onChange={set("instagram")} placeholder="@nomartiste" className={inputCls + " w-full"} />
                </div>
              </>
            )}
          </div>
          <div className="mt-auto border-t border-slate-100 px-6 py-4">
            <button type="submit" disabled={pending}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
              {pending ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer l'artiste"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ── Carte artiste ────────────────────────────────────────────
function ArtistCard({ artist, onEdit, onDelete }: {
  artist: Artist; onEdit: (a: Artist) => void; onDelete: (a: Artist) => void;
}) {
  const meta = STATUS_META[artist.status];
  const initials = artist.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 gap-3">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{artist.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.color}`}>{meta.label}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{disciplineLabel(artist.discipline)}{artist.origin_city ? ` · ${artist.origin_city}` : ""}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => onEdit(artist)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="size-3.5" /></button>
          <button onClick={() => onDelete(artist)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5" /></button>
        </div>
      </div>

      {artist.bio && <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{artist.bio}</p>}

      {artist.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {artist.tags.map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{t}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 border-t border-slate-50">
        {artist.email && <a href={`mailto:${artist.email}`} className="text-slate-400 hover:text-slate-700 transition-colors"><Mail className="size-3.5" /></a>}
        {artist.phone && <a href={`tel:${artist.phone}`} className="text-slate-400 hover:text-slate-700 transition-colors"><Phone className="size-3.5" /></a>}
        {artist.portfolio_url && <a href={artist.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700 transition-colors" title="Portfolio"><ExternalLink className="size-3.5" /></a>}
        {artist.instagram && <a href={`https://instagram.com/${artist.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700 transition-colors text-[10px] font-medium">IG</a>}
        {artist.origin_city && <span className="flex items-center gap-1 text-[10px] text-slate-400 ml-auto"><MapPin className="size-3" />{artist.origin_city}</span>}
      </div>
    </div>
  );
}

// ── Vue principale ───────────────────────────────────────────
export function ArtistsView({ artists, orgSlug, orgId }: {
  artists: Artist[]; orgSlug: string; orgId: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Artist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Artist | null>(null);
  const [search, setSearch] = useState("");
  const [discF, setDiscF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => artists.filter((a) => {
    if (discF !== "all" && a.discipline !== discF) return false;
    if (statusF !== "all" && a.status !== statusF) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
      !a.bio?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [artists, discF, statusF, search]);

  const actifs = artists.filter((a) => a.status === "actif").length;

  function openCreate() { setEditing(null); setDrawerOpen(true); }
  function openEdit(a: Artist) { setEditing(a); setDrawerOpen(true); }

  async function handleDelete() {
    if (!confirmDelete) return;
    start(async () => {
      const ok = (await deleteArtistAction(orgSlug, confirmDelete.id)).ok;
      if (ok) toast.success("Artiste supprimé");
      else toast.error("Erreur");
      setConfirmDelete(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total artistes", value: artists.length, icon: <Users className="size-4" /> },
          { label: "Actifs", value: actifs, icon: <Users className="size-4 text-emerald-600" /> },
          { label: "Disciplines", value: new Set(artists.map((a) => a.discipline)).size, icon: <Users className="size-4 text-blue-600" /> },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-1 text-slate-400">{k.icon}</div>
            <div className="text-xl font-bold text-slate-900">{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barre d'outils */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un artiste…"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 w-56" />
        <select value={discF} onChange={(e) => setDiscF(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400">
          <option value="all">Toutes les disciplines</option>
          {DISCIPLINES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <button onClick={openCreate}
          className="ml-auto flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          <Plus className="size-4" /> Nouvel artiste
        </button>
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
          <Users className="mx-auto mb-3 size-8 opacity-30" />
          <p className="text-sm">{artists.length === 0 ? "Aucun artiste enregistré." : "Aucun résultat."}</p>
          {artists.length === 0 && (
            <button onClick={openCreate} className="mt-3 text-sm text-slate-600 underline underline-offset-2">Ajouter votre premier artiste</button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <ArtistCard key={a.id} artist={a} onEdit={openEdit} onDelete={setConfirmDelete} />
          ))}
        </div>
      )}

      <ArtistDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} orgId={orgId} orgSlug={orgSlug} editing={editing} key={editing?.id ?? "new"} />
      <ConfirmDialog open={!!confirmDelete} title="Supprimer l'artiste"
        message={`Supprimer « ${confirmDelete?.name} » de l'annuaire ? Cette action est irréversible.`}
        tone="danger" busy={pending} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
