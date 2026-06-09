"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Users } from "lucide-react";
import { ResidencesView } from "@/components/mc/residences-view";
import { ArtistsView } from "@/components/mc/artists-view";
import type { Residence, Space, Person, Artist } from "@/lib/types";

type Tab = "sejours" | "artistes";

export function ResidencesTabs({
  residences,
  spaces,
  persons,
  artists,
  orgSlug,
  orgId,
  initialTab,
}: {
  residences: Residence[];
  spaces: Space[];
  persons: Person[];
  artists: Artist[];
  orgSlug: string;
  orgId: string;
  initialTab: Tab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(initialTab);

  function switchTab(t: Tab) {
    setTab(t);
    router.replace(`${pathname}?vue=${t}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Segmented control */}
      <div className="mc-view-toggle">
        <button
          type="button"
          className={`mc-view-btn ${tab === "sejours" ? "active" : ""}`}
          onClick={() => switchTab("sejours")}
        >
          <Home className="size-3.5" /> Séjours
        </button>
        <button
          type="button"
          className={`mc-view-btn ${tab === "artistes" ? "active" : ""}`}
          onClick={() => switchTab("artistes")}
        >
          <Users className="size-3.5" /> Artistes
        </button>
      </div>

      {tab === "sejours" ? (
        <ResidencesView
          residences={residences}
          spaces={spaces}
          persons={persons}
          orgSlug={orgSlug}
          orgId={orgId}
        />
      ) : (
        <ArtistsView artists={artists} orgSlug={orgSlug} orgId={orgId} />
      )}
    </div>
  );
}
