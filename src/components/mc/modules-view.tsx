"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { MODULE_SECTIONS, type ModuleDef } from "@/lib/modules";
import { toggleModuleAction } from "@/app/(admin)/dashboard/[org]/modules/actions";

const LAYER_LABELS: Record<number, string> = {
  0: "Socle — toujours actif",
  1: "Activités",
  2: "Avancé",
};

const LAYER_DESC: Record<number, string> = {
  0: "Ces modules sont fondamentaux et ne peuvent pas être désactivés.",
  1: "Activez les outils dont votre lieu a besoin. Vous pouvez les modifier à tout moment — vos données sont conservées.",
  2: "Outils spécialisés. Révélés progressivement selon l'usage de votre lieu.",
};

function ModuleToggle({
  m,
  enabled,
  orgId,
  orgSlug,
}: {
  m: ModuleDef;
  enabled: boolean;
  orgId: string;
  orgSlug: string;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const isSocle = m.layer === 0;

  function toggle() {
    if (isSocle) return;
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await toggleModuleAction(orgId, orgSlug, m.key, next);
      if (!res.ok) {
        setOn(!next); // rollback
        toast.error(res.error ?? "Erreur");
      } else {
        toast.success(next ? `« ${m.label} » activé` : `« ${m.label} » désactivé`);
      }
    });
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
        isSocle
          ? "border-border bg-cream opacity-70"
          : on
          ? "border-coral/30 bg-[#fff8f5]"
          : "border-border bg-white hover:border-border/80"
      }`}
    >
      {/* Toggle ou verrou */}
      <button
        type="button"
        onClick={toggle}
        disabled={isSocle || pending}
        aria-label={isSocle ? "Module socle" : on ? "Désactiver" : "Activer"}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-default ${
          on ? "bg-coral" : "bg-warmgray/30"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            on ? "left-4" : "left-0.5"
          }`}
        />
      </button>

      {/* Infos */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-ink">{m.label}</span>
          {isSocle && <Lock className="size-3 text-warmgray/60" />}
          {on && !isSocle && <Check className="size-3.5 text-coral" />}
        </div>
        {m.description && (
          <p className="mt-0.5 text-[12px] leading-relaxed text-warmgray">{m.description}</p>
        )}
      </div>
    </div>
  );
}

export function ModulesView({
  orgId,
  orgSlug,
  enabledModules,
}: {
  orgId: string;
  orgSlug: string;
  enabledModules: Set<string>;
}) {
  // Regroupe tous les modules par layer pour l'affichage
  const byLayer: Record<number, ModuleDef[]> = { 0: [], 1: [], 2: [] };
  for (const section of MODULE_SECTIONS) {
    for (const m of section.modules) {
      byLayer[m.layer].push(m);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {([0, 1, 2] as const).map((layer) => (
        <div key={layer}>
          <div className="mb-1">
            <h2 className="font-heading text-base font-bold text-ink">{LAYER_LABELS[layer]}</h2>
            <p className="text-[12.5px] text-warmgray">{LAYER_DESC[layer]}</p>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {byLayer[layer].map((m) => (
              <ModuleToggle
                key={m.key}
                m={m}
                enabled={m.layer === 0 || enabledModules.has(m.key)}
                orgId={orgId}
                orgSlug={orgSlug}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
