"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText } from "lucide-react";

export interface HelpSearchItem {
  slug: string;
  title: string;
  excerpt: string;
  categoryLabel: string;
  keywords: string[];
}

export function HelpSearch({ items }: { items: HelpSearchItem[] }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return items
      .filter((it) => {
        const hay = [it.title, it.excerpt, it.categoryLabel, ...it.keywords]
          .join(" ")
          .toLowerCase();
        return term.split(/\s+/).every((w) => hay.includes(w));
      })
      .slice(0, 8);
  }, [q, items]);

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-warmgray" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une réponse…"
          aria-label="Rechercher dans le centre d'aide"
          className="w-full rounded-full border border-[#E5DDD6] bg-white py-4 pl-12 pr-4 text-[15px] text-foreground shadow-sm outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/15"
        />
      </div>

      {q.trim().length >= 2 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[#E5DDD6] bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-warmgray">
              Aucun résultat pour « {q.trim()} ».
            </p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/aide/${r.slug}`}
                    className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-peach-pale"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-peach-pale text-coral-dark">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {r.title}
                      </span>
                      <span className="block truncate text-[12px] text-warmgray">
                        {r.categoryLabel} · {r.excerpt}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
