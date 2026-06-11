"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LinkIcon, Copy, Check, AlertCircle, Mail } from "lucide-react";
import {
  requestCustomDomainAction,
  verifyCustomDomainAction,
  removeCustomDomainAction,
  type CustomDomainState,
} from "@/app/(admin)/dashboard/[org]/site-public/actions";

const TARGET_IP = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_TARGET_IP ?? "";

function normalizeDomainClient(raw: string): string {
  return raw.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" onClick={copy}
      className="ml-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-semibold text-warmgray hover:text-ink">
      {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

function EmailRegistrarEncart() {
  return (
    <div className="mt-1 flex items-start gap-3 rounded-xl border border-border bg-[#FAFAF7] p-3">
      <Mail className="mt-0.5 size-4 shrink-0 text-warmgray" />
      <div className="text-[12px] text-warmgray">
        <span className="font-semibold text-ink">Adresse email personnalisée</span>{" "}
        (ex.&nbsp;<span className="font-mono">contact@monlieu.fr</span>) — à créer directement chez votre registrar, souvent incluse avec le domaine.{" "}
        <a href="/aide/adresse-email-registrar" className="text-coral hover:underline">Comment faire →</a>
      </div>
    </div>
  );
}

export function CustomDomainCard({ orgId, orgSlug, initial }: {
  orgId: string;
  orgSlug: string;
  initial: CustomDomainState;
}) {
  const [state, setState] = useState<CustomDomainState>(initial);
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const res = await requestCustomDomainAction(orgId, orgSlug, domainInput);
      if (!res.ok) { setError(res.error ?? "Erreur"); return; }
      setState({
        domain: normalizeDomainClient(domainInput),
        status: "pending_dns",
        token: res.token ?? null,
      });
      setDomainInput("");
      toast.success("Domaine enregistré — configurez votre DNS");
    });
  }

  function handleVerify() {
    setError(null);
    startTransition(async () => {
      const res = await verifyCustomDomainAction(orgId, orgSlug);
      if (!res.ok) { setError(res.error ?? "Erreur"); return; }
      setState((s) => ({ ...s, status: "verified" }));
      toast.success("DNS vérifié — nous allons activer votre domaine sous 24 h");
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await removeCustomDomainAction(orgId, orgSlug);
      if (!res.ok) { setError(res.error ?? "Erreur"); return; }
      setState({ domain: null, status: null, token: null });
      toast.success("Domaine retiré");
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <h3 className="mb-4 flex items-center gap-2 font-heading text-base font-bold text-ink">
        <LinkIcon className="size-4 text-coral" />
        Domaine personnalisé
      </h3>

      <p className="-mt-2 mb-4 text-[12px] text-warmgray">
        Publiez votre site sur votre propre adresse (ex.&nbsp;<span className="font-mono">monlieu.fr</span>).
        Le thème que vous choisissez s&apos;applique sur votre domaine — sur{" "}
        <span className="font-mono">casaminga.com</span>, le design Casa Minga reste harmonisé.
      </p>

      {/* État : aucun domaine */}
      {!state.domain || state.status === null ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && domainInput && handleRequest()}
              placeholder="monlieu.fr"
              disabled={isPending}
            />
            <button
              type="button"
              onClick={handleRequest}
              disabled={isPending || !domainInput.trim()}
              className="shrink-0 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-dark disabled:opacity-40"
            >
              {isPending ? "…" : "Connecter"}
            </button>
          </div>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
          <EmailRegistrarEncart />
        </div>
      ) : null}

      {/* État : pending_dns */}
      {state.status === "pending_dns" && state.domain ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-700">
              <span className="size-1.5 rounded-full bg-amber-400" />
              En attente DNS — <span className="font-mono">{state.domain}</span>
            </span>
            <button type="button" onClick={handleRemove} disabled={isPending}
              className="text-[12px] text-warmgray underline hover:text-red-600 disabled:opacity-40">
              Annuler
            </button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-[13px]">
            <p className="mb-3 font-semibold text-ink">Ajoutez ces enregistrements DNS chez votre registrar :</p>

            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-white p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">1. TXT — vérification</span>
                </div>
                <div className="font-mono text-[12px] text-ink">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-warmgray">Nom :</span>
                    <span>_casaminga.{state.domain}</span>
                    <CopyButton text={`_casaminga.${state.domain}`} />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1 flex-wrap">
                    <span className="text-warmgray">Valeur :</span>
                    <span className="break-all">{state.token}</span>
                    <CopyButton text={state.token ?? ""} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">2. CNAME — routage</span>
                </div>
                <div className="font-mono text-[12px] text-ink">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-warmgray">Nom :</span>
                    <span>www.{state.domain}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1 flex-wrap">
                    <span className="text-warmgray">Cible :</span>
                    <span>casaminga.com</span>
                    <CopyButton text="casaminga.com" />
                  </div>
                </div>
                {TARGET_IP ? (
                  <div className="mt-2 font-mono text-[12px] text-ink">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-warmgray">Nom apex :</span>
                      <span>{state.domain}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                      <span className="text-warmgray">IP (A) :</span>
                      <span>{TARGET_IP}</span>
                      <CopyButton text={TARGET_IP} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-warmgray">
                    Pour l&apos;apex (<span className="font-mono">{state.domain}</span> sans www), ajoutez un enregistrement A.{" "}
                    <a href="/aide/domaine-personnalise" className="text-coral hover:underline">Voir l&apos;article d&apos;aide</a>
                  </p>
                )}
              </div>
            </div>

            <p className="mt-3 text-[12px] text-warmgray">
              La propagation DNS peut prendre jusqu&apos;à <strong>1 heure</strong>. Revenez vérifier une fois les enregistrements ajoutés.
            </p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleVerify}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-coral/30 bg-white px-4 py-2.5 text-sm font-semibold text-coral transition hover:bg-coral/5 disabled:opacity-40"
          >
            {isPending ? "Vérification…" : "Vérifier la configuration DNS"}
          </button>
        </div>
      ) : null}

      {/* État : verified */}
      {state.status === "verified" && state.domain ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-700">
              <Check className="size-3.5" />
              DNS vérifié — <span className="font-mono">{state.domain}</span>
            </div>
            <button type="button" onClick={handleRemove} disabled={isPending}
              className="shrink-0 text-[12px] text-warmgray underline hover:text-red-600 disabled:opacity-40">
              Annuler
            </button>
          </div>
          <p className="rounded-xl bg-blue-50/60 p-3 text-[13px] text-blue-800">
            Votre domaine est vérifié. Notre équipe va activer la connexion dans les <strong>24 heures</strong> — vous recevrez un email de confirmation.
          </p>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
        </div>
      ) : null}

      {/* État : active */}
      {state.status === "active" && state.domain ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <a
              href={`https://${state.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-[12px] font-semibold text-green-700 hover:bg-green-100"
            >
              <span className="size-2 rounded-full bg-green-500" />
              En ligne · {state.domain}
            </a>
            <button type="button" onClick={handleRemove} disabled={isPending}
              className="shrink-0 text-[12px] text-warmgray underline hover:text-red-600 disabled:opacity-40">
              Retirer le domaine
            </button>
          </div>
          <p className="text-[12px] text-warmgray">
            Le thème choisi dans l&apos;onglet Site public s&apos;applique sur votre domaine.
            Sur <span className="font-mono">casaminga.com/{orgSlug}</span>, le design Casa Minga (Chaleureux) reste actif.
          </p>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
