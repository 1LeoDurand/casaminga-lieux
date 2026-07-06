/**
 * Injecte un bloc JSON-LD (schema.org) dans la page.
 * Composant serveur minimal — aucune dépendance client.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
