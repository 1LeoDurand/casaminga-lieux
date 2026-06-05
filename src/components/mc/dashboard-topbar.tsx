"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Globe, Bell } from "lucide-react";
import { moduleLabelForSegment } from "@/lib/modules";

export function DashboardTopbar({
  orgSlug,
}: {
  orgSlug: string;
}) {
  const pathname = usePathname();
  // /dashboard/[org] ou /dashboard/[org]/[segment]
  const parts = pathname.split("/").filter(Boolean); // ["dashboard", org, segment?]
  const segment = parts.length > 2 ? parts[2] : null;
  const title = moduleLabelForSegment(segment);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-cream px-7 shadow-[0_2px_12px_rgba(255,138,101,0.08)]">
      <div className="flex-1 truncate font-heading text-[17px] font-bold text-[#2c2c2c]">
        {title}
      </div>

      <label className="hidden w-[220px] items-center gap-2 rounded-[13px] border-[1.5px] border-peach bg-cream px-3.5 py-[7px] transition-colors focus-within:border-coral md:flex">
        <Search className="size-3.5 text-warmgray" />
        <input
          type="text"
          placeholder="Rechercher…"
          className="w-full border-none bg-transparent text-[13px] outline-none placeholder:text-warmgray/70"
        />
      </label>

      <Link
        href={`/site/${orgSlug}`}
        target="_blank"
        title="Voir le site public généré"
        className="flex h-9 items-center gap-1.5 rounded-xl border-[1.5px] border-peach bg-peach-pale px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:border-coral hover:bg-peach"
      >
        <Globe className="size-4" />
        <span className="hidden lg:inline">Voir le site public</span>
      </Link>

      <button
        type="button"
        title="Notifications"
        className="relative flex size-9 items-center justify-center rounded-xl border-[1.5px] border-peach bg-peach-pale transition-colors hover:border-coral hover:bg-peach"
      >
        <Bell className="size-4" />
        <span className="absolute right-1.5 top-1.5 size-[7px] rounded-full border-2 border-cream bg-coral" />
      </button>
    </header>
  );
}
