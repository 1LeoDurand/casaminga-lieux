/**
 * Tableau de bord espace adhérent.
 * Composant présentationnel : reçoit les données déjà agrégées.
 * Style inline pour rester autonome (même pattern que /billet/[token]).
 */

import Link from "next/link";
import type {
  PortalData,
  PortalOrgData,
  PortalRecu,
  PortalFacture,
  AdhesionStatus,
  FactureStatus,
} from "@/lib/portal/data";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";

// ── Helpers visuels ───────────────────────────────────────────────────────────

const STATUS_META: Record<AdhesionStatus, { label: string; color: string; bg: string; border: string }> = {
  active:          { label: "Adhésion active",        color: "#166534", bg: "#F0FDF4", border: "#BBF7D0" },
  expire_bientot:  { label: "Expire bientôt",         color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  expiree:         { label: "Adhésion expirée",        color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
  en_attente:      { label: "En attente de validation", color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  aucune:          { label: "Pas d'adhésion",          color: "#6B6460", bg: "#F5F0EB", border: "#E5DDD6" },
};

const FACTURE_META: Record<FactureStatus, { label: string; color: string; bg: string; border: string }> = {
  payee:     { label: "Payée",            color: "#166534", bg: "#F0FDF4", border: "#BBF7D0" },
  a_regler:  { label: "À régler",         color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  en_retard: { label: "En retard",        color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
  declaree:  { label: "Paiement signalé", color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
};

function fmtEuros(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function AdhesionCard({ adhesion, renewUrl, attestationUrl }: {
  adhesion: PortalOrgData["adhesion"];
  renewUrl: string | null;
  attestationUrl: string | null;
}) {
  const meta = STATUS_META[adhesion?.derivedStatus ?? "aucune"];

  return (
    <div
      style={{
        background: "#FAFAF7",
        border: "1px solid #E5DDD6",
        borderRadius: 16,
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#6B6460", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Mon adhésion
        </h3>
        <span
          style={{
            display: "inline-block",
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
            borderRadius: 100,
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {meta.label}
        </span>
      </div>

      {adhesion ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {adhesion.tierName && (
              <tr>
                <td style={{ fontSize: 12, color: "#9C9590", paddingBottom: 6, width: 130 }}>Formule</td>
                <td style={{ fontSize: 14, color: "#2C2C2C", fontWeight: 600, paddingBottom: 6 }}>{adhesion.tierName}</td>
              </tr>
            )}
            {adhesion.membershipStart && (
              <tr>
                <td style={{ fontSize: 12, color: "#9C9590", paddingBottom: 6 }}>Depuis</td>
                <td style={{ fontSize: 14, color: "#2C2C2C", fontWeight: 600, paddingBottom: 6 }}>{fmtDateShort(adhesion.membershipStart)}</td>
              </tr>
            )}
            {adhesion.membershipEnd && (
              <tr>
                <td style={{ fontSize: 12, color: "#9C9590", paddingBottom: 6 }}>Jusqu'au</td>
                <td style={{ fontSize: 14, color: "#2C2C2C", fontWeight: 600, paddingBottom: 6 }}>{fmtDateShort(adhesion.membershipEnd)}</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: "#9C9590" }}>Aucune adhésion enregistrée.</p>
      )}

      {(renewUrl || attestationUrl) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {renewUrl && (
            <a
              href={renewUrl}
              style={{
                display: "inline-block",
                background: "#FF8A65",
                color: "#fff",
                textDecoration: "none",
                borderRadius: 100,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Renouveler mon adhésion →
            </a>
          )}
          {attestationUrl && (
            <a
              href={attestationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                background: "#fff",
                color: "#2C2C2C",
                textDecoration: "none",
                border: "1.5px solid #E5DDD6",
                borderRadius: 100,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              📄 Mon attestation
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function BilletsSection({ billets, attente }: { billets: PortalOrgData["billets"]; attente: PortalOrgData["attente"] }) {
  if (!billets.length && !attente.length) {
    return (
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#6B6460", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Mes billets à venir
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: "#9C9590" }}>Aucun billet à venir.</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#6B6460", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Mes billets à venir
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {billets.map((b) => (
          <a
            key={b.ticketToken}
            href={`/billet/${b.ticketToken}`}
            style={{
              display: "block",
              background: "#fff",
              border: "1px solid #E5DDD6",
              borderRadius: 12,
              padding: "14px 16px",
              textDecoration: "none",
              transition: "border-color 0.15s",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#2C2C2C", marginBottom: 4 }}>
              {b.eventTitle}
            </div>
            <div style={{ fontSize: 12, color: "#9C9590" }}>
              📅 {fmtDate(b.eventStartAt)}
            </div>
            <div style={{ fontSize: 11, color: "#FF8A65", marginTop: 6, fontWeight: 600 }}>
              Voir mon billet →
            </div>
          </a>
        ))}
        {attente.map((w, i) => (
          <div
            key={`w${i}`}
            style={{ background: "#fff", border: "1px solid #E5DDD6", borderRadius: 12, padding: "14px 16px" }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#2C2C2C", marginBottom: 4 }}>{w.eventTitle}</div>
            <div style={{ fontSize: 12, color: "#9C9590" }}>📅 {fmtDate(w.eventStartAt)}</div>
            <div style={{ fontSize: 11, color: "#9C9590", marginTop: 6, fontWeight: 600 }}>En liste d&apos;attente</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecusSection({ recus, token }: { recus: PortalRecu[]; token: string }) {
  if (!recus.length) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#6B6460", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Mes reçus fiscaux
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recus.map((r) => (
          <a
            key={r.id}
            href={`/espace/${token}/recu/${r.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#fff",
              border: "1px solid #E5DDD6",
              borderRadius: 12,
              padding: "12px 16px",
              textDecoration: "none",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#2C2C2C" }}>
                Reçu n° {r.number ?? r.id.slice(0, 8)} — {r.year}
              </div>
              <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>
                {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(r.amount)}
                {" · "}
                {fmtDateShort(r.donationDate)}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#FF8A65", fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
              PDF →
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function FacturesSection({ factures, token }: { factures: PortalFacture[]; token: string }) {
  if (!factures.length) return null;

  const due = factures.filter((f) => f.derivedStatus === "a_regler" || f.derivedStatus === "en_retard");
  const totalDue = due.reduce((s, f) => s + f.amountTtc, 0);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#6B6460", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Mes factures
        </h3>
        {due.length > 0 && (
          <span style={{ fontSize: 12, color: "#9C9590" }}>
            {due.length} en attente · <strong style={{ color: "#2C2C2C" }}>{fmtEuros(totalDue)}</strong>
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {factures.map((f) => {
          const meta = FACTURE_META[f.derivedStatus];
          const body = (
            <>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#2C2C2C" }}>
                  Facture {f.number ?? f.id.slice(0, 8)}
                  {f.object ? <span style={{ fontWeight: 400, color: "#6B6460" }}> — {f.object}</span> : null}
                </div>
                <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>
                  {fmtEuros(f.amountTtc)}
                  {f.dueDate ? ` · échéance ${fmtDateShort(f.dueDate)}` : ""}
                </div>
                {f.canDeclare && (
                  <div style={{ fontSize: 11, color: "#FF8A65", marginTop: 6, fontWeight: 600 }}>
                    J&apos;ai déjà réglé →
                  </div>
                )}
              </div>
              <span
                style={{
                  display: "inline-block",
                  background: meta.bg,
                  color: meta.color,
                  border: `1px solid ${meta.border}`,
                  borderRadius: 100,
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                {meta.label}
              </span>
            </>
          );

          const boxStyle = {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff",
            border: "1px solid #E5DDD6",
            borderRadius: 12,
            padding: "12px 16px",
            textDecoration: "none",
          } as const;

          // Seules les factures encore déclarables sont cliquables : ailleurs,
          // le lien mènerait à un écran qui ne propose rien.
          return f.canDeclare ? (
            <a key={f.id} href={`/espace/${token}/facture/${f.id}`} style={boxStyle}>
              {body}
            </a>
          ) : (
            <div key={f.id} style={boxStyle}>
              {body}
            </div>
          );
        })}
      </div>

      {factures.some((f) => f.derivedStatus === "declaree") && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#9C9590", lineHeight: 1.5 }}>
          Un paiement signalé est en cours de vérification par l&apos;équipe. Vous ne recevrez plus
          de rappel pour cette facture.
        </p>
      )}
    </div>
  );
}

function OrgSection({ org, token }: { org: PortalOrgData; token: string }) {
  const renewUrl = org.activeCampaignSlug
    ? `${PUBLIC_SITE_BASE}/${org.orgSlug}/adhesion/${org.activeCampaignSlug}`
    : null;

  const isEmpty =
    !org.adhesion && org.billets.length === 0 && org.attente.length === 0 && org.recus.length === 0 && org.factures.length === 0;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        border: "1px solid #E5DDD6",
        padding: "24px 28px",
        boxShadow: "0 2px 12px rgba(28,28,28,0.05)",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: "#FF8A6520",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 18 }}>🏛</span>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#2C2C2C" }}>{org.orgName}</div>
          {org.displayName !== org.orgName && (
            <div style={{ fontSize: 12, color: "#9C9590" }}>Inscrit(e) sous : {org.displayName}</div>
          )}
        </div>
      </div>

      {isEmpty ? (
        <p style={{ margin: 0, fontSize: 14, color: "#9C9590" }}>
          Aucune donnée active pour ce lieu.
        </p>
      ) : (
        <>
          {/* Un client qui n'a que des factures (coworker, prestataire) n'a pas
              besoin qu'on lui affiche « Pas d'adhésion » à chaque visite. */}
          {(org.adhesion || org.factures.length === 0) && (
            <AdhesionCard
              adhesion={org.adhesion}
              renewUrl={renewUrl}
              attestationUrl={
                org.adhesion && ["active", "expire_bientot"].includes(org.adhesion.derivedStatus)
                  ? `/espace/${token}/attestation/${org.orgSlug}`
                  : null
              }
            />
          )}
          <FacturesSection factures={org.factures} token={token} />
          <BilletsSection billets={org.billets} attente={org.attente} />
          <RecusSection recus={org.recus} token={token} />
        </>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function PortalDashboard({ data, token }: { data: PortalData; token: string }) {
  const hasMultiOrg = data.orgs.length > 1;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FFFBF0",
        fontFamily: "'Poppins', sans-serif",
        padding: "32px 16px 64px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 540, margin: "0 auto" }}>
        {/* Entête */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              background: "#FF8A65",
              borderRadius: 16,
              marginBottom: 16,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 4a6 6 0 100 12A6 6 0 0014 4zm0 14c-5.33 0-10 2.67-10 4v2h20v-2c0-1.33-4.67-4-10-4z"
                fill="#fff"
              />
            </svg>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: "#2C2C2C",
              letterSpacing: "-0.5px",
            }}
          >
            Mon espace adhérent
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#9C9590" }}>
            {data.email}
          </p>
          {hasMultiOrg && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9C9590" }}>
              {data.orgs.length} lieux associés à cet email
            </p>
          )}
        </div>

        {/* Sections par lieu */}
        {data.orgs.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              border: "1px solid #E5DDD6",
              padding: "32px 28px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <p style={{ margin: 0, fontWeight: 700, color: "#2C2C2C" }}>
              Aucun dossier trouvé
            </p>
            <p style={{ margin: "8px 0 24px", fontSize: 13, color: "#9C9590" }}>
              Aucune adhésion, facture ni billet n'est associé à cet email.
            </p>
            <a
              href="/espace"
              style={{
                display: "inline-block",
                background: "#FF8A65",
                color: "#fff",
                textDecoration: "none",
                borderRadius: 100,
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Réessayer avec un autre email
            </a>
          </div>
        ) : (
          data.orgs.map((org) => <OrgSection key={org.orgId} org={org} token={token} />)
        )}

        {/* Nouveau lien */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a
            href="/espace"
            style={{ fontSize: 12, color: "#9C9590", textDecoration: "underline" }}
          >
            Recevoir un nouveau lien d'accès
          </a>
        </div>
      </div>
    </main>
  );
}
