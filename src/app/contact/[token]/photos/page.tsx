import { headers } from "next/headers";
import { createAdminClient } from "@/lib/admin/guard";
import { clientIp, logLinkEvent, resolveContactToken } from "@/lib/outreach/link-token";
import { LICENCES, SCOPES, consentPreview, type PhotoLicence, type PhotoScope } from "@/lib/outreach/consent";
import { ContactShell, InvalidLink, buttonClass, inputClass } from "../../_components/shell";
import { FilesInput } from "./files-input";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  licence: "Choisissez une licence.",
  scope: "Indiquez ce que couvre votre accord.",
  name: "Indiquez votre nom.",
  credit: "Indiquez le crédit à afficher sous les photos.",
  accept: "Cochez la case pour confirmer que vous avez lu l'accord.",
  no_files: "Ajoutez au moins une photo, ou choisissez « les photos déjà publiées dans l'article ».",
  too_many: "Dix photos au plus par envoi.",
  too_big: "Chaque photo doit peser 10 Mo au plus.",
  bad_type: "Seules les images JPEG, PNG et WebP sont acceptées.",
  rate: "Vous avez déjà fait plusieurs envois aujourd'hui. Réessayez demain, ou répondez au message reçu.",
  server: "Une erreur est survenue. Merci de réessayer, ou de répondre au message reçu.",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function PhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r } = await searchParams;

  const link = await resolveContactToken(token, "photos", { ip: clientIp(await headers()) });
  if (!link) return <InvalidLink />;

  const admin = createAdminClient();
  if (admin) {
    await logLinkEvent(admin, {
      programId: link.program.id,
      threadId: link.thread.id,
      contactId: link.contact.id,
      type: "link.opened",
      data: { action: "photos" },
    });
  }

  if (r === "ok") {
    return (
      <ContactShell eyebrow={link.contact.name} title="Merci, c'est bien reçu">
        <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
          Votre accord est enregistré, avec la date et le texte que vous avez lu. Nous créditerons les photos comme
          vous l&apos;avez demandé. Vous pouvez fermer cette page.
        </p>
      </ContactShell>
    );
  }

  const error = r ? ERRORS[r] : undefined;
  const alreadyGranted = Boolean(link.thread.photos_granted_at);

  return (
    <ContactShell eyebrow={link.contact.name} title="Vos photos pour Casa Minga">
      <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
        Casa Minga aimerait utiliser des photos de votre lieu
        {link.articleTitle ? <>, notamment pour l&apos;article «&nbsp;{link.articleTitle}&nbsp;»</> : null}. Pour cela,
        nous avons besoin de votre accord écrit, que vous pouvez donner ici en quelques minutes.
      </p>

      {alreadyGranted && (
        <p className="mt-4 rounded-xl border border-[#F0E8E0] bg-[#FFF9EC] p-3 text-[13.5px] text-[#6B625B]">
          Nous avons déjà reçu un accord pour ce lieu. Vous pouvez en envoyer un nouveau, par exemple pour ajouter des
          photos.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[#E8714D]/30 bg-[#E8714D]/10 p-3 text-[13.5px] text-[#B4472A]"
        >
          {error}
        </p>
      )}

      {/* Envoi classique (sans JavaScript) vers une route qui accepte de gros fichiers. */}
      <form
        method="post"
        action={`/api/contact/${token}/photos`}
        encType="multipart/form-data"
        className="mt-6 flex flex-col gap-5"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[14px] font-semibold text-[#2E2A27]">Ce que couvre votre accord</legend>
          {(Object.keys(SCOPES) as PhotoScope[]).map((k) => (
            <label key={k} className="flex items-start gap-2.5 text-[14px] text-[#2E2A27]">
              <input type="radio" name="scope" value={k} required defaultChecked={k === "les_deux"} className="mt-1" />
              <span>{capitalize(SCOPES[k])}</span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold text-[#2E2A27]">Vos photos</span>
          <span className="text-[13px] text-[#8A8078]">JPEG, PNG ou WebP, 10 photos au plus, 10 Mo chacune.</span>
          <FilesInput className={inputClass} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[14px] font-semibold text-[#2E2A27]">Licence</legend>
          {(Object.keys(LICENCES) as PhotoLicence[]).map((k) => (
            <label key={k} className="flex items-start gap-2.5 text-[14px] text-[#2E2A27]">
              <input type="radio" name="licence" value={k} required defaultChecked={k === "CC-BY-4.0"} className="mt-1" />
              <span>
                <strong>{LICENCES[k].label}</strong>
                <span className="block text-[13px] text-[#8A8078]">{LICENCES[k].note}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold text-[#2E2A27]">Crédit à afficher sous les photos</span>
          <input
            name="credit"
            required
            minLength={2}
            maxLength={200}
            defaultValue={link.contact.name}
            className={inputClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-[#2E2A27]">Votre nom</span>
            <input name="name" required minLength={2} maxLength={200} autoComplete="name" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-[#2E2A27]">
              Votre fonction <span className="font-normal italic text-[#8A8078]">(facultatif)</span>
            </span>
            <input name="role" maxLength={100} className={inputClass} />
          </label>
        </div>

        <div>
          <p className="text-[14px] font-semibold text-[#2E2A27]">Le texte de l&apos;accord</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[#E5DDD6] bg-[#FFF9EC] p-3.5 font-sans text-[13px] leading-relaxed text-[#2E2A27]">
            {consentPreview(link.contact.name)}
          </pre>
        </div>

        <label className="flex items-start gap-2.5 text-[14px] text-[#2E2A27]">
          <input type="checkbox" name="accept" required className="mt-1" />
          <span>J&apos;ai lu cet accord en entier et je l&apos;accepte.</span>
        </label>

        <button type="submit" className={buttonClass}>
          Envoyer mon accord
        </button>
      </form>
    </ContactShell>
  );
}
