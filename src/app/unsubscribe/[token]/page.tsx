import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonByUnsubscribeToken, unsubscribeByToken } from "@/lib/newsletter/data";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Token factice pour l'aperçu (ne rien faire)
  if (token === "preview") {
    return <UnsubscribeLayout status="preview" />;
  }

  const person = await getPersonByUnsubscribeToken(token);
  if (!person) notFound();

  const result = await unsubscribeByToken(token);

  return <UnsubscribeLayout status={result.ok ? "success" : "error"} name={person.name} />;
}

function UnsubscribeLayout({
  status,
  name,
}: {
  status: "success" | "error" | "preview";
  name?: string;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF5] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[#E8E3DC] bg-white p-10 text-center shadow-sm">
        {/* Logo */}
        <div className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl bg-[#C75A38]/10">
          <span className="text-2xl">📬</span>
        </div>

        {status === "success" && (
          <>
            <h1 className="font-heading text-2xl font-extrabold text-[#1C1917]">
              Désabonnement confirmé
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#78716C]">
              {name ? `${name}, vous` : "Vous"} ne recevrez plus de newsletters
              de ce lieu. Vous restez membre et pouvez vous réabonner à tout
              moment depuis votre espace.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="font-heading text-2xl font-extrabold text-[#1C1917]">
              Une erreur est survenue
            </h1>
            <p className="mt-3 text-[15px] text-[#78716C]">
              Impossible de traiter votre demande. Le lien est peut-être expiré.
              Contactez directement le lieu pour vous désabonner.
            </p>
          </>
        )}

        {status === "preview" && (
          <>
            <h1 className="font-heading text-2xl font-extrabold text-[#1C1917]">
              Aperçu — Désabonnement
            </h1>
            <p className="mt-3 text-[15px] text-[#78716C]">
              Cette page apparaît en bas de chaque newsletter envoyée.
              En production, elle désabonne réellement le destinataire.
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full border border-[#E8E3DC] bg-white px-6 py-2.5 text-sm font-semibold text-[#1C1917] hover:border-[#C75A38]/40"
        >
          Retour à l&apos;accueil
        </Link>

        <p className="mt-6 text-[12px] text-[#78716C]">
          Propulsé par{" "}
          <span className="font-semibold text-[#1C1917]">Casa Minga Lieux</span>
        </p>
      </div>
    </main>
  );
}
