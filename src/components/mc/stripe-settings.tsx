import { Check, ExternalLink, AlertCircle, CreditCard } from "lucide-react";

interface Props {
  orgSlug: string;
  platformConfigured: boolean;
  connected: boolean;       // un compte Stripe existe
  chargesEnabled: boolean;  // onboarding terminé, peut encaisser
}

/**
 * Réglages Stripe Connect — onboarding hébergé Stripe (Lot A).
 * Composant serveur : le bouton est un simple lien vers la route /connect.
 */
export function StripeSettings({ orgSlug, platformConfigured, connected, chargesEnabled }: Props) {
  const connectHref = `/api/orgs/${orgSlug}/stripe/connect`;

  return (
    <div className="mc-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#635BFF]/10">
            <CreditCard className="size-4 text-[#635BFF]" />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">Stripe — paiement des réservations</h3>
            <p className="text-xs text-warmgray">Encaissez vos réservations en ligne. L&apos;argent va directement à votre lieu.</p>
          </div>
        </div>
        {chargesEnabled && (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <Check className="size-3" /> Connecté
          </span>
        )}
      </div>

      {!platformConfigured ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>Le paiement en ligne n&apos;est pas encore activé sur la plateforme. Contactez l&apos;équipe Casa Minga.</span>
        </div>
      ) : chargesEnabled ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Votre compte Stripe est connecté. Vous pouvez envoyer des liens de paiement depuis chaque réservation.
          </div>
          <p className="text-[10px] text-slate-400">
            URL webhook (configurée par Casa Minga) :<br />
            <code className="rounded bg-slate-100 px-1 font-mono">https://admin.casaminga.com/api/orgs/{orgSlug}/stripe/webhook</code>
          </p>
          <a href={connectHref} className="flex items-center gap-1 text-[11px] text-[#635BFF] hover:underline">
            <ExternalLink className="size-3" /> Gérer / mettre à jour mes informations
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {connected && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>Onboarding Stripe à finaliser pour pouvoir encaisser.</span>
            </div>
          )}
          <a
            href={connectHref}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#635BFF] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <CreditCard className="size-4" />
            {connected ? "Finaliser la connexion Stripe" : "Connecter mon compte Stripe"}
          </a>
          <p className="text-[11px] text-warmgray">
            Vous serez redirigé vers Stripe pour saisir vos informations en toute sécurité. Casa Minga ne voit jamais vos identifiants bancaires.
          </p>
        </div>
      )}
    </div>
  );
}
