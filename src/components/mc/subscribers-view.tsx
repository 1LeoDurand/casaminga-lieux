"use client";

import { useMemo, useState } from "react";
import { X, Search, RotateCcw, Mail, MailX, Download } from "lucide-react";
import { Avatar } from "@/components/mc/avatar";
import { ConsentPanel } from "@/components/mc/persons-view";
import type { Person } from "@/lib/types";

interface GroupLite {
  id: string;
  name: string;
  memberIds: string[];
}

type EtatFiltre = "tous" | "abonnes" | "desabonnes" | "sans_email";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : dateFmt.format(d);
}

/** État d'abonnement d'une fiche, dérivé des mêmes champs que ConsentPanel. */
function etatOf(p: Person): Exclude<EtatFiltre, "tous"> {
  if (!p.email) return "sans_email";
  if (p.newsletter_opt_out) return "desabonnes";
  return "abonnes";
}

function EtatBadge({ etat }: { etat: Exclude<EtatFiltre, "tous"> }) {
  if (etat === "abonnes") {
    return <span className="mc-badge mc-badge-green">Abonné·e</span>;
  }
  if (etat === "desabonnes") {
    return <span className="mc-badge mc-badge-red">Désabonné·e</span>;
  }
  return <span className="mc-badge mc-badge-gray">Sans email</span>;
}

/**
 * Échappe une valeur pour une cellule CSV.
 *
 * Le guillemet doublé ne suffit pas : Excel interprète toute cellule commençant
 * par = + - @ comme une FORMULE. Or ces noms viennent du formulaire public
 * d'inscription — n'importe qui peut s'appeler `=HYPERLINK(...)` et déclencher
 * quelque chose sur le poste de celui qui ouvre l'export. On préfixe donc d'une
 * apostrophe, ce qui force Excel à traiter la cellule comme du texte.
 */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n;]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function SubscribersView({
  persons,
  groups,
}: {
  persons: Person[];
  groups: GroupLite[];
}) {
  const [search, setSearch] = useState("");
  const [etatF, setEtatF] = useState<EtatFiltre>("tous");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = persons.find((p) => p.id === selectedId) ?? null;

  // Groupes d'appartenance par personne, calculés une fois pour l'affichage du tableau et du tiroir.
  const groupsByPerson = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of groups) {
      for (const personId of g.memberIds) {
        const arr = map.get(personId) ?? [];
        arr.push(g.name);
        map.set(personId, arr);
      }
    }
    return map;
  }, [groups]);

  const counts = useMemo(() => {
    let joignables = 0;
    let desabonnes = 0;
    let sansEmail = 0;
    for (const p of persons) {
      const etat = etatOf(p);
      if (etat === "abonnes") joignables++;
      else if (etat === "desabonnes") desabonnes++;
      else sansEmail++;
    }
    return { joignables, desabonnes, sansEmail, total: persons.length };
  }, [persons]);

  const sorted = useMemo(
    () => [...persons].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [persons]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((p) => {
      if (etatF !== "tous" && etatOf(p) !== etatF) return false;
      if (q) {
        const hay = [p.name, p.email].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, search, etatF]);

  const hasFilters = search.trim() !== "" || etatF !== "tous";

  function resetFilters() {
    setSearch("");
    setEtatF("tous");
  }

  /**
   * Export CSV des SEULS abonnés joignables. On ne met jamais les désabonné·es
   * dans un fichier téléchargeable : une fois exportée, la donnée échappe à
   * toute action de retrait future.
   */
  function exportCsv() {
    const joignables = sorted.filter((p) => etatOf(p) === "abonnes");
    const header = ["Nom", "Email", "Date de consentement", "Origine"];
    const rows = joignables.map((p) => [
      p.name,
      p.email ?? "",
      fmtDate(p.newsletter_consent_at) ?? "",
      p.newsletter_consent_source ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abonnes-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // État vide global : pas de fiche du tout dans l'org.
  if (persons.length === 0) {
    return (
      <div className="mc-card">
        <div className="mc-empty">
          <span className="mc-empty-ic">
            <Mail className="size-6" strokeWidth={1.8} />
          </span>
          <div className="mc-empty-title">Personne n&apos;est encore abonné</div>
          <p className="mc-empty-sub">
            Les inscriptions arrivent par le formulaire de votre site public, ou en ajoutant des
            personnes avec un email dans le CRM.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="mc-kpi-grid">
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#2f8a4c" }}>{counts.joignables}</div>
          <div className="mc-stat-lbl">Abonnés joignables</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#c0392b" }}>{counts.desabonnes}</div>
          <div className="mc-stat-lbl">Désabonnés</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val" style={{ color: "#6b6460" }}>{counts.sansEmail}</div>
          <div className="mc-stat-lbl">Fiches sans email</div>
        </div>
        <div className="mc-stat">
          <div className="mc-stat-val">{counts.total}</div>
          <div className="mc-stat-lbl">Total fiches</div>
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
              placeholder="Rechercher par nom ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="mc-btn mc-btn-lime mc-btn-sm"
            onClick={exportCsv}
            disabled={counts.joignables === 0}
            title="Exporte uniquement les abonnés joignables"
          >
            <Download className="size-3.5" /> Exporter le CSV
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
          <span className="mc-filter-lbl">État</span>
          <div className="mc-chips">
            <button
              type="button"
              className={`mc-chip ${etatF === "tous" ? "active" : ""}`}
              onClick={() => setEtatF("tous")}
            >
              Tous
            </button>
            <button
              type="button"
              className={`mc-chip ${etatF === "abonnes" ? "active" : ""}`}
              onClick={() => setEtatF("abonnes")}
            >
              Abonné·es
            </button>
            <button
              type="button"
              className={`mc-chip ${etatF === "desabonnes" ? "active" : ""}`}
              onClick={() => setEtatF("desabonnes")}
            >
              Désabonné·es
            </button>
            <button
              type="button"
              className={`mc-chip ${etatF === "sans_email" ? "active" : ""}`}
              onClick={() => setEtatF("sans_email")}
            >
              Sans email
            </button>
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div className="mc-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <span className="text-[13px] font-semibold text-foreground">
            {filtered.length} fiche{filtered.length > 1 ? "s" : ""}
            {hasFilters ? ` / ${persons.length}` : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="mc-empty">
            <span className="mc-empty-ic">
              <Search className="size-6" strokeWidth={1.8} />
            </span>
            <div className="mc-empty-title">Aucun résultat</div>
            <p className="mc-empty-sub">Aucune fiche ne correspond à ces filtres.</p>
            <button type="button" className="mc-btn mc-btn-outline mc-btn-sm mt-1" onClick={resetFilters}>
              <RotateCcw className="size-3.5" /> Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Personne</th>
                  <th>Email</th>
                  <th>État</th>
                  <th>Groupes</th>
                  <th>Consentement</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const etat = etatOf(p);
                  const consentDate = fmtDate(p.newsletter_consent_at);
                  const personGroups = groupsByPerson.get(p.id) ?? [];
                  return (
                    <tr key={p.id} onClick={() => setSelectedId(p.id)}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p.name} size={32} />
                          <span className="font-semibold text-foreground">{p.name}</span>
                        </div>
                      </td>
                      <td className="text-[12px] text-warmgray">{p.email ?? "—"}</td>
                      <td>
                        <EtatBadge etat={etat} />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {personGroups.length ? (
                            personGroups.slice(0, 3).map((g) => (
                              <span key={g} className="mc-tag">
                                {g}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px] text-warmgray">—</span>
                          )}
                        </div>
                      </td>
                      <td className="text-[12px] text-warmgray">
                        {etat === "abonnes"
                          ? (consentDate ?? "Preuve absente")
                          : etat === "desabonnes"
                            ? (fmtDate(p.newsletter_optout_at) ?? "Date de retrait inconnue")
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
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
          <aside className="mc-drawer" aria-label="Détail abonné">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div className="flex items-center gap-3">
                <Avatar name={selected.name} size={52} />
                <div>
                  <h2 className="font-heading text-xl font-bold text-foreground">{selected.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <EtatBadge etat={etatOf(selected)} />
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
                  {selected.email ? (
                    <Mail className="size-4 shrink-0 text-warmgray" />
                  ) : (
                    <MailX className="size-4 shrink-0 text-warmgray" />
                  )}
                  <dd className="truncate font-medium">{selected.email ?? "Aucun email enregistré"}</dd>
                </div>
              </dl>

              {(groupsByPerson.get(selected.id) ?? []).length ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-warmgray">
                    Groupes d&apos;appartenance
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(groupsByPerson.get(selected.id) ?? []).map((g) => (
                      <span key={g} className="mc-tag">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Preuve de consentement — même logique que la fiche Personnes */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-warmgray">
                  Newsletter
                </h3>
                <ConsentPanel person={selected} />
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
