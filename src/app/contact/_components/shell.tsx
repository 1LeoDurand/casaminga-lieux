import type { ReactNode } from "react";

/** Cadre commun des pages du lien signé (style de src/app/espace). */
export function ContactShell({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF9EC] px-4 py-10 sm:px-5 sm:py-12">
      <div className="w-full max-w-lg rounded-3xl border border-[#F0E8E0] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#E8714D]">{eyebrow ?? "Casa Minga"}</p>
        <h1 className="mt-2 font-heading text-2xl font-bold text-[#2E2A27]">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** Réponse unique pour un jeton invalide, expiré, falsifié, inconnu ou une action absente du programme. */
export function InvalidLink() {
  return (
    <ContactShell title="Ce lien n'est plus valable">
      <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
        Ce lien ne fonctionne pas ou a expiré. Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, répondez
        simplement au message que vous avez reçu : une personne vous lira.
      </p>
    </ContactShell>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[#E5DDD6] bg-white px-3.5 py-2.5 text-[14px] text-[#2E2A27] outline-none focus:border-[#E8714D]";
export const buttonClass =
  "rounded-full bg-[#FF8A65] px-6 py-3.5 text-center text-[15px] font-bold text-white transition hover:bg-[#E8714D]";
