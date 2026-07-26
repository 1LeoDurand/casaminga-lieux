import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyPortalToken } from "@/lib/portal/token";
import { createAdminClient } from "@/lib/admin/guard";
import { cancelReservationAction } from "./actions";

export const dynamic = "force-dynamic";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
}

/**
 * « J'annule ma réservation » depuis le rappel J-1.
 * Aucun compte : le token HMAC du portail fait foi, et la réservation doit
 * appartenir à l'email signé.
 */
export default async function AnnulerReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { token, id } = await params;
  const { done, error } = await searchParams;

  const email = verifyPortalToken(token);
  if (!email) notFound();

  const admin = createAdminClient();
  if (!admin) notFound();

  const { data: resa } = await admin
    .from("reservations")
    .select("id, title, start_at, end_at, status, organization_id, spaces(name), persons(name, email)")
    .eq("id", id)
    .maybeSingle();

  if (!resa) notFound();

  const person = resa.persons as unknown as { name: string; email: string | null } | null;
  if ((person?.email ?? "").toLowerCase() !== email) notFound();

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", resa.organization_id)
    .maybeSingle();

  const spaceName = (resa.spaces as unknown as { name: string } | null)?.name ?? resa.title ?? "Espace";
  const cancelled = resa.status === "annulee";
  const past = new Date(resa.start_at) <= new Date();
  const isDone = done === "1" || cancelled;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF9EC] px-5 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-[#F0E8E0] bg-white p-8 shadow-sm">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#E8714D]">
          {org?.name ?? "Casa Minga"}
        </p>

        {isDone ? (
          <>
            <h1 className="mt-2 font-heading text-2xl font-bold text-[#2E2A27]">
              Réservation annulée ✓
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
              Votre réservation de <strong>{spaceName}</strong> du {fmtDateTime(resa.start_at)} est
              annulée. Le créneau est de nouveau disponible et l&apos;équipe est prévenue.
            </p>
            <Link
              href={`/espace/${token}`}
              className="mt-6 inline-block text-[14px] font-semibold text-[#E8714D] hover:underline"
            >
              ← Voir mon espace
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-heading text-2xl font-bold text-[#2E2A27]">
              Annuler votre réservation
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
              Bonjour {person?.name ?? ""}, vous êtes sur le point d&apos;annuler la réservation
              ci-dessous. Le créneau sera libéré pour quelqu&apos;un d&apos;autre.
            </p>

            <dl className="mt-5 divide-y divide-[#F0E8E0] rounded-2xl border border-[#F0E8E0] bg-[#FAFAF7] px-4">
              <div className="flex justify-between gap-4 py-3 text-[14px]">
                <dt className="text-[#8A8078]">Espace</dt>
                <dd className="text-right font-semibold text-[#2E2A27]">{spaceName}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-[14px]">
                <dt className="text-[#8A8078]">Début</dt>
                <dd className="text-right font-semibold text-[#2E2A27]">{fmtDateTime(resa.start_at)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-[14px]">
                <dt className="text-[#8A8078]">Fin</dt>
                <dd className="text-right font-semibold text-[#2E2A27]">{fmtDateTime(resa.end_at)}</dd>
              </div>
            </dl>

            {(error || past) && (
              <p className="mt-4 rounded-xl border border-[#E8714D]/30 bg-[#E8714D]/10 p-3 text-[13.5px] text-[#B4472A]">
                {past || error === "passee"
                  ? "Ce créneau a déjà commencé — il n'est plus annulable en ligne. Contactez directement le lieu."
                  : error === "forbidden"
                    ? "Ce lien ne correspond pas à cette réservation."
                    : "Une erreur est survenue. Merci de réessayer."}
              </p>
            )}

            {!past && (
              <form action={cancelReservationAction} className="mt-6 flex flex-col gap-4">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="reservationId" value={resa.id} />

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[#2E2A27]">
                    Motif <span className="font-normal text-[#8A8078]">(facultatif)</span>
                  </span>
                  <textarea
                    name="reason"
                    rows={3}
                    maxLength={500}
                    placeholder="Empêchement de dernière minute…"
                    className="resize-y rounded-xl border border-[#E5DDD6] bg-white px-3.5 py-2.5 text-[14px] text-[#2E2A27] outline-none focus:border-[#E8714D]"
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-full bg-[#FF8A65] px-6 py-3.5 text-[15px] font-bold text-white transition hover:bg-[#E8714D]"
                >
                  Annuler ma réservation
                </button>
                <p className="text-center text-[12.5px] leading-relaxed text-[#8A8078]">
                  L&apos;équipe du lieu est prévenue immédiatement.
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
