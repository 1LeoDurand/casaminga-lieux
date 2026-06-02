"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
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
  Handshake,
  Palette,
  Globe,
  Megaphone,
  Image as ImageIcon,
  Zap,
  UsersRound,
  Settings,
  Lock,
  ChevronDown,
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
}: {
  orgSlug: string;
  m: ModuleDef;
  badge?: number;
}) {
  const pathname = usePathname();
  const href = hrefFor(orgSlug, m);
  const active = pathname === href;
  const Icon = ICONS[m.key] ?? LayoutDashboard;

  const inner = (
    <>
      <span className="mc-nav-icon">
        <Icon className="size-[17px]" strokeWidth={1.7} />
      </span>
      <span className="truncate">{m.label}</span>
      {badge ? <span className="mc-nav-badge danger">{badge}</span> : null}
    </>
  );

  if (!m.ready) {
    return (
      <button
        type="button"
        className="mc-nav-item w-[calc(100%-16px)]"
        onClick={() =>
          toast.info(`Module « ${m.label} » — bientôt disponible`, {
            description: "Il sera branché à Supabase dans une prochaine version.",
          })
        }
      >
        {inner}
      </button>
    );
  }

  return (
    <Link href={href} className={`mc-nav-item ${active ? "active" : ""}`}>
      {inner}
    </Link>
  );
}

/** Groupe repliable (accordéon) : clic sur l'en-tête → déplie/replie. */
function SectionGroup({
  section,
  orgSlug,
  open,
  onToggle,
  openRequests,
}: {
  section: ModuleSection;
  orgSlug: string;
  open: boolean;
  onToggle: () => void;
  openRequests: number;
}) {
  // Badge agrégé remonté sur l'en-tête quand le groupe est replié
  const groupBadge =
    !open && openRequests > 0 && section.modules.some((m) => m.key === "demandes")
      ? openRequests
      : 0;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 transition-colors hover:text-white/55"
      >
        <span className="flex-1 text-left">{section.title}</span>
        {groupBadge > 0 && <span className="mc-nav-badge danger !static">{groupBadge}</span>}
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          strokeWidth={2.2}
        />
      </button>

      {/* Conteneur animé (max-height) */}
      <div
        className="overflow-hidden transition-[max-height] duration-200 ease-out"
        style={{ maxHeight: open ? "500px" : "0px" }}
      >
        {section.modules.map((m) => (
          <NavItem
            key={m.key}
            orgSlug={orgSlug}
            m={m}
            badge={m.key === "demandes" && openRequests > 0 ? openRequests : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSidebar({
  orgSlug,
  orgName,
  openRequests = 0,
  userName = "Léo",
  userRole = "Coordination",
}: {
  orgSlug: string;
  orgName: string;
  openRequests?: number;
  userName?: string;
  userRole?: string;
}) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
    <aside className="flex h-full w-[232px] shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-sidebar text-sidebar-foreground">
      {/* Logo + organisation */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-5 pb-4 pt-5">
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-coral font-heading text-[12px] font-extrabold text-white">
          CM
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-heading text-[15px] font-extrabold text-white">
              {orgName}
            </span>
            <span
              className="shrink-0 rounded-md bg-coral px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
              title="Mode démo : données d'exemple. Connectez Supabase dans les paramètres pour passer en production."
            >
              Démo
            </span>
          </div>
          <div className="truncate text-[10px] text-white/35">
            Casa Minga Lieux · /{orgSlug}
          </div>
        </div>
      </div>

      {/* Navigation — groupes repliables (accordéon) */}
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
          />
        ))}
      </nav>

      {/* Pied : utilisateur */}
      <div className="mt-auto shrink-0 border-t border-white/[0.07] px-3 py-4">
        <div className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-white/[0.07]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[14px] bg-coral text-[12px] font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-white">{userName}</div>
            <div className="text-[11px] text-white/35">{userRole}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
