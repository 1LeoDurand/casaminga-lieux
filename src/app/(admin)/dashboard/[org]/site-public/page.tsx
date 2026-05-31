import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/mc/page-header";
import { getOrganizationBySlug, getEvenementsForOrg, getSpacesForOrg } from "@/lib/data";
import { spaceStatusBadge, typeLabel as spaceTypeLabel } from "@/lib/spaces-meta";
import { eventTypeBadge, eventTypeLabel, eventRange } from "@/lib/events-meta";

export default async function SitePublicPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const [spaces, evenements] = await Promise.all([
    getSpacesForOrg(organization.id),
    getEvenementsForOrg(organization.id),
  ]);

  const availableSpaces = spaces.filter((s) => s.status === "disponible");
  const publishedEvents = evenements.filter((e) => e.status === "publie");
  const publicUrl = `/site/${organization.slug}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tag="Publication" title="Site public"
        sub="Aperçu des données publiques du lieu : espaces disponibles et événements publiés."
        actions={
          <Link href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="mc-btn mc-btn-outline mc-btn-sm">
            Voir le site →
          </Link>
        } />

      {/* Statut */}
      <div className="mc-card p-6">
        <h3 className="mb-4 font-heading text-base font-bold text-foreground">Statut de publication</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#2f8a4c]" />
            <span>{availableSpaces.length} espace{availableSpaces.length > 1 ? "s" : ""} disponible{availableSpaces.length > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#6b3aa0]" />
            <span>{publishedEvents.length} événement{publishedEvents.length > 1 ? "s" : ""} publié{publishedEvents.length > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-peach bg-peach-pale p-4 text-sm text-warmgray">
          L&apos;éditeur de site complet (blocs de contenu, SEO, mise en page) est prévu dans une prochaine évolution. Pour l&apos;instant, le site public affiche le formulaire de contact et les données publiées.
        </div>
      </div>

      {/* Espaces disponibles */}
      <div className="mc-card p-6">
        <h3 className="mb-4 font-heading text-base font-bold text-foreground">Espaces publiés ({availableSpaces.length})</h3>
        {availableSpaces.length === 0 ? (
          <p className="text-sm text-warmgray">Aucun espace disponible. Ajoutez des espaces dans le module <Link href={`/dashboard/${org}/espaces`} className="text-coral-dark hover:underline">Espaces</Link>.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {availableSpaces.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl bg-gray-light px-4 py-3 text-sm">
                <span className={`mc-badge ${spaceStatusBadge(s.status)}`}>{spaceTypeLabel(s.type)}</span>
                <span className="font-medium">{s.name}</span>
                {s.capacity ? <span className="text-warmgray">· {s.capacity} pers.</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Événements publiés */}
      <div className="mc-card p-6">
        <h3 className="mb-4 font-heading text-base font-bold text-foreground">Événements publiés ({publishedEvents.length})</h3>
        {publishedEvents.length === 0 ? (
          <p className="text-sm text-warmgray">Aucun événement publié. Gérez votre programmation dans le module <Link href={`/dashboard/${org}/evenements`} className="text-coral-dark hover:underline">Événements</Link>.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {publishedEvents.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl bg-gray-light px-4 py-3 text-sm">
                <span className={`mc-badge ${eventTypeBadge(e.type)}`}>{eventTypeLabel(e.type)}</span>
                <span className="font-medium">{e.title}</span>
                <span className="ml-auto shrink-0 text-[11px] text-warmgray">{eventRange(e.start_at, e.end_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
