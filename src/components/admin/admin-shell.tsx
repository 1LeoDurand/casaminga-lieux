"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { AdminSidebar } from "./admin-sidebar";
import { setAdminPlatform } from "@/app/admin/platform-actions";
import { getAdminPlatformMeta, isAdminPlatform, type AdminPlatform } from "@/lib/admin/platforms";

// Pages qui lisent le contexte de plateforme dans l'URL (prompt 6) : changer
// de plateforme dessus met `?plateforme=` à jour plutôt que de l'ajouter à
// une page qui l'ignorerait.
const PLATFORM_AWARE_PATHS = ["/admin/feedback", "/admin/roadmap", "/admin/aide"];

/**
 * Coquille responsive du super-admin /admin.
 *
 * Reprend le MÊME mécanisme que l'admin de base (`dashboard-shell.tsx`) :
 *  - Desktop (≥ lg) : sidebar statique dans la grille (232 px + contenu).
 *  - Mobile (< lg)  : topbar avec hamburger + sidebar en tiroir off-canvas,
 *    voile de fond et verrou de scroll. Le tiroir se ferme à chaque navigation.
 *
 * Contexte de plateforme : `initialPlatform` vient du cookie lu côté serveur
 * (layout.tsx, qui n'a pas accès à `?plateforme=` — les layouts App Router ne
 * reçoivent pas les searchParams). La query, quand elle est présente, prime
 * sur ce prop initial ; un changement via le sélecteur écrit tout de suite
 * dans l'état local (retour visuel immédiat, liseré compris), persiste le
 * cookie en arrière-plan, et ne touche l'URL que sur les pages qui le lisent.
 */
export function AdminShell({
  email,
  feedbackOpen = 0,
  moderationPending = 0,
  claimsPending = 0,
  initialPlatform,
  children,
}: {
  email: string;
  feedbackOpen?: number;
  moderationPending?: number;
  claimsPending?: number;
  initialPlatform: AdminPlatform;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [manualPlatform, setManualPlatform] = useState<AdminPlatform | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const fromQuery = searchParams.get("plateforme");
  const platform: AdminPlatform = isAdminPlatform(fromQuery) ? fromQuery : manualPlatform ?? initialPlatform;
  const platformColor = getAdminPlatformMeta(platform).color;

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

  const handleChangePlatform = useCallback(
    (id: AdminPlatform) => {
      setManualPlatform(id);
      startTransition(() => {
        void setAdminPlatform(id);
      });
      if (PLATFORM_AWARE_PATHS.some((p) => pathname.startsWith(p))) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("plateforme", id);
        router.replace(`${pathname}?${params.toString()}`);
      }
    },
    [pathname, router, searchParams],
  );

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
        <AdminSidebar
          email={email}
          feedbackOpen={feedbackOpen}
          moderationPending={moderationPending}
          claimsPending={claimsPending}
          platform={platform}
          onChangePlatform={handleChangePlatform}
        />
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

      <main className="min-w-0 overflow-y-auto border-t-[3px] p-4 sm:p-6 lg:p-8" style={{ borderTopColor: platformColor }}>
        {children}
      </main>
    </div>
  );
}
