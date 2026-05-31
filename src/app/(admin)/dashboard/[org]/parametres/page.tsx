import { notFound } from "next/navigation";
import { PageHeader } from "@/components/mc/page-header";
import { getOrganizationBySlug } from "@/lib/data";

export default async function ParametresPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

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
      </div>
    </div>
  );
}
