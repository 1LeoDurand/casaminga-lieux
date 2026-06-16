"use client";

import { MapPin } from "lucide-react";
import type { Establishment } from "@/lib/types";

export type LieuOpt = Pick<Establishment, "id" | "name">;

/** Petit badge présentational indiquant le lieu (établissement) d'un élément. */
export function LieuBadge({
  establishmentId,
  establishments,
  className = "",
}: {
  establishmentId: string | null | undefined;
  establishments: LieuOpt[];
  className?: string;
}) {
  if (!establishmentId) return null;
  const es = establishments.find((e) => e.id === establishmentId);
  if (!es) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-peach-pale px-2 py-0.5 text-[11px] font-semibold text-coral-dark ${className}`}
      title={`Lieu : ${es.name}`}
    >
      <MapPin className="size-3" /> {es.name}
    </span>
  );
}
