import { getPendingClaims } from "@/lib/admin/data";
import { ClaimsView } from "@/components/admin/claims-view";

export const dynamic = "force-dynamic";

export default async function AdminRevendicationsPage() {
  const claims = await getPendingClaims();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-7">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Revendications</h1>
        <p className="mt-1 text-sm text-warmgray">
          Les lieux dont l&apos;agenda a été moissonné peuvent demander à reprendre leur page. Quand
          le lieu a publié une adresse de contact, le lien de reprise y part tout seul et rien
          n&apos;arrive ici. Sinon, la demande vous attend : accepter, c&apos;est envoyer
          l&apos;invitation à l&apos;adresse saisie par le demandeur, et donc se porter garant.
        </p>
      </header>

      <ClaimsView claims={claims} />
    </div>
  );
}
