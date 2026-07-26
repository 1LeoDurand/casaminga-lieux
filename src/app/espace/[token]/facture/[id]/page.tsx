import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyPortalToken } from "@/lib/portal/token";
import { createAdminClient } from "@/lib/admin/guard";
import { formatEuros } from "@/lib/invoicing/types";
import { declarePaymentAction } from "./actions";

export const dynamic = "force-dynamic";

const METHODS = [
  { value: "virement", label: "Virement bancaire" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
  { value: "prelevement", label: "Prélèvement automatique" },
  { value: "autre", label: "Autre" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Déclaration « j'ai déjà réglé » depuis le lien reçu par email.
 * Aucun compte requis : le token HMAC du portail fait foi, et la facture doit
 * appartenir à l'email signé.
 */
export default async function DeclarerPaiementPage({
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

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, number, client_email, client_name, total_ttc, status, due_date, payment_declared_at, payment_declared_date, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();
  if ((invoice.client_email ?? "").toLowerCase() !== email) notFound();

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", invoice.organization_id)
    .maybeSingle();

  const alreadyPaid = invoice.status === "payee";
  const alreadyDeclared = Boolean(invoice.payment_declared_at);
  const isDone = done === "1" || alreadyDeclared || alreadyPaid;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF9EC] px-5 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-[#F0E8E0] bg-white p-8 shadow-sm">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#E8714D]">
          {org?.name ?? "Casa Minga"}
        </p>

        {isDone ? (
          <>
            <h1 className="mt-2 font-heading text-2xl font-bold text-[#2E2A27]">
              {alreadyPaid ? "Cette facture est réglée ✓" : "Merci, c'est noté ✓"}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
              {alreadyPaid
                ? `La facture ${invoice.number} est enregistrée comme payée. Vous ne recevrez plus de rappel.`
                : `Nous avons bien enregistré votre déclaration pour la facture ${invoice.number}. ` +
                  `Les rappels automatiques sont suspendus et notre équipe vérifie la réception du paiement.`}
            </p>
            {!alreadyPaid && (
              <p className="mt-4 rounded-2xl bg-[#FFF9EC] p-4 text-[13.5px] leading-relaxed text-[#6B625B]">
                Si nous ne retrouvons pas le règlement, nous reviendrons vers vous — sans relance automatique.
              </p>
            )}
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
              Signaler le règlement
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B625B]">
              Bonjour {invoice.client_name}, vous avez déjà réglé cette facture&nbsp;? Indiquez-le ci-dessous :
              nous cesserons immédiatement de vous relancer.
            </p>

            <dl className="mt-5 divide-y divide-[#F0E8E0] rounded-2xl border border-[#F0E8E0] bg-[#FAFAF7] px-4">
              <div className="flex justify-between py-3 text-[14px]">
                <dt className="text-[#8A8078]">Facture</dt>
                <dd className="font-semibold text-[#2E2A27]">{invoice.number ?? "—"}</dd>
              </div>
              <div className="flex justify-between py-3 text-[14px]">
                <dt className="text-[#8A8078]">Montant TTC</dt>
                <dd className="font-semibold text-[#2E2A27]">{formatEuros(invoice.total_ttc)}</dd>
              </div>
              <div className="flex justify-between py-3 text-[14px]">
                <dt className="text-[#8A8078]">Échéance</dt>
                <dd className="font-semibold text-[#2E2A27]">{fmtDate(invoice.due_date)}</dd>
              </div>
            </dl>

            {error && (
              <p className="mt-4 rounded-xl border border-[#E8714D]/30 bg-[#E8714D]/10 p-3 text-[13.5px] text-[#B4472A]">
                {error === "forbidden"
                  ? "Ce lien ne correspond pas à cette facture."
                  : "Une erreur est survenue. Merci de réessayer."}
              </p>
            )}

            <form action={declarePaymentAction} className="mt-6 flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="invoiceId" value={invoice.id} />

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#2E2A27]">Mode de paiement</span>
                <select
                  name="method"
                  defaultValue="virement"
                  className="rounded-xl border border-[#E5DDD6] bg-white px-3.5 py-2.5 text-[14px] text-[#2E2A27] outline-none focus:border-[#E8714D]"
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#2E2A27]">Date du règlement</span>
                <input
                  type="date"
                  name="paidOn"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="rounded-xl border border-[#E5DDD6] bg-white px-3.5 py-2.5 text-[14px] text-[#2E2A27] outline-none focus:border-[#E8714D]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#2E2A27]">
                  Précision <span className="font-normal text-[#8A8078]">(facultatif)</span>
                </span>
                <textarea
                  name="note"
                  rows={3}
                  maxLength={500}
                  placeholder="Référence du virement, date d'encaissement du chèque…"
                  className="resize-y rounded-xl border border-[#E5DDD6] bg-white px-3.5 py-2.5 text-[14px] text-[#2E2A27] outline-none focus:border-[#E8714D]"
                />
              </label>

              <button
                type="submit"
                className="mt-1 rounded-full bg-[#FF8A65] px-6 py-3.5 text-[15px] font-bold text-white transition hover:bg-[#E8714D]"
              >
                J'ai réglé cette facture
              </button>
              <p className="text-center text-[12.5px] leading-relaxed text-[#8A8078]">
                Votre déclaration est transmise à l'équipe, qui vérifiera la réception du paiement.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
