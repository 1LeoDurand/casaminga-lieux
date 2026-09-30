"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Eye, ThumbsUp, ThumbsDown, DownloadCloud } from "lucide-react";
import type { HelpArticleAdmin, HelpCategoryAdmin } from "@/lib/admin/data";
import {
  seedDefaultHelp,
  saveHelpArticle,
  deleteHelpArticle,
  saveHelpCategory,
  deleteHelpCategory,
  type ArticleInput,
  type CategoryInput,
  type HelpAudience,
} from "@/app/admin/aide/actions";

const AUDIENCE_LABEL: Record<HelpAudience, string> = { admin: "Admin", public: "Portail", sejour: "Séjours" };

const input =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function HelpEditor({
  articles,
  categories,
  defaultAudience = "admin",
  showAudience = false,
}: {
  articles: HelpArticleAdmin[];
  categories: HelpCategoryAdmin[];
  defaultAudience?: HelpAudience;
  showAudience?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<HelpArticleAdmin | "new" | null>(null);
  const [editingCategory, setEditingCategory] = useState<HelpCategoryAdmin | "new" | null>(null);

  function importDefaults() {
    startTransition(async () => {
      const res = await seedDefaultHelp();
      if (res.ok) { toast.success(res.summary ?? "Importé ✓"); router.refresh(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  function remove(slug: string, title: string) {
    if (!confirm(`Supprimer l'article « ${title} » ?`)) return;
    startTransition(async () => {
      const res = await deleteHelpArticle(slug);
      if (res.ok) { toast.success("Supprimé"); router.refresh(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  function removeCategory(slug: string, label: string) {
    if (!confirm(`Supprimer la catégorie « ${label} » ?`)) return;
    startTransition(async () => {
      const res = await deleteHelpCategory(slug);
      if (res.ok) { toast.success("Supprimée"); router.refresh(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  const empty = articles.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-warmgray">
          {empty ? "Aucun article en base — le site affiche le contenu par défaut." : `${articles.length} article(s)`}
        </span>
        <div className="flex gap-2">
          <button onClick={importDefaults} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40 disabled:opacity-50">
            <DownloadCloud className="size-4" /> {empty ? "Importer le contenu par défaut" : "Réimporter les défauts"}
          </button>
          <button onClick={() => setEditing("new")} disabled={categories.length === 0 && empty}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] font-bold text-white hover:bg-coral-dark disabled:opacity-50">
            <Plus className="size-4" /> Nouvel article
          </button>
        </div>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
          Cliquez sur <strong>Importer le contenu par défaut</strong> pour démarrer l'édition autonome,
          puis créez ou modifiez vos articles.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <ul className="divide-y divide-border">
            {articles.map((a) => (
              <li key={a.slug} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{a.title}</span>
                    {!a.published && <span className="rounded bg-slate-200 px-1.5 py-px text-[10px] font-bold text-slate-500">BROUILLON</span>}
                    {showAudience && (
                      <span className="rounded bg-indigo-50 px-1.5 py-px text-[10px] font-bold text-indigo-700">
                        {AUDIENCE_LABEL[(a.audience as HelpAudience) ?? "admin"] ?? a.audience}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-warmgray">/{a.slug} · {a.category_slug ?? "—"}</div>
                </div>
                <div className="hidden items-center gap-3 text-[12px] text-warmgray sm:flex">
                  <span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{a.view_count}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600"><ThumbsUp className="size-3.5" />{a.helpful_yes}</span>
                  <span className="inline-flex items-center gap-1 text-red-500"><ThumbsDown className="size-3.5" />{a.helpful_no}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(a)} className="rounded-lg p-2 text-warmgray hover:text-coral-dark"><Pencil className="size-4" /></button>
                  <button onClick={() => remove(a.slug, a.title)} className="rounded-lg p-2 text-warmgray hover:text-red-600"><Trash2 className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Catégories : liste courte, édition et création */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Catégories</span>
        <button onClick={() => setEditingCategory("new")}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ink hover:border-coral/40">
          <Plus className="size-3.5" /> Nouvelle catégorie
        </button>
      </div>
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-6 text-center text-sm text-warmgray">
          Aucune catégorie pour ce contexte.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li key={c.slug} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="truncate text-sm font-medium text-ink">{c.label}</span>
                  <span className="ml-2 text-[12px] text-warmgray">/{c.slug}</span>
                  {showAudience && (
                    <span className="ml-2 rounded bg-indigo-50 px-1.5 py-px text-[10px] font-bold text-indigo-700">
                      {AUDIENCE_LABEL[(c.audience as HelpAudience) ?? "admin"] ?? c.audience}
                    </span>
                  )}
                </div>
                <button onClick={() => setEditingCategory(c)} className="rounded-lg p-2 text-warmgray hover:text-coral-dark"><Pencil className="size-4" /></button>
                <button onClick={() => removeCategory(c.slug, c.label)} className="rounded-lg p-2 text-warmgray hover:text-red-600"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <ArticleModal
          article={editing === "new" ? null : editing}
          categories={categories}
          defaultAudience={defaultAudience}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}

      {editingCategory && (
        <CategoryModal
          category={editingCategory === "new" ? null : editingCategory}
          defaultAudience={defaultAudience}
          onClose={() => setEditingCategory(null)}
          onSaved={() => { setEditingCategory(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ArticleModal({
  article, categories, defaultAudience, onClose, onSaved,
}: {
  article: HelpArticleAdmin | null;
  categories: HelpCategoryAdmin[];
  defaultAudience: HelpAudience;
  onClose: () => void; onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<ArticleInput>({
    slug: article?.slug ?? "",
    category_slug: article?.category_slug ?? categories[0]?.slug ?? "",
    title: article?.title ?? "",
    excerpt: article?.excerpt ?? "",
    keywords: article?.keywords ?? [],
    body: article?.body ?? "",
    published: article?.published ?? true,
    audience: (article?.audience as HelpAudience) ?? defaultAudience,
  });
  const [kw, setKw] = useState((article?.keywords ?? []).join(", "));

  function submit() {
    const payload: ArticleInput = {
      ...f,
      slug: f.slug.trim() || slugify(f.title),
      keywords: kw.split(",").map((k) => k.trim()).filter(Boolean),
    };
    startTransition(async () => {
      const res = await saveHelpArticle(payload, article?.slug);
      if (res.ok) { toast.success("Enregistré ✓"); onSaved(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-ink">{article ? "Modifier l'article" : "Nouvel article"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-cream"><X className="size-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={labelCls}>Titre *</label><input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: f.slug || slugify(e.target.value) })} /></div>
          <div><label className={labelCls}>Slug (URL)</label><input className={input} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="auto depuis le titre" /></div>
          <div><label className={labelCls}>Catégorie</label>
            <select className={input} value={f.category_slug} onChange={(e) => setF({ ...f, category_slug: e.target.value })}>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Audience</label>
            <select className={input} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as HelpAudience })}>
              <option value="admin">Admin</option>
              <option value="public">Portail</option>
              <option value="sejour">Séjours</option>
            </select>
          </div>
          <div className="sm:col-span-2"><label className={labelCls}>Résumé</label><input className={input} value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Mots-clés (virgules)</label><input className={input} value={kw} onChange={(e) => setKw(e.target.value)} placeholder="adhésion, paiement…" /></div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Corps (markdown léger : ## titres, **gras**, - listes, [lien](url), &gt; citation)</label>
            <textarea className={`${input} min-h-[220px] resize-y font-mono text-[13px]`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} className="size-4 accent-coral" /> Publié
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-coral/40">Annuler</button>
          <button onClick={submit} disabled={pending || !f.title.trim()} className="rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">
            {pending ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryModal({
  category, defaultAudience, onClose, onSaved,
}: {
  category: HelpCategoryAdmin | null;
  defaultAudience: HelpAudience;
  onClose: () => void; onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<CategoryInput>({
    slug: category?.slug ?? "",
    label: category?.label ?? "",
    icon: category?.icon ?? "",
    description: category?.description ?? "",
    audience: (category?.audience as HelpAudience) ?? defaultAudience,
  });

  function submit() {
    const payload: CategoryInput = { ...f, slug: f.slug.trim() || slugify(f.label) };
    startTransition(async () => {
      const res = await saveHelpCategory(payload, category?.slug);
      if (res.ok) { toast.success("Enregistrée ✓"); onSaved(); }
      else toast.error(res.error ?? "Erreur");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-ink">{category ? "Modifier la catégorie" : "Nouvelle catégorie"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-warmgray hover:bg-cream"><X className="size-5" /></button>
        </div>

        <div className="flex flex-col gap-4">
          <div><label className={labelCls}>Libellé *</label><input className={input} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value, slug: f.slug || slugify(e.target.value) })} /></div>
          <div><label className={labelCls}>Slug (URL)</label><input className={input} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="auto depuis le libellé" /></div>
          <div><label className={labelCls}>Icône (nom lucide-react)</label><input className={input} value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} placeholder="book-open" /></div>
          <div><label className={labelCls}>Description</label><input className={input} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><label className={labelCls}>Audience</label>
            <select className={input} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as HelpAudience })}>
              <option value="admin">Admin</option>
              <option value="public">Portail</option>
              <option value="sejour">Séjours</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-coral/40">Annuler</button>
          <button onClick={submit} disabled={pending || !f.label.trim()} className="rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50">
            {pending ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
