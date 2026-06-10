"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { signOutAction } from "@/app/(admin)/actions";
import type { OrgTier } from "@/lib/modules";
import {
  LayoutDashboard,
  Inbox,
  Users,
  ListChecks,
  HeartHandshake,
  DoorOpen,
  CalendarCheck,
  Home,
  CalendarDays,
  Wallet,
  FileText,
  Scale,
  BarChart3,
  Landmark,
  ReceiptText,
  Handshake,
  Palette,
  Globe,
  Megaphone,
  Image as ImageIcon,
  Zap,
  UsersRound,
  Settings,
  Lock,
  LayoutGrid,
  ChevronDown,
  Plus,
  TrendingDown,
  Sparkles,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { MODULE_SECTIONS, type ModuleDef, type ModuleSection } from "@/lib/modules";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  demandes: Inbox,
  personnes: Users,
  taches: ListChecks,
  communaute: HeartHandshake,
  espaces: DoorOpen,
  reservations: CalendarCheck,
  residences: Home,
  artistes: Palette,
  evenements: CalendarDays,
  finances: Wallet,
  factures: ReceiptText,
  depenses: TrendingDown,
  subventions: Landmark,
  caisse: Lock,
  documents: FileText,
  gouvernance: Scale,
  impact: BarChart3,
  partenaires: Handshake,
  "site-public": Globe,
  communication: Megaphone,
  mediatheque: ImageIcon,
  automatisations: Zap,
  equipe: UsersRound,
  parametres: Settings,
  modules: LayoutGrid,
};

function hrefFor(orgSlug: string, m: ModuleDef) {
  return m.segment ? `/dashboard/${orgSlug}/${m.segment}` : `/dashboard/${orgSlug}`;
}

/** Segment actif déduit du chemin : /dashboard/{org}/{segment?} */
function activeSegmentFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean); // ['dashboard', org, segment?]
  return parts.length >= 3 ? parts[2] : null;
}

/** Titre de la section contenant le segment actif (défaut : 1re section). */
function sectionTitleForSegment(segment: string | null): string {
  for (const s of MODULE_SECTIONS) {
    if (s.modules.some((m) => m.segment === segment)) return s.title;
  }
  return MODULE_SECTIONS[0].title; // racine /dashboard → Pilotage
}

function NavItem({
  orgSlug,
  m,
  badge,
  locked = false,
}: {
  orgSlug: string;
  m: ModuleDef;
  badge?: number;
  locked?: boolean;
}) {
  const pathname = usePathname();
  const href = locked ? `/dashboard/${orgSlug}/modules` : hrefFor(orgSlug, m);
  const active = !locked && pathname === hrefFor(orgSlug, m);
  const Icon = ICONS[m.key] ?? LayoutDashboard;

  return (
    <Link
      href={href}
      className={`mc-nav-item ${active ? "active" : ""} ${locked ? "opacity-50 hover:opacity-75" : ""}`}
      title={locked ? "Module Asso complète — passer à l'offre supérieure" : undefined}
    >
      <span className="mc-nav-icon">
        {locked ? <Lock className="size-[14px]" strokeWidth={1.9} /> : <Icon className="size-[17px]" strokeWidth={1.7} />}
      </span>
      <span className="truncate">{m.label}</span>
      {badge ? <span className="mc-nav-badge danger">{badge}</span> : null}
      {locked && <Sparkles className="ml-auto size-3 shrink-0 text-amber-400/70" />}
    </Link>
  );
}

/**
 * Groupe de navigation.
 * - `forceOpen=true` → tout ouvert, header non cliquable (mode compact ≤ 10 items)
 * - `forceOpen=false` → accordéon repliable (mode dense > 10 items)
 */
function SectionGroup({
  section,
  orgSlug,
  open,
  onToggle,
  openRequests,
  enabledModules,
  orgTier,
  forceOpen = false,
}: {
  section: ModuleSection;
  orgSlug: string;
  open: boolean;
  onToggle: () => void;
  openRequests: number;
  enabledModules: Set<string>;
  orgTier: OrgTier;
  forceOpen?: boolean;
}) {
  const TIER_ORDER: OrgTier[] = ["free", "complete", "multilieu"];
  const visibleModules = section.modules.filter(
    (m) => m.layer === 0 || enabledModules.has(m.key)
  );
  // Les modules gated sont visibles mais avec cadenas
  const gatedModules = section.modules.filter(
    (m) => m.minTier && TIER_ORDER.indexOf(orgTier) < TIER_ORDER.indexOf(m.minTier)
      && m.layer !== 0 && !enabledModules.has(m.key)
  );
  const allModules = [...visibleModules, ...gatedModules.filter(
    (g) => !visibleModules.find((v) => v.key === g.key)
  )];

  if (allModules.length === 0) return null;

  const isOpen = forceOpen || open;

  const groupBadge =
    !isOpen && openRequests > 0 && allModules.some((m) => m.key === "demandes")
      ? openRequests
      : 0;

  return (
    <div>
      {/* En-tête de section — cliquable seulement en mode accordéon */}
      {forceOpen ? (
        <div className="flex items-center gap-2 px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
          <span>{section.title}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-2 px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 transition-colors hover:text-white/55"
        >
          <span className="flex-1 text-left">{section.title}</span>
          {groupBadge > 0 && <span className="mc-nav-badge danger !static">{groupBadge}</span>}
          <ChevronDown
            className={`size-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
            strokeWidth={2.2}
          />
        </button>
      )}

      {/* Conteneur : toujours visible en mode flat, animé en mode accordéon */}
      <div
        className={forceOpen ? undefined : "overflow-hidden transition-[max-height] duration-200 ease-out"}
        style={forceOpen ? undefined : { maxHeight: isOpen ? "600px" : "0px" }}
      >
        {allModules.map((m) => {
          const isLocked = !!(m.minTier && TIER_ORDER.indexOf(orgTier) < TIER_ORDER.indexOf(m.minTier) && !visibleModules.find((v) => v.key === m.key));
          return (
            <NavItem
              key={m.key}
              orgSlug={orgSlug}
              m={m}
              badge={m.key === "demandes" && openRequests > 0 ? openRequests : undefined}
              locked={isLocked}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── UserMenu : avatar + dropdown déconnexion ─────────────────────────────────
function UserMenu({
  orgSlug,
  userName,
  userRole,
  initials,
}: {
  orgSlug: string;
  userName: string;
  userRole: string;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative mt-auto shrink-0 border-t border-white/[0.07] px-3 py-4">
      {/* Dropdown — s'ouvre vers le haut */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-white/10 bg-[#1e1e22] shadow-xl">
          <Link
            href={`/dashboard/${orgSlug}/parametres`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Settings className="size-4 shrink-0" />
            Paramètres du lieu
          </Link>
          <div className="mx-3 border-t border-white/[0.07]" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 transition-colors hover:bg-white/[0.07] hover:text-red-300"
            >
              <LogOut className="size-4 shrink-0" />
              Se déconnecter
            </button>
          </form>
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-white/[0.07]"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[14px] bg-coral text-[12px] font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-[13px] font-semibold text-white">{userName}</div>
          <div className="text-[11px] text-white/35">{userRole}</div>
        </div>
        <ChevronDown
          className={`size-3.5 shrink-0 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}

export function DashboardSidebar({
  orgSlug,
  orgName,
  openRequests = 0,
  userName = "Léo",
  userRole = "Coordination",
  isDemo = false,
  enabledModules = new Set<string>(),
  orgTier = "free",
}: {
  orgSlug: string;
  orgName: string;
  openRequests?: number;
  userName?: string;
  userRole?: string;
  isDemo?: boolean;
  enabledModules?: Set<string>;
  orgTier?: OrgTier;
}) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ── Comptage des items visibles (toutes sections) ──────────────────────────
  // ≤ 10 items → mode flat (tout ouvert, pas d'accordéon)
  // > 10 items → mode accordéon avec scroll
  const totalVisible = useMemo(
    () =>
      MODULE_SECTIONS.reduce(
        (sum, section) =>
          sum +
          section.modules.filter((m) => m.layer === 0 || enabledModules.has(m.key)).length,
        0
      ),
    [enabledModules]
  );
  const flatMode = totalVisible <= 10;

  // ── Accordéon : la section de la page active s'ouvre automatiquement ──
  const pathname = usePathname();
  const activeSection = useMemo(
    () => sectionTitleForSegment(activeSegmentFromPath(pathname)),
    [pathname],
  );
  const [openSection, setOpenSection] = useState<string | null>(activeSection);
  useEffect(() => {
    setOpenSection(activeSection);
  }, [activeSection]);

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col overflow-x-hidden bg-sidebar text-sidebar-foreground"
      style={{ overflowY: flatMode ? "visible" : "auto" }}
    >
      {/* Logo + organisation */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-5 pb-4 pt-5">
        <img src="/logo.png" alt="Casa Minga Lieux" className="size-[34px] shrink-0 rounded-lg object-contain bg-white p-0.5" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-heading text-[15px] font-extrabold text-white">
              {orgName}
            </span>
            {isDemo && (
              <span
                className="shrink-0 rounded-md bg-coral px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
                title="Mode démo : données d'exemple. Configurez Supabase pour passer en production."
              >
                Démo
              </span>
            )}
          </div>
          <div className="truncate text-[10px] text-white/35">
            Casa Minga Lieux · /{orgSlug}
          </div>
        </div>
      </div>

      {/* Navigation — flat si ≤ 10 items, accordéon sinon */}
      <nav className="flex-1 py-1">
        {MODULE_SECTIONS.map((section) => (
          <SectionGroup
            key={section.title}
            section={section}
            orgSlug={orgSlug}
            open={openSection === section.title}
            onToggle={() =>
              setOpenSection((cur) => (cur === section.title ? null : section.title))
            }
            openRequests={openRequests}
            enabledModules={enabledModules}
            orgTier={orgTier}
            forceOpen={flatMode}
          />
        ))}

        {/* ＋ Modules — accès à la gestion des modules actifs */}
        <div className="mt-2 border-t border-white/[0.07] px-3 pt-3">
          <Link
            href={`/dashboard/${orgSlug}/modules`}
            className="mc-nav-item text-white/40 hover:text-white/70"
          >
            <span className="mc-nav-icon">
              <Plus className="size-[15px]" strokeWidth={2} />
            </span>
            <span className="truncate text-[12px]">Modules</span>
          </Link>
        </div>
      </nav>

      {/* Encart upgrade masqué tant que la facturation Stripe n'est pas en place
          (décision sprint finition 10/06/2026 — réactiver avec Lot 10.1) */}

      {/* Pied : utilisateur */}
      <UserMenu
        orgSlug={orgSlug}
        userName={userName}
        userRole={userRole}
        initials={initials}
      />
    </aside>
  );
}
