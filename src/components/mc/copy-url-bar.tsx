"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Copy, Check } from "lucide-react";

/** Affiche une URL publique avec bouton "copier". */
export function CopyUrlBar({ url, display }: { url: string; display: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié ✓");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible — sélectionnez et copiez manuellement.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5">
      <Link2 className="size-4 shrink-0 text-coral" />
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{display}</span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-coral/40"
      >
        {copied ? <Check className="size-3.5 text-[#2f8a4c]" /> : <Copy className="size-3.5" />}
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}
