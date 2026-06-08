"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, MessageSquareWarning, BookOpen, Mail, Landmark, ArrowLeft, FlaskConical, Activity, HeartPulse, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/admin/organisations", label: "Organisations", icon: Building2, exact: false },
  { href: "/admin/moderation", label: "Modération", icon: ShieldCheck, exact: false },
  { href: "/admin/engagement", label: "Engagement", icon: Activity, exact: false },
  { href: "/admin/sante", label: "Santé technique", icon: HeartPulse, exact: false },
  { href: "/admin/demos", label: "Démos", icon: FlaskConical, exact: false },
  { href: "/admin/feedback", label: "Feedback & bugs", icon: MessageSquareWarning, exact: false },
  { href: "/admin/emails", label: "Emails envoyés", icon: Mail, exact: false },
  { href: "/admin/subventions-veille", label: "Veille subventions", icon: Landmark, exact: false },
  { href: "/admin/aide", label: "Centre d'aide", icon: BookOpen, exact: false },
];

export function AdminSidebar({ email, feedbackOpen = 0, moderationPending = 0 }: { email: string; feedbackOpen?: number; moderationPending?: number }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col overflow-y-auto bg-[#1a1a1a] text-white/90">
      {/* En-tête */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-5 pb-4 pt-5">
        <img src="/logo.png" alt="Casa Minga" className="size-[34px] shrink-0 rounded-lg bg-white object-contain p-0.5" />
        <div className="min-w-0">
          <div className="truncate font-heading text-[15px] font-extrabold text-white">Administration</div>
          <div className="truncate text-[10px] text-white/40">Plateforme Casa Minga</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const badge =
            item.href === "/admin/feedback" && feedbackOpen > 0 ? feedbackOpen
            : item.href === "/admin/moderation" && moderationPending > 0 ? moderationPending
            : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
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
