"use client";

import { useState } from "react";
import { HelpCircle, X, BookOpen, Calendar, MessageCircle, Mail } from "lucide-react";

/**
 * Bouton d'aide flottant (bas-gauche).
 * Inspiré de Yapla/AssoConnect : accès docs + réservation de démo + contact.
 */
export function HelpWidget() {
  const [open, setOpen] = useState(false);

  const links = [
    { icon: <BookOpen className="size-4" />, label: "Centre d'aide", desc: "Guides et tutoriels", href: "/aide" },
    { icon: <Calendar className="size-4" />, label: "Réserver une démo", desc: "30 min avec un expert", href: "https://casaminga.com/demo" },
    { icon: <Mail className="size-4" />, label: "Nous contacter", desc: "support@casaminga.com", href: "mailto:support@casaminga.com" },
  ];

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {open && (
        <div className="fixed bottom-20 left-4 z-50 w-72 rounded-xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Besoin d'aide ?</span>
            <button onClick={() => setOpen(false)} className="text-warmgray/50 hover:text-warmgray">
              <X className="size-4" />
            </button>
          </div>
          <div className="p-2">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target={l.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-cream"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-peach-pale text-coral-dark">
                  {l.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{l.label}</span>
                  <span className="block text-[11px] text-warmgray">{l.desc}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Aide et support"
        className={`fixed bottom-4 left-4 z-50 flex h-11 items-center gap-2 rounded-full px-4 shadow-lg transition-all hover:scale-105 active:scale-95 ${
          open ? "bg-coral-dark text-white" : "bg-white text-foreground border border-border"
        }`}
      >
        {open ? <X className="size-4" /> : <HelpCircle className="size-4" />}
        <span className="text-sm font-medium">Aide</span>
      </button>
    </>
  );
}
