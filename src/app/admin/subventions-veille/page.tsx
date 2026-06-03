import { getAllOpportunities } from "@/lib/admin/data";
import { OpportunityEditor } from "@/components/admin/opportunity-editor";

export const dynamic = "force-dynamic";

export default async function AdminVeillePage() {
  const opportunities = await getAllOpportunities();
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Veille subventions</h1>
        <p className="mt-1 text-sm text-warmgray">
          Catalogue d'opportunités de financement, commun à tous les lieux. Chaque lieu voit
          en priorité celles compatibles avec son profil.
        </p>
      </header>
      <OpportunityEditor opportunities={opportunities} />
    </div>
  );
}
