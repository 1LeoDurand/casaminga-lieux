"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown, Mail, Check } from "lucide-react";
import { voteHelpful } from "@/app/aide/actions";

export function HelpFeedback({ slug }: { slug: string }) {
  const [voted, setVoted] = useState<null | "yes" | "no">(null);
  const [, startTransition] = useTransition();

  function vote(helpful: boolean) {
    if (voted) return;
    setVoted(helpful ? "yes" : "no");
    startTransition(() => { void voteHelpful(slug, helpful); });
  }

  return (
    <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl bg-peach-pale px-6 py-7 text-center">
      {voted ? (
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Check className="size-4 text-emerald-600" />
          Merci pour votre retour !
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground">Cet article a-t-il aidé ?</p>
          <div className="flex gap-2.5">
            <button
              onClick={() => vote(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DDD6] bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ThumbsUp className="size-4" /> Oui
            </button>
            <button
              onClick={() => vote(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DDD6] bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-red-300 hover:text-red-600"
            >
              <ThumbsDown className="size-4" /> Non
            </button>
          </div>
        </>
      )}

      <a
        href="mailto:support@casaminga.com"
        className="inline-flex items-center gap-2 text-[13px] font-medium text-coral-dark hover:underline"
      >
        <Mail className="size-3.5" /> Une autre question ? Contacter le support
      </a>
    </div>
  );
}
