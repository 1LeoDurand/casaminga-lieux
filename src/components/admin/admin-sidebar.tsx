"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, MessageSquareWarning, BookOpen, Mail, Landmark, ArrowLeft, FlaskConical, Activity, HeartPulse, ShieldCheck, Receipt, LogIn, KanbanSquare, KeyRound, Globe2 } from "lucide-react";
import { getAdminPlatformMeta, type AdminPlatform } from "@/lib/admin/platforms";
import type { RoadmapPlatform } from "@/lib/admin/roadmap-meta";
import { PlatformSelector } from "./platform-selector";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/admin/roadmap", label: "Feuille de route", icon: KanbanSquare, exact: false },
  { href: "/admin/organisations", label: "Organisations", icon: Building2, exact: false },
  { href: "/admin/portail", label: "Portail public", icon: Globe2, exact: false },
  { href: "/admin/moderation", label: "Modération", icon: ShieldCheck, exact: false },
  { href: "/admin/revendications", label: "Revendications", icon: KeyRound, exact: false },
  { href: "/admin/engagement", label: "Engagement", icon: Activity, exact: false },
  { href: "/admin/connexions", label: "Connexions", icon: LogIn, exact: false },
  { href: "/admin/sante", label: "Santé technique", icon: HeartPulse, exact: false },
  { href: "/admin/demos", label: "Démos", icon: FlaskConical, exact: false },
  { href: "/admin/feedback", label: "Feedback & bugs", icon: MessageSquareWarning, exact: false },
  { href: "/admin/facturation", label: "Facturation", icon: Receipt, exact: false },
  { href: "/admin/emails", label: "Emails envoyés", icon: Mail, exact: false },
  { href: "/admin/subventions-veille", label: "Veille subventions", icon: Landmark, exact: false },
  { href: "/admin/aide", label: "Centre d'aide", icon: BookOpen, exact: false },
];

// Ces trois pages lisent le contexte de plateforme (prompt 6) : leurs liens
// portent `?plateforme=` pour que la navigation ne le perde pas. Les autres
// pages de /admin sont par nature celles de l'admin, elles ne changent pas.
const PLATFORM_AWARE_HREFS = new Set(["/admin/feedback", "/admin/roadmap", "/admin/aide"]);

export function AdminSidebar({
  email,
  feedbackByPlatform,
  moderationPending = 0,
  claimsPending = 0,
  platform,
  onChangePlatform,
}: {
  email: string;
  feedbackByPlatform: Record<RoadmapPlatform, number>;
  moderationPending?: number;
  claimsPending?: number;
  platform: AdminPlatform;
  onChangePlatform: (id: AdminPlatform) => void;
}) {
  const pathname = usePathname();
  const platformColor = getAdminPlatformMeta(platform).color;

  // Badge "Feedback & bugs" : le compte de la plateforme courante ("all" =
  // le total, il n'y a alors rien "ailleurs") + un petit compte gris pour le
  // reste, sans relancer de requête (une seule, groupée, dans le layout).
  const feedbackEntries = Object.entries(feedbackByPlatform) as [RoadmapPlatform, number][];
  const feedbackTotal = feedbackEntries.reduce((sum, [, n]) => sum + n, 0);
  const feedbackHere = platform === "all" ? feedbackTotal : feedbackByPlatform[platform] ?? 0;
  const feedbackElsewhere = platform === "all" ? 0 : feedbackTotal - feedbackHere;

  return (
    <aside
      className="flex h-full w-[232px] shrink-0 flex-col overflow-y-auto bg-[#1a1a1a] text-white/90 border-r-[3px]"
      style={{ borderRightColor: platformColor }}
    >
      {/* En-tête */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-5 pb-4 pt-5">
        <img src="/logo-icon.webp" alt="Casa Minga" className="size-[34px] shrink-0 rounded-lg bg-white object-contain p-0.5" />
        <div className="min-w-0">
          <div className="truncate font-heading text-[15px] font-extrabold text-white">Administration</div>
          <div className="truncate text-[10px] text-white/40">Plateforme Casa Minga</div>
        </div>
      </div>

      {/* Contexte de travail */}
      <PlatformSelector platform={platform} onChange={onChangePlatform} />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const isFeedback = item.href === "/admin/feedback";
          const badge =
            isFeedback && feedbackHere > 0 ? feedbackHere
            : item.href === "/admin/moderation" && moderationPending > 0 ? moderationPending
            : item.href === "/admin/revendications" && claimsPending > 0 ? claimsPending
            : 0;
          const href = PLATFORM_AWARE_HREFS.has(item.href)
            ? `${item.href}?plateforme=${encodeURIComponent(platform)}`
            : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                active ? "bg-coral text-white" : "text-white/70 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
              <span className="flex-1 truncate">{item.label}</span>
              {badge > 0 && (
                <span className="shrink-0 rounded-full bg-coral px-1.5 py-px text-[10px] font-bold text-white">
                  {badge}
                </span>
              )}
              {isFeedback && feedbackElsewhere > 0 && (
                <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-px text-[10px] font-semibold text-white/60">
                  +{feedbackElsewhere} ailleurs
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pied */}
      <div className="mt-auto shrink-0 border-t border-white/10 px-3 py-3">
        <Link
          href="/login"
          className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white/80"
        >
          <ArrowLeft className="size-3.5" /> Quitter l&apos;admin
        </Link>
        <div className="rounded-lg bg-white/[0.05] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-white/35">Super-admin</div>
          <div className="truncate text-[12px] font-medium text-white/80">{email}</div>
        </div>
      </div>
    </aside>
  );
}
