"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutGrid, CalendarDays } from "lucide-react";
import { SpacesView } from "@/components/mc/spaces-view";
import { ReservationsView } from "@/components/mc/reservations-view";
import type { Space, Establishment, Reservation, Person } from "@/lib/types";

type Tab = "catalogue" | "planning";

export function EspacesTabs({
  spaces,
  establishments,
  reservations,
  persons,
  orgSlug,
  orgId,
  stripeReady,
  initialTab,
}: {
  spaces: Space[];
  establishments: Establishment[];
  reservations: Reservation[];
  persons: Person[];
  orgSlug: string;
  orgId: string;
  stripeReady: boolean;
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
          className={`mc-view-btn ${tab === "catalogue" ? "active" : ""}`}
          onClick={() => switchTab("catalogue")}
        >
          <LayoutGrid className="size-3.5" /> Catalogue
        </button>
        <button
          type="button"
          className={`mc-view-btn ${tab === "planning" ? "active" : ""}`}
          onClick={() => switchTab("planning")}
        >
          <CalendarDays className="size-3.5" /> Planning
        </button>
      </div>

      {tab === "catalogue" ? (
        <SpacesView
          spaces={spaces}
          establishments={establishments}
          orgSlug={orgSlug}
          orgId={orgId}
        />
      ) : (
        <ReservationsView
          reservations={reservations}
          spaces={spaces}
          persons={persons}
          orgSlug={orgSlug}
          orgId={orgId}
          stripeReady={stripeReady}
        />
      )}
    </div>
  );
}
