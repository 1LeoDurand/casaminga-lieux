import { avatarColor, initials } from "@/lib/persons-meta";

/** Avatar à initiales, couleur déterministe (primitive v1.5). */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="mc-avatar"
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        fontSize: Math.round(size * 0.38),
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
