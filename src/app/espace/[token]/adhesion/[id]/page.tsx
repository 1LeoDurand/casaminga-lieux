import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyPortalToken } from "@/lib/portal/token";
import { createAdminClient } from "@/lib/admin/guard";
import { PUBLIC_SITE_BASE } from "@/lib/site-public/url";
import { declareRenewalIntentAction } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * « Je ne renouvelle pas » depuis le rappel J-30.
 * Aucun compte : le token HMAC du portail fait foi, et l'adhésion doit
 * appartenir à l'email signé.
 */
export default async function AdhesionIntentPage({
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

  const { data: app } = await admin
    .from("membership_applications")
    .select("id, first_name, email, membership_end, organization_id, renewal_intent, renewal_intent_at")
    .eq("id", id)
    .maybeSingle();

  if (!app) notFound();
  if ((app.email ?? "").toLowerCase() !== email) notFound();

  const [{ data: org }, { data: campaign }] = await Promise.all([
    admin.from("organizations").select("name, slug").eq("id", app.organization_id).maybeSingle(),
    admin
      .from("membership_campaigns")
      .select("slug")
      .eq("organization_id", app.organization_id)
      .eq("status", "publie")
      .limit(1)
      .maybeSingle(),
  ]);

  const renewUrl =
    org?.slug && campaign?.slug
      ? `${PUBLIC_SITE_BASE.replace(/\/$/, "")}/${org.slug}/adhesion/${campaign.slug}`
      : null;

  const isDone = done === "1" || Boolean(app.renewal_intent_at);
  const declined = app.renewal_intent === "ne_renouvelle_pas";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF9EC] px-5 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-[#F0E8E0] bg-white p-8 shadow-sm">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#E8714D]">
          {org?.name ?? "Casa Minga"}
        </p>

        {isDone ? (
          <>
            <h1 className="mt-2 font-heading text-2xl font-bold text-[#2E2A27]">
              {declined ? "C'est noté ✓" : "Merci ✓"}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
              {declined
                ? "Nous ne vous relancerons plus au sujet de cette adhésion. Merci de nous l'avoir dit — " +
                  "et si vous changez d'avis, la porte reste ouverte."
                : "Nous avons noté votre intention de renouveler. Les rappels automatiques sont arrêtés."}
            </p>
            {!declined && renewUrl && (
              <a
                href={renewUrl}
                className="mt-6 inline-block rounded-full bg-[#FF8A65] px-6 py-3 text-[15px] font-bold text-white transition hover:bg-[#E8714D]"
              >
                Renouveler maintenant
              </a>
            )}
            <div>
              <Link
                href={`/espace/${token}`}
                className="mt-6 inline-block text-[14px] font-semibold text-[#E8714D] hover:underline"
              >
                ← Voir mon espace
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-heading text-2xl font-bold text-[#2E2A27]">
              Votre adhésion arrive à échéance
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
              Bonjour {app.first_name}, votre adhésion se termine le{" "}
              <strong>{fmtDate(app.membership_end)}</strong>. Dites-nous où vous en êtes : nous
              adapterons nos rappels en conséquence.
            </p>

            {error && (
              <p className="mt-4 rounded-xl border border-[#E8714D]/30 bg-[#E8714D]/10 p-3 text-[13.5px] text-[#B4472A]">
                {error === "forbidden"
                  ? "Ce lien ne correspond pas à cette adhésion."
                  : "Une erreur est survenue. Merci de réessayer."}
              </p>
            )}

            {renewUrl && (
              <a
                href={renewUrl}
                className="mt-6 block rounded-full bg-[#FF8A65] px-6 py-3.5 text-center text-[15px] font-bold text-white transition hover:bg-[#E8714D]"
              >
                Je renouvelle mon adhésion
              </a>
            )}

            <div className="my-6 border-t border-[#F0E8E0]" />

            <form action={declareRenewalIntentAction} className="flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="adhesionId" value={app.id} />
              <input type="hidden" name="intent" value="ne_renouvelle_pas" />

              <p className="text-[14px] font-semibold text-[#2E2A27]">
                Vous ne souhaitez pas renouveler&nbsp;?
              </p>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] text-[#8A8078]">
                  Si vous voulez nous en dire un mot <span className="italic">(facultatif)</span>
                </span>
                <textarea
                  name="note"
                  rows={3}
                  maxLength={500}
                  placeholder="Déménagement, budget, autre projet…"
                  className="resize-y rounded-xl border border-[#E5DDD6] bg-white px-3.5 py-2.5 text-[14px] text-[#2E2A27] outline-none focus:border-[#E8714D]"
                />
              </label>

              <button
                type="submit"
                className="rounded-full border border-[#E5DDD6] px-6 py-3 text-[14.5px] font-semibold text-[#6B625B] transition hover:border-[#C9BDB2] hover:text-[#2E2A27]"
              >
                Je ne renouvelle pas
              </button>
              <p className="text-center text-[12.5px] leading-relaxed text-[#8A8078]">
                Aucune justification nécessaire. Nous arrêtons simplement les rappels.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
