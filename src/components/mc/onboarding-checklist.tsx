"use client";

import { useState, useEffect } from "react";
import { Check, X, ChevronRight } from "lucide-react";
import Link from "next/link";

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

interface OnboardingChecklistProps {
  orgSlug: string;
  steps: OnboardingStep[];
}

const DISMISSED_KEY = (slug: string) => `cm-onboarding-dismissed-${slug}`;

export function OnboardingChecklist({ orgSlug, steps }: OnboardingChecklistProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY(orgSlug));
    setVisible(!dismissed);
  }, [orgSlug]);

  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY(orgSlug), "1");
    setVisible(false);
  }

  if (!visible || allDone) return null;

  // SVG progress ring
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const dash = circ * (pct / 100);

  return (
    <div className="mc-card p-5 relative">
      {/* Fermer */}
      <button
        onClick={dismiss}
        className="absolute right-4 top-4 rounded-md p-1 text-warmgray/50 hover:text-warmgray transition-colors"
        title="Ne plus afficher"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-5">
        {/* Progress ring */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--peach-pale)" strokeWidth="5" />
            <circle
              cx="28" cy="28" r={radius} fill="none"
              stroke="var(--coral)" strokeWidth="5"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
            <text x="28" y="28" textAnchor="middle" dominantBaseline="central"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, fontSize: "13px", fill: "var(--coral-dark)" }}>
              {pct}%
            </text>
          </svg>
          <span className="text-[10px] font-medium text-warmgray">{done}/{total}</span>
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <h3 className="font-heading font-bold text-[15px] text-foreground">Premiers pas 🚀</h3>
            <p className="text-xs text-warmgray mt-0.5">Complétez ces étapes pour tirer le meilleur de Casa Minga.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            {steps.map((step) => (
              <Link
                key={step.key}
                href={step.done ? "#" : step.href}
                onClick={(e) => step.done && e.preventDefault()}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  step.done
                    ? "cursor-default opacity-50"
                    : "hover:bg-peach-pale/60 cursor-pointer"
                }`}
              >
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  step.done
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-warmgray/30"
                }`}>
                  {step.done && <Check className="size-3 text-white" strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`font-medium ${step.done ? "line-through text-warmgray" : "text-foreground"}`}>
                    {step.label}
                  </span>
                  {!step.done && (
                    <span className="block text-[11px] text-warmgray/70">{step.description}</span>
                  )}
                </span>
                {!step.done && <ChevronRight className="size-4 shrink-0 text-warmgray/40" />}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
