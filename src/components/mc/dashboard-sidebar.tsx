"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Users,
  DoorOpen,
  CalendarCheck,
  Palette,
  CalendarDays,
  Wallet,
  FileText,
  Handshake,
  ListChecks,
  Globe,
  Megaphone,
  Image as ImageIcon,
  BarChart3,
  Scale,
  Zap,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { MODULE_SECTIONS, SETTINGS_MODULE, type ModuleDef } from "@/lib/modules";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  demandes: Inbox,
  personnes: Users,
  espaces: DoorOpen,
  reservations: CalendarCheck,
  residences: Palette,
  evenements: CalendarDays,
  finances: Wallet,
  documents: FileText,
  partenaires: Handshake,
  taches: ListChecks,
  "site-public": Globe,
  communication: Megaphone,
  mediatheque: ImageIcon,
  impact: BarChart3,
  gouvernance: Scale,
  automatisations: Zap,
  parametres: Settings,
};

function hrefFor(orgSlug: string, m: ModuleDef) {
  return m.segment ? `/dashboard/${orgSlug}/${m.segment}` : `/dashboard/${orgSlug}`;
}

function NavItem({ orgSlug, m }: { orgSlug: string; m: ModuleDef }) {
  const pathname = usePathname();
  const href = hrefFor(orgSlug, m);
  const active = pathname === href;
  const Icon = ICONS[m.key] ?? LayoutDashboard;

  const base =
    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors";

  if (!m.ready) {
    return (
      <span
        title="À venir"
        className={`${base} cursor-default text-sidebar-foreground/35`}
      >
        <Icon className="size-[18px] shrink-0" />
        <span className="truncate">{m.label}</span>
        <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
          bientôt
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} ${
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      }`}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="truncate">{m.label}</span>
    </Link>
  );
}

export function DashboardSidebar({
  orgSlug,
  orgName,
}: {
  orgSlug: string;
  orgName: string;
}) {
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-coral font-heading text-sm font-extrabold text-white">
          CM
        </span>
        <div className="min-w-0">
          <div className="font-heading text-[15px] font-extrabold leading-tight">
            Casa Minga Lieux
          </div>
          <div className="truncate text-[10px] text-sidebar-foreground/45">{orgName}</div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3">
        {MODULE_SECTIONS.map((section) => (
          <div key={section.title} className="mb-1">
            <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
              {section.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.modules.map((m) => (
                <NavItem key={m.key} orgSlug={orgSlug} m={m} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-2 py-3">
        <NavItem orgSlug={orgSlug} m={SETTINGS_MODULE} />
        <div className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-coral text-xs font-bold text-white">
            LÉ
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">Léo</div>
            <div className="text-[11px] text-sidebar-foreground/40">Coordination</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
