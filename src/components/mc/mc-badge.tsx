type Tone = "green" | "red" | "orange" | "gray" | "lime" | "golden";

/**
 * Badge fidèle au prototype Claude Design (variantes pastel).
 * Couche purement visuelle, réutilisable par tous les modules.
 */
export function McBadge({
  tone = "gray",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return <span className={`mc-badge mc-badge-${tone}`}>{children}</span>;
}
