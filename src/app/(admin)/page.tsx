import type { Metadata } from "next";
import HomeLanding from "@/components/mc/home-landing";
import { JsonLd } from "@/components/seo/json-ld";

const DESCRIPTION =
  "Gestion, adhésions, événements, subventions et site public : le logiciel tout-en-un des tiers-lieux et lieux collectifs, pensé pour les associations.";

export const metadata: Metadata = {
  title: "Casa Minga — le logiciel des tiers-lieux et lieux collectifs",
  description: DESCRIPTION,
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Casa Minga",
      url: "https://admin.casaminga.com",
      logo: "https://admin.casaminga.com/logo-icon.webp",
    },
    {
      "@type": "SoftwareApplication",
      name: "Casa Minga",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={JSON_LD} />
      <HomeLanding />
    </>
  );
}
