"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  X,
  Search,
  RotateCcw,
  UserPlus,
  Users,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Download,
  ShieldOff,
  ShieldCheck,
  Link2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/mc/avatar";
import { ConfirmDialog } from "@/components/mc/confirm-dialog";
import { PersonForm, type PersonFormValues } from "@/components/mc/person-form";
import {
  PERSON_ROLES,
  PERSON_STATUSES,
  roleBadge,
  roleLabel,
  statusLabel,
} from "@/lib/persons-meta";
import {
  createPersonAction,
  deletePersonAction,
  updatePersonAction,
  anonymizePersonAction,
  sendPortalLinkAction,
  getPortalLinkAction,
} from "@/app/(admin)/dashboard/[org]/personnes/actions";
import { PersonAccessPanel } from "@/components/mc/person-access-panel";
import type { Person, TeamMember, Establishment } from "@/lib/types";
import type { Invitation } from "@/app/(admin)/dashboard/[org]/equipe/actions";
import { LieuBadge } from "@/components/mc/lieu-badge";

type View = "cards" | "table";

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function RoleBadge({ role }: { role: string }) {
  return <span className={`mc-badge ${roleBadge(role)}`}>{roleLabel(role)}</span>;
}

// ── Espace adhérent : boutons envoi lien + copie ─────────────────────────────

function PortalLinkButtons({ email, name, orgSlug, establishmentName }: { email: string; name: string; orgSlug: string; establishmentName?: string | null }) {
  const [sending, setSending] = useState(false);
  const [copying, setCopying] = useState(false);

  async function handleSend() {
    setSending(true);
    const res = await sendPortalLinkAction(orgSlug, email, name, establishmentName);
    setSending(false);
    if (res.ok) {
      toast.success("Lien espace envoyé ✓");
    } else {
      toast.error(res.error ?? "Erreur d'envoi");
    }
  }

  async function handleCopy() {
    setCopying(true);
    const res = await getPortalLinkAction(email);
    setCopying(false);
    if (res.ok && res.url) {
      await navigator.clipboard.writeText(res.url);
      toast.success("Lien copié ✓");
    } else {
      toast.error(res.error ?? "Erreur");
    }
  }

  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-warmgray">
        Espace adhérent
      </h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="flex items-center gap-1.5 rounded-lg border border-coral/30 bg-peach-pale px-3 py-1.5 text-[12px] font-medium text-coral-dark hover:bg-coral/10 disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {sending ? "Envoi…" : "Envoyer le lien"}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={copying}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Link2 className="size-3.5" />
          {copying ? "…" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}

export function PersonsView({
  persons,
  orgSlug,
  orgId,
  teamMembers = [],
  establishments = [],
  selectedLieuId = null,
  canManageAccess = false,
  invitations = [],
}: {
  persons: Person[];
  orgSlug: string;
  orgId: string;
  teamMembers?: TeamMember[];
  establishments?: Establishment[];
  selectedLieuId?: string | null;
  canManageAccess?: boolean;
  invitations?: Invitation[];
}) {
  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [roleF, setRoleF] = useState<Set<string>>(new Set());
  const [statusF, setStatusF] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Person | null>(null);
  const [confirmAnonymize, setConfirmAnonymize] = useState<Person | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = persons.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedId(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedId]);

  const kpis = useMemo(() => {
    const active = persons.filter((p) => p.status === "actif");
    const byRole = (r: string) => active.filter((p) => p.role === r).length;
    return {
      active: active.length,
      coworkers: byRole("coworker"),
      benevoles: byRole("benevole"),
      intervenants: byRole("intervenant"),
      prospects: byRole("prospect"),
    };
  }, [persons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return persons.filter((p) => {
      if (selectedLieuId && p.establishment_id !== selectedLieuId) return false;
      if (roleF.size && !roleF.has(p.role)) return false;
      if (statusF.size && !statusF.has(p.status)) return false;
      if (q) {
        const hay = [p.name, p.email, p.phone, p.notes, ...(p.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [persons, search, roleF, statusF, selectedLieuId]);

  const hasFilters = search.trim() !== "" || roleF.size > 0 || statusF.size > 0;

  function resetFilters() {
    setSearch("");
    setRoleF(new Set());
    setStatusF(new Set());
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(p: Person) {
    setEditing(p);
    setFormOpen(true);
  }

  function submitForm(values: PersonFormValues) {
    startTransition(async () => {
      const payload = {
        name: values.name,
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        role: values.role,
        status: values.status,
        establishment_id: values.establishment_id || null,
        tags: values.tags,
        notes: values.notes.trim() || null,
      };
      const res = editing
        ? await updatePersonAction(orgSlug, editing.id, payload)
        : await createPersonAction(orgSlug, { ...payload, organization_id: orgId }, values.sendWelcome);
      if (res.ok) {
        toast.success(
          editing
            ? "Personne mise à jour"
            : values.sendWelcome && payload.email
              ? "Personne ajoutée · email de bienvenue envoyé"
              : "Personne ajoutée"
        );
        setFormOpen(false);
        setEditing(null);
      } else {
        toast.error("Action impossible. Réessayez.");
      }
    });
  }

  function doDelete(p: Person) {
    startTransition(async () => {
      const { ok } = await deletePersonAction(orgSlug, p.id);
      if (ok) {
        toast.success("Personne supprimée");
        setConfirmDelete(null);
        setSelectedId(null);
      } else {
        toast.error("Suppression impossible. Réessayez.");
      }
    });
  }

  function doAnonymize(p: Person) {
    startTransition(async () => {
      const { ok } = await anonymizePersonAction(orgSlug, p.id, "admin");
      if (ok) {
        toast.success("Profil anonymisé — données personnelles effacées");
        setConfirmAnonymize(null);
        setSelectedId(null);
      } else {
        toast.error("Anonymisation impossible. Réessayez.");
      }
    });
  }

  // État vide global
  if (persons.length === 0) {
    return (
      <>
        <div className="mc-card">
          <div className="mc-empty">
            <span className="mc-empty-ic">
              <Users className="size-6" strokeWidth={1.8} />
            </span>
            <div className="mc-empty-title">Aucune personne pour le moment</div>
            <p className="mc-empty-sub">
              Commencez à constituer le CRM du lieu : membres, coworkers, bénévoles,
              intervenant·es, résident·es, partenaires…
            </p>
            <button type="button" className="mc-btn mc-btn-lime mc-btn-sm mt-1" onClick={openCreate}>
              <UserPlus className="size-3.5" /> Ajouter une personne
            </button>
          </div>
        </div>
        <PersonForm
          key={formOpen ? "create-open" : "create-closed"}
          open={formOpen}
          person={null}
          establishments={establishments}
          defaultEstablishmentId={selectedLieuId}
          busy={pending}
          onClose={() => setFormOpen(false)}
          onSubmit={submitForm}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="mc-kpi-grid">
        <div className="mc-stat">
          <div className="mc-stat-val">{kpis.active}</div>
          <div className="mc-stat-lbl">Personnes actives</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#0369a1" }}>{kpis.coworkers}</div>
          <div className="mc-stat-lbl">Coworkers</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#0d9488" }}>{kpis.benevoles}</div>
          <div className="mc-stat-lbl">Bénévoles</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#be185d" }}>{kpis.intervenants}</div>
          <div className="mc-stat-lbl">Intervenant·es</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#6366f1" }}>{kpis.prospects}</div>
          <div className="mc-stat-lbl">Prospects</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mc-card p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mc-search">
            <span className="mc-search-ic">
              <Search className="size-4" />
            </span>
            <input
              className="mc-input"
              placeholder="Rechercher par nom, email, tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mc-view-toggle">
            <button
              type="button"
              className={`mc-view-btn ${view === "cards" ? "active" : ""}`}
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="size-3.5" /> Cartes
            </button>
            <button
              type="button"
              className={`mc-view-btn ${view === "table" ? "active" : ""}`}
              onClick={() => setView("table")}
            >
              <List className="size-3.5" /> Tableau
            </button>
          </div>
          <button type="button" className="mc-btn mc-btn-lime mc-btn-sm" onClick={openCreate}>
            <UserPlus className="size-3.5" /> Ajouter
          </button>
          <button
            type="button"
            className="mc-btn mc-btn-outline mc-btn-sm"
            onClick={resetFilters}
            disabled={!hasFilters}
          >
            <RotateCcw className="size-3.5" /> Réinitialiser
          </button>
        </div>

        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Rôle</span>
          <div className="mc-chips">
            {PERSON_ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                className={`mc-chip ${roleF.has(r.value) ? "active" : ""}`}
                onClick={() => setRoleF((s) => toggle(s, r.value))}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mc-filter-row">
          <span className="mc-filter-lbl">Statut</span>
          <div className="mc-chips">
            {PERSON_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`mc-chip ${statusF.has(s.value) ? "active" : ""}`}
                onClick={() => setStatusF((set) => toggle(set, s.value))}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div className="mc-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <span className="text-[13px] font-semibold text-foreground">
            {filtered.length} personne{filtered.length > 1 ? "s" : ""}
            {hasFilters ? ` / ${persons.length}` : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="mc-empty">
            <span className="mc-empty-ic">
              <Search className="size-6" strokeWidth={1.8} />
            </span>
            <div className="mc-empty-title">Aucun résultat</div>
            <p className="mc-empty-sub">Aucune personne ne correspond à ces filtres.</p>
            <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" onClick={resetFilters}>
              <RotateCcw className="size-3.5" /> Réinitialiser les filtres
            </button>
          </div>
        ) : view === "cards" ? (
          <div className="mc-cards-grid">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mc-person-card"
                onClick={() => setSelectedId(p.id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">{p.name}</div>
                    <div className="truncate text-[12px] text-warmgray">{p.email ?? "—"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={p.role} />
                  {p.status === "inactif" ? (
                    <span className="mc-badge mc-badge-gray">Inactif</span>
                  ) : null}
                  <LieuBadge establishmentId={p.establishment_id} establishments={establishments} />
                </div>
                {p.tags.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 4).map((t) => (
                      <span key={t} className="mc-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Personne</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Email</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => setSelectedId(p.id)}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={p.name} size={32} />
                        <span className="font-semibold text-foreground">{p.name}</span>
                      </div>
                    </td>
                    <td>
                      <RoleBadge role={p.role} />
                    </td>
                    <td className="text-[12px] text-warmgray">{statusLabel(p.status)}</td>
                    <td className="text-[12px] text-warmgray">{p.email ?? "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {p.tags.slice(0, 3).map((t) => (
                          <span key={t} className="mc-tag">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer détail */}
      {selected ? (
        <>
          <button
            type="button"
            aria-label="Fermer"
            className="mc-drawer-ov"
            onClick={() => setSelectedId(null)}
          />
          <aside className="mc-drawer" aria-label="Fiche personne">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div className="flex items-center gap-3">
                <Avatar name={selected.name} size={52} />
                <div>
                  <h2 className="font-heading text-xl font-bold text-foreground">{selected.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={selected.role} />
                    <span className="mc-badge mc-badge-gray">{statusLabel(selected.status)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-warmgray transition-colors hover:bg-peach-pale"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-5 p-6">
              <dl className="grid gap-2.5 rounded-xl bg-white p-4 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="size-4 shrink-0 text-warmgray" />
                  <dd className="truncate font-medium">{selected.email ?? "—"}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-warmgray" />
                  <dd className="font-medium">{selected.phone ?? "—"}</dd>
                </div>
              </dl>

              {selected.tags.length ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Tags</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.tags.map((t) => (
                      <span key={t} className="mc-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">Notes</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed text-foreground">
                  {selected.notes ?? "—"}
                </p>
              </div>

              {/* Section accès au logiciel */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-warmgray">Accès au logiciel</h3>
                <PersonAccessPanel
                  member={
                    selected.email
                      ? (teamMembers.find(
                          (m) => m.email?.toLowerCase() === selected.email?.toLowerCase()
                        ) ?? null)
                      : null
                  }
                  personName={selected.name}
                  personEmail={selected.email}
                  orgSlug={orgSlug}
                  orgId={orgId}
                  canManageAccess={canManageAccess}
                  pendingInvitation={
                    selected.email
                      ? (invitations.find(
                          (i) => i.email.toLowerCase() === selected.email!.toLowerCase()
                        ) ?? null)
                      : null
                  }
                />
              </div>

              {/* Section Espace adhérent (portail membre) */}
              {selected.email && !selected.anonymized_at && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-warmgray">
                    Espace adhérent (portail membre)
                  </h3>
                  <p className="mb-2.5 text-[11.5px] text-warmgray/70">
                    Lien personnel vers le portail public (adhésion, billets, reçus). Ce n&apos;est <strong>pas</strong> un accès à l&apos;outil de gestion.
                  </p>
                  <PortalLinkButtons
                    email={selected.email}
                    name={selected.name}
                    orgSlug={orgSlug}
                    establishmentName={
                      establishments.find((e) => e.id === selected.establishment_id)?.name ?? null
                    }
                  />
                </div>
              )}

              {/* Section RGPD */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {selected.anonymized_at ? (
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                  ) : (
                    <ShieldOff className="size-3.5" />
                  )}
                  RGPD
                </h3>
                {selected.anonymized_at ? (
                  <p className="text-[12px] text-emerald-700">
                    Profil anonymisé le {new Date(selected.anonymized_at).toLocaleDateString("fr-FR")}
                    {selected.anonymized_by ? ` par ${selected.anonymized_by}` : ""}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/dashboard/${orgSlug}/personnes/${selected.id}/export`}
                      download
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Download className="size-3.5" /> Exporter les données
                    </a>
                    <button
                      type="button"
                      onClick={() => setConfirmAnonymize(selected)}
                      className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[12px] font-medium text-orange-700 hover:bg-orange-100"
                    >
                      <ShieldOff className="size-3.5" /> Anonymiser (droit à l&apos;oubli)
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto flex gap-3 border-t border-border p-6">
              <button
                type="button"
                disabled={pending}
                onClick={() => openEdit(selected)}
                className="mc-btn mc-btn-lime flex-1"
              >
                <Pencil className="size-4" /> Modifier
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmDelete(selected)}
                className="mc-btn mc-btn-outline"
              >
                <Trash2 className="size-4" /> Supprimer
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {/* Formulaire création / édition */}
      <PersonForm
        key={formOpen ? `edit-${editing?.id ?? "new"}` : "edit-closed"}
        open={formOpen}
        person={editing}
        establishments={establishments}
        defaultEstablishmentId={selectedLieuId}
        busy={pending}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={submitForm}
      />

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Supprimer cette personne ?"
        message={
          confirmDelete
            ? `« ${confirmDelete.name} » sera définitivement retiré·e du CRM. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        tone="danger"
        busy={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />

      {/* Confirmation anonymisation RGPD */}
      <ConfirmDialog
        open={confirmAnonymize !== null}
        title="Anonymiser ce profil ?"
        message={
          confirmAnonymize
            ? `Le nom, l'email, le téléphone et les notes de « ${confirmAnonymize.name} » seront effacés et remplacés par « Anonyme RGPD ». Les données financières (factures, caisse) restent conservées pour les obligations légales. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Anonymiser définitivement"
        tone="danger"
        busy={pending}
        onCancel={() => setConfirmAnonymize(null)}
        onConfirm={() => confirmAnonymize && doAnonymize(confirmAnonymize)}
      />
    </div>
  );
}
