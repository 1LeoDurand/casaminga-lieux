"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Settings,
  type LucideIcon,
} from "lucide-react";
import { MODULE_SECTIONS, type ModuleDef } from "@/lib/modules";

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
  documents: FileText,
  gouvernance: Scale,
  impact: BarChart3,
  partenaires: Handshake,
  "site-public": Globe,
  communication: Megaphone,
  mediatheque: ImageIcon,
  automatisations: Zap,
  parametres: Settings,
};

function hrefFor(orgSlug: string, m: ModuleDef) {
  return m.segment ? `/dashboard/${orgSlug}/${m.segment}` : `/dashboard/${orgSlug}`;
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

      {/* Navigation */}
      <nav className="flex-1 py-1">
        {MODULE_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/25">
              {section.title}
            </div>
            {section.modules.map((m) => (
              <NavItem
                key={m.key}
                orgSlug={orgSlug}
                m={m}
                badge={m.key === "demandes" && openRequests > 0 ? openRequests : undefined}
              />
            ))}
          </div>
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
