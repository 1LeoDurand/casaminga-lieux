"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, X, ArrowRight } from "lucide-react";

/**
 * Bloc fantôme — suggère le prochain module pertinent pour l'archétype du lieu.
 * Dismissable par module (localStorage) : une fois fermé, il ne revient pas,
 * et la suggestion suivante prendra sa place à la prochaine visite.
 */
const DISMISSED_KEY = (slug: string, mod: string) => `cm-suggest-${slug}-${mod}`;

export function ModuleSuggestion({ orgSlug, module, title, description }: {
  orgSlug: string;
  module: string;
  title: string;
  description: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!localStorage.getItem(DISMISSED_KEY(orgSlug, module)));
  }, [orgSlug, module]);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY(orgSlug, module), "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative rounded-2xl border border-dashed border-amber-300/70 bg-amber-50/40 px-[22px] py-5">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3.5 top-3.5 rounded-md p-1 text-warmgray/50 transition-colors hover:text-warmgray"
        title="Ne plus suggérer"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span className="mt-0.5 shrink-0 text-amber-500">
          <Sparkles className="size-[18px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-warmgray">{description}</p>
          <Link
            href={`/dashboard/${orgSlug}/modules`}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-coral-dark hover:underline"
          >
            Activer le module <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
