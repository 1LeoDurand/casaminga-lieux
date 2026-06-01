"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { saveHelloAssoSettingsAction, syncHelloAssoAction } from "@/app/(admin)/dashboard/[org]/parametres/actions";

interface Props {
  orgSlug: string;
  connected: boolean;
  haOrgSlug: string | null;
}

export function HelloAssoSettings({ orgSlug, connected, haOrgSlug }: Props) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [haSlug, setHaSlug] = useState(haOrgSlug ?? "");
  const [formSlug, setFormSlug] = useState("");
  const [showForm, setShowForm] = useState(!connected);
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [pending, start] = useTransition();
  const [syncPending, startSync] = useTransition();

  const inputCls = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral w-full";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim() || !haSlug.trim()) return;
    start(async () => {
      const ok = await saveHelloAssoSettingsAction(orgSlug, {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        haOrgSlug: haSlug.trim(),
      });
      if (ok) {
        toast.success("Connexion HelloAsso enregistrée ✓");
        setShowForm(false);
        setClientId(""); setClientSecret("");
      } else {
        toast.error("Erreur lors de l'enregistrement");
      }
    });
  }

  async function handleSync(e: React.FormEvent) {
    e.preventDefault();
    if (!formSlug.trim()) return;
    startSync(async () => {
      const res = await syncHelloAssoAction(orgSlug, formSlug.trim());
      if (res.ok) {
        setSyncResult({ imported: res.imported ?? 0, skipped: res.skipped ?? 0 });
        toast.success(`Import terminé : ${res.imported} adhésion(s) importée(s)`);
      } else {
        toast.error(res.error ?? "Erreur lors de l'import");
      }
    });
  }

  return (
    <div className="mc-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#f04e37]/10">
            <span className="text-sm font-bold text-[#f04e37]">HA</span>
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">HelloAsso</h3>
            <p className="text-xs text-warmgray">Synchronisation des adhésions et paiements</p>
          </div>
        </div>
        {connected && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <Check className="size-3" /> Connecté
          </span>
        )}
      </div>

      {/* Infos si connecté */}
      {connected && !showForm && (
        <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
          Organisation HelloAsso : <code className="font-mono text-xs">{haOrgSlug}</code>
        </div>
      )}

      {/* Formulaire connexion */}
      {showForm ? (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Récupérez vos identifiants dans{" "}
              <a href="https://dev.helloasso.com" target="_blank" rel="noopener noreferrer" className="underline">
                dev.helloasso.com
              </a>
              {" "}→ Mon API → Créer une application.
            </span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Slug organisation HelloAsso</label>
            <input value={haSlug} onChange={(e) => setHaSlug(e.target.value)} placeholder="mon-association" className={inputCls} required />
            <p className="mt-1 text-[10px] text-slate-400">Visible dans l'URL : helloasso.com/<strong>mon-association</strong>/…</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Client ID</label>
            <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={inputCls} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Client Secret</label>
            <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="••••••••••••" className={inputCls} required />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-lg bg-[#f04e37] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
              {pending ? "Connexion…" : "Connecter HelloAsso"}
            </button>
            {connected && (
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 text-sm text-slate-500 hover:bg-slate-50">
                Annuler
              </button>
            )}
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600">
          Modifier les identifiants
        </button>
      )}

      {/* Import manuel */}
      {connected && (
        <form onSubmit={handleSync} className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Import d'adhérents existants</h4>
            <p className="text-xs text-slate-500">Entrez le slug du formulaire HelloAsso pour importer l'historique.</p>
          </div>
          <div className="flex gap-2">
            <input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="adhesion-2025" className={inputCls} />
            <button type="submit" disabled={syncPending}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <RefreshCw className={`size-3.5 ${syncPending ? "animate-spin" : ""}`} />
              {syncPending ? "Import…" : "Importer"}
            </button>
          </div>
          {syncResult && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
              ✓ {syncResult.imported} importé(s) · {syncResult.skipped} ignoré(s) (déjà présents)
            </div>
          )}
          <p className="text-[10px] text-slate-400">
            URL webhook à configurer dans HelloAsso :<br />
            <code className="font-mono bg-slate-100 px-1 rounded">
              https://admin.casaminga.com/api/orgs/{orgSlug}/helloasso/webhook
            </code>
          </p>
          <a href="https://www.helloasso.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-[#f04e37] hover:underline">
            <ExternalLink className="size-3" /> Ouvrir HelloAsso
          </a>
        </form>
      )}
    </div>
  );
}
