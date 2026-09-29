import { headers } from "next/headers";
import { createAdminClient } from "@/lib/admin/guard";
import { clientIp, logLinkEvent, resolveContactToken } from "@/lib/outreach/link-token";
import { MAX_CORRECTION_CHARS } from "@/lib/outreach/correction";
import { ContactShell, InvalidLink, buttonClass, inputClass } from "../../_components/shell";
import { submitCorrectionAction } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  empty: "Décrivez l'erreur en quelques mots avant d'envoyer.",
  long: `Votre message est trop long (${MAX_CORRECTION_CHARS} caractères au plus).`,
  server: "Une erreur est survenue. Merci de réessayer, ou de répondre au message reçu.",
};

export default async function CorrectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r } = await searchParams;

  const link = await resolveContactToken(token, "correction", { ip: clientIp(await headers()) });
  if (!link) return <InvalidLink />;

  const admin = createAdminClient();
  if (admin) {
    await logLinkEvent(admin, {
      programId: link.program.id,
      threadId: link.thread.id,
      contactId: link.contact.id,
      type: "link.opened",
      data: { action: "correction" },
    });
  }

  if (r === "ok") {
    return (
      <ContactShell eyebrow={link.contact.name} title="Merci, c'est bien reçu">
        <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
          Votre message est transmis à Léo, qui le lira personnellement. Nous ne modifions rien sans avoir
          vérifié, et nous vous répondrons. Vous pouvez fermer cette page.
        </p>
      </ContactShell>
    );
  }

  const error = r ? ERRORS[r] : undefined;

  return (
    <ContactShell eyebrow={link.contact.name} title="Signaler une erreur">
      <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
        {link.articleTitle ? (
          <>Vous avez repéré une erreur dans l&apos;article «&nbsp;{link.articleTitle}&nbsp;»&nbsp;? </>
        ) : (
          <>Vous avez repéré une erreur&nbsp;? </>
        )}
        Dites-nous ce qu&apos;il faut corriger, en précisant si possible le passage concerné.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[#E8714D]/30 bg-[#E8714D]/10 p-3 text-[13.5px] text-[#B4472A]"
        >
          {error}
        </p>
      )}

      <form action={submitCorrectionAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold text-[#2E2A27]">Votre message</span>
          <textarea
            name="text"
            rows={8}
            required
            minLength={5}
            maxLength={MAX_CORRECTION_CHARS}
            className={`${inputClass} resize-y`}
          />
          <span className="text-[12.5px] text-[#8A8078]">{MAX_CORRECTION_CHARS} caractères au plus.</span>
        </label>
        <button type="submit" className={buttonClass}>
          Envoyer
        </button>
      </form>
    </ContactShell>
  );
}
