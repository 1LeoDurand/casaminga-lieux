"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

/**
 * Coquille du dashboard — pilote la mise en page responsive et l'état du menu.
 *
 *  - Desktop (≥ lg) : sidebar dans la grille, repliable en mode icônes
 *    (largeur 232 px ↔ 72 px), persistée en localStorage.
 *  - Mobile (< lg)  : sidebar en tiroir hors-écran (off-canvas) ouvert par
 *    le hamburger de la topbar, avec voile de fond et verrou de scroll.
 *
 * La sidebar et la topbar consomment `useSidebar()` pour lire/agir sur l'état.
 */

interface SidebarState {
  collapsed: boolean;      // mode icônes (desktop)
  mobileOpen: boolean;     // tiroir ouvert (mobile)
  toggleCollapsed: () => void;
  openMobile: () => void;
  closeMobile: () => void;
}

const SidebarCtx = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error("useSidebar doit être utilisé dans <DashboardShell>");
  return ctx;
}

const LS_KEY = "cm-sidebar-collapsed";

export function DashboardShell({
  sidebar,
  topbar,
  children,
  mobileTabBar,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
  mobileTabBar?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Hydrater l'état replié depuis localStorage (après montage → pas de flash SSR)
  useEffect(() => {
    setCollapsed(localStorage.getItem(LS_KEY) === "1");
  }, []);

  // Fermer le tiroir mobile à chaque navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Verrouiller le scroll du body quand le tiroir mobile est ouvert
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(LS_KEY, next ? "1" : "0"); } catch { /* quota / privé */ }
      return next;
    });
  }, []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <SidebarCtx.Provider value={{ collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile }}>
      <div
        className="grid h-[100dvh] grid-cols-1 grid-rows-[56px_1fr] overflow-hidden lg:grid-cols-[var(--cm-sb)_minmax(0,1fr)]"
        style={{ "--cm-sb": collapsed ? "88px" : "300px" } as React.CSSProperties}
      >
        {/* Sidebar : tiroir off-canvas en mobile, rail+panneau en desktop */}
        <div
          className={[
            "fixed inset-y-0 left-0 z-50 w-[300px] max-w-[88vw]",
            "transition-transform duration-300 ease-out",
            "lg:static lg:z-auto lg:row-span-2 lg:w-auto lg:max-w-none lg:!translate-x-0 lg:!transform-none lg:!transition-none",
            mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          ].join(" ")}
        >
          {sidebar}
        </div>

        {/* Voile de fond — mobile uniquement */}
        {mobileOpen && (
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={closeMobile}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
        )}

        {topbar}

        <main className="min-w-0 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-7 max-lg:!pb-[88px]">{children}</main>
      </div>

      {/* Barre d'onglets — mobile uniquement (hors tiroir off-canvas) */}
      {mobileTabBar}
    </SidebarCtx.Provider>
  );
}
