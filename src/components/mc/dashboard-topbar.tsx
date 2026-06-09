"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Globe, Bell, FileText, Users, Calendar, FolderOpen, CalendarCheck } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { moduleLabelForSegment } from "@/lib/modules";
import { LieuSwitcher, type LieuOption } from "@/components/mc/lieu-switcher";
import type { SearchHit } from "@/app/api/search/route";

export function DashboardTopbar({
  orgSlug,
  establishments = [],
  selectedLieuId = null,
  unreadNotifCount = 0,
}: {
  orgSlug: string;
  establishments?: LieuOption[];
  selectedLieuId?: string | null;
  unreadNotifCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const parts = pathname.split("/").filter(Boolean);
  const segment = parts.length > 2 ? parts[2] : null;
  const title = moduleLabelForSegment(segment);
  const selectedLieu = establishments.find((e) => e.id === selectedLieuId) ?? null;
  const publicHref = selectedLieu ? `/site/${selectedLieu.slug}` : `/site/${orgSlug}`;

  // ── Recherche globale ────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setHits([]); setOpen(false); return; }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&org=${orgSlug}`);
      const { hits: h } = await res.json();
      setHits(h ?? []);
      setOpen((h ?? []).length > 0);
    } catch { setHits([]); }
  }, [orgSlug]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(q), 250);
  }

  // Fermer au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const HIT_ICON: Record<SearchHit["type"], React.ReactNode> = {
    personne:    <Users className="size-3.5 text-coral" />,
    event:       <Calendar className="size-3.5 text-sky-500" />,
    facture:     <FileText className="size-3.5 text-amber-500" />,
    document:    <FolderOpen className="size-3.5 text-violet-500" />,
    reservation: <CalendarCheck className="size-3.5 text-emerald-500" />,
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-cream px-7 shadow-[0_2px_12px_rgba(255,138,101,0.08)]">
      <div className="truncate font-heading text-[17px] font-bold text-[#2c2c2c]">
        {title}
      </div>

      <LieuSwitcher orgSlug={orgSlug} establishments={establishments} selectedId={selectedLieuId} />

      <div className="flex-1" />

      <div ref={searchRef} className="relative hidden md:block">
        <label className="flex w-[220px] items-center gap-2 rounded-[13px] border-[1.5px] border-peach bg-cream px-3.5 py-[7px] transition-colors focus-within:border-coral">
          <Search className="size-3.5 shrink-0 text-warmgray" />
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => { if (hits.length > 0) setOpen(true); }}
            placeholder="Rechercher…"
            className="w-full border-none bg-transparent text-[13px] outline-none placeholder:text-warmgray/70"
          />
        </label>
        {open && hits.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
            {hits.map((h) => (
              <button
                key={h.id}
                onClick={() => { router.push(h.href); setOpen(false); setQuery(""); setHits([]); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-peach-pale"
              >
                <span className="shrink-0">{HIT_ICON[h.type]}</span>
                <span className="flex-1 truncate">
                  <span className="block text-[13px] font-medium text-foreground truncate">{h.label}</span>
                  {h.sublabel && <span className="block text-[11px] text-warmgray truncate">{h.sublabel}</span>}
                </span>
                <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-warmgray">{h.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Link
        href={publicHref}
        target="_blank"
        title="Voir le site public généré"
        className="flex h-9 items-center gap-1.5 rounded-xl border-[1.5px] border-peach bg-peach-pale px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:border-coral hover:bg-peach"
      >
        <Globe className="size-4" />
        <span className="hidden lg:inline">Voir le site public</span>
      </Link>

      <Link
        href={`/dashboard/${orgSlug}/notifications`}
        title="Notifications"
        className="relative flex size-9 items-center justify-center rounded-xl border-[1.5px] border-peach bg-peach-pale transition-colors hover:border-coral hover:bg-peach"
      >
        <Bell className="size-4" />
        {unreadNotifCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-cream bg-coral px-0.5 text-[9px] font-bold text-white">
            {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
          </span>
        )}
      </Link>
    </header>
  );
}
