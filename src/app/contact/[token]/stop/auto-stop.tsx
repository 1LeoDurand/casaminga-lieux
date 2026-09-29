"use client";

import { useEffect, useState } from "react";
import { stopAction } from "./actions";

/**
 * La page s'envoie en POST au chargement : un simple GET (robot de messagerie,
 * aperçu de lien) ne désinscrit personne. Sans JavaScript, ou si l'appel échoue,
 * le bouton fait la même chose par un envoi de formulaire.
 */
export function AutoStop({ token }: { token: string }) {
  const [state, setState] = useState<"pending" | "done" | "error">("pending");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contact/${encodeURIComponent(token)}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "via=page",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    })
      .then((res) => {
        if (!cancelled) setState(res.ok ? "done" : "error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "done") {
    return (
      <>
        <p className="mt-3 text-[15px] font-semibold text-[#2E2A27]">C&apos;est noté.</p>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B625B]">
          Nous ne vous écrirons plus. Vous n&apos;avez rien d&apos;autre à faire, et vous pouvez fermer cette page.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]" aria-live="polite">
        {state === "pending"
          ? "Enregistrement de votre demande…"
          : "Nous n'avons pas pu enregistrer votre demande automatiquement. Le bouton ci-dessous le fera."}
      </p>
      <form action={stopAction} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full rounded-full bg-[#FF8A65] px-6 py-3.5 text-center text-[15px] font-bold text-white transition hover:bg-[#E8714D]"
        >
          Ne plus recevoir de messages de Casa Minga
        </button>
      </form>
    </>
  );
}
