import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { HelloAssoSettings } from "@/components/mc/helloasso-settings";
import { RibSettingsCard } from "@/components/mc/rib-settings-card";
import { PolesManager } from "@/components/mc/poles-manager";
import { PoleBudgetsPanel } from "@/components/mc/pole-budgets-panel";
import { PoleMembersPanel } from "@/components/mc/pole-members-panel";
import { EstablishmentsManager } from "@/components/mc/establishments-manager";
import { getOrganizationBySlug, getTeamMembers } from "@/lib/data";
import { getInvoiceSettings } from "@/lib/invoicing/data";
import { getAllPolesForOrg } from "@/lib/poles";
import { getPoleBudgets, getPoleFinancials } from "@/lib/pole-budgets";
import { getPoleMembers } from "@/lib/pole-members";
import { currentFiscalYear } from "@/lib/pole-meta";
import { getEstablishments } from "@/lib/establishments";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";
import { createClient } from "@/lib/supabase/server";

export default async function ParametresPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const year = currentFiscalYear();
  const [invoiceSettings, poles, teamMembers, budgetsMap, financialsMap, poleAssignments, establishments] = await Promise.all([
    getInvoiceSettings(organization.id),
    getAllPolesForOrg(organization.id),
    getTeamMembers(organization.id),
    getPoleBudgets(organization.id, year),
    getPoleFinancials(organization.id, year),
    getPoleMembers(organization.id),
    getEstablishments(organization.id),
  ]);
  const activePoles = poles.filter((p) => p.active);
  const budgets = Object.fromEntries(budgetsMap);
  const financials = Object.fromEntries(financialsMap);

  // Récupérer les infos HelloAsso (champs sensibles)
  let haOrgSlug: string | null = null;
  let haConnected = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("helloasso_org_slug, helloasso_connected_at")
      .eq("id", organization.id)
      .single();
    haOrgSlug = data?.helloasso_org_slug ?? null;
    haConnected = !!data?.helloasso_connected_at;
  } catch { /* demo mode */ }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Système" title="Paramètres"
        sub="Configuration du lieu, de l'organisation, des accès et des intégrations." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Identité */}
        <div className="mc-card p-6">
          <h3 className="mb-4 font-heading text-base font-bold text-foreground">Identité du lieu</h3>
          <dl className="flex flex-col gap-3 text-sm">
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Nom</dt><dd className="mt-0.5 font-medium">{organization.name}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Slug</dt><dd className="mt-0.5 font-mono text-[13px]">/{organization.slug}</dd></div>
            {organization.structure ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Structure juridique</dt><dd className="mt-0.5">{organization.structure}</dd></div> : null}
            {organization.address ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Adresse</dt><dd className="mt-0.5">{organization.address}</dd></div> : null}
            {organization.email ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Email</dt><dd className="mt-0.5"><a href={`mailto:${organization.email}`} className="text-coral-dark hover:underline">{organization.email}</a></dd></div> : null}
            {organization.phone ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Téléphone</dt><dd className="mt-0.5">{organization.phone}</dd></div> : null}
            {organization.website ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Site web</dt><dd className="mt-0.5"><a href={organization.website} target="_blank" rel="noopener noreferrer" className="text-coral-dark hover:underline">{organization.website}</a></dd></div> : null}
            {organization.hours ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Horaires</dt><dd className="mt-0.5">{organization.hours}</dd></div> : null}
          </dl>
        </div>

        {/* Plan + Couleur */}
        <div className="mc-card p-6">
          <h3 className="mb-4 font-heading text-base font-bold text-foreground">Configuration</h3>
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Plan</dt>
              <dd className="mt-0.5"><span className="mc-badge mc-badge-lime capitalize">{organization.plan}</span></dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Couleur principale</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="inline-block size-5 rounded-full border border-border" style={{ background: organization.primary_color }} />
                <span className="font-mono text-[13px]">{organization.primary_color}</span>
              </dd>
            </div>
          </dl>
          <div className="mt-6 rounded-xl border border-dashed border-peach bg-peach-pale p-4 text-sm text-warmgray">
            La modification des paramètres sera disponible dans une prochaine version. Pour toute modification urgente, contactez l&apos;équipe Casa Minga.
          </div>
        </div>

        {/* Description */}
        {organization.description ? (
          <div className="mc-card p-6 md:col-span-2">
            <h3 className="mb-3 font-heading text-base font-bold text-foreground">Description</h3>
            <p className="text-sm leading-relaxed text-warmgray">{organization.description}</p>
          </div>
        ) : null}

        {/* Établissements / Lieux */}
        <div className="mc-card p-6 md:col-span-2">
          <h3 className="mb-1 font-heading text-base font-bold text-foreground">Établissements / Lieux</h3>
          <p className="mb-4 text-[13px] text-warmgray">
            Si votre structure gère plusieurs lieux (établissements secondaires), créez-les ici.
            Chaque établissement a sa vitrine publique, ses événements et ses adhérents ; la facturation,
            les dépenses et la gouvernance restent communes à la structure mère.
          </p>
          <EstablishmentsManager
            establishments={establishments}
            orgId={organization.id}
            orgSlug={organization.slug}
            publicBaseUrl={PUBLIC_SITE_BASE.replace(/^https?:\/\//, "")}
          />
        </div>

        {/* Pôles / activités */}
        <div className="mc-card p-6 md:col-span-2">
          <h3 className="mb-1 font-heading text-base font-bold text-foreground">Pôles / Activités</h3>
          <p className="mb-4 text-[13px] text-warmgray">
            Classifiez vos factures et dépenses par pôle d&apos;activité (Culture, Coworking, Résidences…).
            {establishments.length > 0 ? " Chaque pôle peut être commun à la structure ou rattaché à un lieu précis (ex. les pôles du tiers-lieu d'une ville)." : ""}
          </p>
          <PolesManager poles={poles} orgId={organization.id} orgSlug={organization.slug} establishments={establishments} />
        </div>

        {/* Budgets par pôle */}
        {activePoles.length > 0 && (
          <div className="mc-card p-6 md:col-span-2">
            <h3 className="mb-1 font-heading text-base font-bold text-foreground">Budgets par pôle</h3>
            <p className="mb-4 text-[13px] text-warmgray">
              Allouez un budget annuel à chaque pôle et suivez l&apos;alloué vs. le réalisé (dépenses payées / factures encaissées).
            </p>
            <PoleBudgetsPanel
              poles={activePoles} year={year}
              orgId={organization.id} orgSlug={organization.slug}
              budgets={budgets} financials={financials}
            />
          </div>
        )}

        {/* Membres par pôle */}
        {activePoles.length > 0 && (
          <div className="mc-card p-6 md:col-span-2">
            <h3 className="mb-1 font-heading text-base font-bold text-foreground">Équipes par pôle</h3>
            <p className="mb-4 text-[13px] text-warmgray">
              Affectez les membres à leurs pôles (responsable, référent CA, responsable facturation…).
            </p>
            <PoleMembersPanel
              poles={activePoles} members={teamMembers} assignments={poleAssignments}
              orgId={organization.id} orgSlug={organization.slug}
            />
          </div>
        )}

        {/* RIB / Coordonnées bancaires */}
        <div className="md:col-span-2">
          <RibSettingsCard
            settings={invoiceSettings}
            orgId={organization.id}
            orgSlug={organization.slug}
          />
        </div>

        {/* Intégrations */}
        <div className="md:col-span-2">
          <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-warmgray">Intégrations</h2>
          <HelloAssoSettings
            orgSlug={organization.slug}
            connected={haConnected}
            haOrgSlug={haOrgSlug}
          />
        </div>
      </div>
    </div>
  );
}
