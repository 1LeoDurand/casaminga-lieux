"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AdminSidebar } from "./admin-sidebar";

/**
 * Coquille responsive du super-admin /admin.
 *
 * Reprend le MÊME mécanisme que l'admin de base (`dashboard-shell.tsx`) :
 *  - Desktop (≥ lg) : sidebar statique dans la grille (232 px + contenu).
 *  - Mobile (< lg)  : topbar avec hamburger + sidebar en tiroir off-canvas,
 *    voile de fond et verrou de scroll. Le tiroir se ferme à chaque navigation.
 */
export function AdminShell({
  email,
  feedbackOpen = 0,
  moderationPending = 0,
  children,
}: {
  email: string;
  feedbackOpen?: number;
  moderationPending?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fermer le tiroir à chaque changement de page
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Verrouiller le scroll du body quand le tiroir est ouvert
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="grid h-[100dvh] grid-cols-1 grid-rows-[52px_1fr] overflow-hidden bg-cream lg:grid-cols-[232px_1fr] lg:grid-rows-1">
      {/* Topbar — mobile uniquement */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#1a1a1a] px-4 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="-ml-1 flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Menu className="size-6" strokeWidth={1.8} />
        </button>
        <span className="font-heading text-[15px] font-extrabold">Administration</span>
      </header>

      {/* Sidebar : tiroir off-canvas en mobile, statique en desktop */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 w-[232px] max-w-[82vw]",
          "transition-transform duration-300 ease-out",
          "lg:static lg:z-auto lg:w-auto lg:max-w-none lg:!translate-x-0 lg:!transform-none lg:!transition-none",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        ].join(" ")}
      >
        <AdminSidebar email={email} feedbackOpen={feedbackOpen} moderationPending={moderationPending} />
      </div>

      {/* Voile de fond — mobile uniquement */}
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <main className="min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
