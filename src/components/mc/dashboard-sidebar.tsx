"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react";
import { signOutAction } from "@/app/(admin)/actions";
import {
  MODULE_SECTIONS,
  type ModuleDef,
  type ModuleSection,
  type OrgTier,
} from "@/lib/modules";
import { useSidebar } from "@/components/mc/dashboard-shell";
import {
  Gauge, Building2, PieChart, Folder, Megaphone, Settings,
  LayoutDashboard, Inbox, Users, ListChecks, MapPin, Home, CalendarDays, Package,
  Receipt, TrendingDown, Landmark, HandHeart, ShieldCheck, FileSignature, FileText,
  Scale, Sprout, Globe, AtSign, Send, Zap, UserCog, SlidersHorizontal,
  ChevronsLeft, ChevronsRight, ChevronRight, ArrowLeft, X, Menu,
  Lock, Sparkles, LogOut,
  type LucideIcon,
} from "lucide-react";

// ── Couleurs (handoff) ───────────────────────────────────────────────────────
const RAIL_BG = "#222323";
const PANEL_BG = "#2C2D2D";

const SECTION_ICONS: Record<string, LucideIcon> = {
  pilotage: Gauge,
  lieu: Building2,
  finances: PieChart,
  admin: Folder,
  comm: Megaphone,
  systeme: Settings,
};

const ITEM_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, demandes: Inbox, personnes: Users, taches: ListChecks,
  espaces: MapPin, residences: Home, evenements: CalendarDays, inventaire: Package,
  finances: PieChart, factures: Receipt, depenses: TrendingDown, subventions: Landmark,
  dons: HandHeart, caisse: ShieldCheck,
  adhesions: FileSignature, contrats: FileText, documents: FileText, gouvernance: Scale, impact: Sprout,
  "site-public": Globe, domaine: AtSign, communication: Send,
  automatisations: Zap, equipe: UserCog, parametres: SlidersHorizontal,
};

const TIER_ORDER: OrgTier[] = ["free", "complete", "multilieu"];

interface SectionItem { m: ModuleDef; locked: boolean; }

/** Items visibles d'une section : actifs (socle ou activés) + gatés (cadenas). */
function itemsForSection(section: ModuleSection, enabled: Set<string>, tier: OrgTier): SectionItem[] {
  const out: SectionItem[] = [];
  for (const m of section.modules) {
    const isEnabled = m.layer === 0 || enabled.has(m.key);
    if (isEnabled) { out.push({ m, locked: false }); continue; }
    const gated = !!m.minTier && TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(m.minTier);
    if (gated) out.push({ m, locked: true });
  }
  return out;
}

function hrefFor(orgSlug: string, m: ModuleDef): string {
  return m.segment ? `/dashboard/${orgSlug}/${m.segment}` : `/dashboard/${orgSlug}`;
}
function activeSegment(pathname: string): string | null {
  const p = pathname.split("/").filter(Boolean); // ['dashboard', org, segment?]
  return p.length >= 3 ? p[2] : null;
}
function sectionKeyForSegment(seg: string | null): string {
  for (const s of MODULE_SECTIONS) if (s.modules.some((m) => m.segment === seg)) return s.key;
  return MODULE_SECTIONS[0].key;
}

// ── Item de navigation (panneau, flyout, tiroir mobile) ──────────────────────
function ItemRow({
  orgSlug, item, openRequests, onNavigate, mobile = false,
}: {
  orgSlug: string;
  item: SectionItem;
  openRequests: number;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const { m, locked } = item;
  const Icon = ITEM_ICONS[m.key] ?? LayoutDashboard;
  const href = locked ? `/dashboard/${orgSlug}/modules` : hrefFor(orgSlug, m);
  const active = !locked && pathname === hrefFor(orgSlug, m);
  const badge = m.key === "demandes" && openRequests > 0 ? openRequests : 0;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={locked ? "Module Asso complète — passer à l'offre supérieure" : m.label}
      className={`mc-nav-item ${active ? "active" : ""} ${locked ? "opacity-50 hover:opacity-75" : ""} ${mobile ? "!gap-3 !rounded-xl !px-3 !py-3 !text-[14px]" : ""}`}
    >
      <span className="mc-nav-icon">
        {locked ? <Lock className="size-[14px]" strokeWidth={1.9} /> : <Icon className={mobile ? "size-[19px]" : "size-[17px]"} strokeWidth={1.7} />}
      </span>
      <span className="flex-1 truncate">{m.label}</span>
      {badge ? <span className="mc-nav-badge danger">{badge}</span> : null}
      {locked && <Sparkles className="ml-auto size-3 shrink-0 text-amber-400/70" />}
    </Link>
  );
}

// ── Bouton de section dans le rail ───────────────────────────────────────────
function RailButton({
  section, current, open, onClick,
}: {
  section: ModuleSection;
  current: boolean;
  open: boolean;
  onClick: () => void;
}) {
  const Icon = SECTION_ICONS[section.key] ?? Gauge;
  const bg = current ? "var(--coral)" : open ? "rgba(255,255,255,0.09)" : "transparent";
  const color = current ? "#2C2D2D" : open ? "#fff" : "rgba(255,255,255,0.55)";

  return (
    <button
      type="button"
      onClick={onClick}
      title={section.title}
      aria-current={current ? "page" : undefined}
      className="relative flex w-full cursor-pointer flex-col items-center gap-[5px] rounded-[13px] px-0.5 py-2.5 transition-colors"
      style={{ background: bg, color, boxShadow: current ? "0 4px 12px -4px rgba(255,138,101,0.6)" : "none" }}
    >
      {current && (
        <span className="absolute left-0 top-[18%] h-[64%] w-[3px] rounded-r-[3px]" style={{ background: "var(--coral)" }} />
      )}
      <Icon className="size-[21px]" strokeWidth={1.75} />
      <span className="max-w-[72px] truncate text-[9px] font-semibold leading-[1.05]">{section.shortLabel}</span>
    </button>
  );
}

// ── Menu utilisateur (avatar en bas du rail) ─────────────────────────────────
function RailUserMenu({ orgSlug, initials, userName }: { orgSlug: string; initials: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative flex shrink-0 justify-center border-t border-white/[0.07] py-3.5">
      {open && (
        <div className="fixed bottom-[62px] left-3 z-[70] w-52 overflow-hidden rounded-xl border border-white/10 bg-[#1e1e22] shadow-xl">
          <Link
            href={`/dashboard/${orgSlug}/compte`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <UserCog className="size-4 shrink-0" /> Mon compte
          </Link>
          <Link
            href={`/dashboard/${orgSlug}/parametres`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Settings className="size-4 shrink-0" /> Paramètres du lieu
          </Link>
          <div className="mx-3 border-t border-white/[0.07]" />
          <form action={signOutAction}>
            <button type="submit" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 transition-colors hover:bg-white/[0.07] hover:text-red-300">
              <LogOut className="size-4 shrink-0" /> Se déconnecter
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={userName}
        className="flex size-[33px] cursor-pointer items-center justify-center rounded-[11px] bg-coral text-[13px] font-bold text-white transition-transform hover:scale-105"
      >
        {initials}
      </button>
    </div>
  );
}

// ── Barre d'onglets mobile (favoris) ─────────────────────────────────────────
export function DashboardMobileTabBar({ orgSlug, openRequests = 0 }: { orgSlug: string; openRequests?: number }) {
  const pathname = usePathname();
  const { openMobile } = useSidebar();

  const tabs = [
    { key: "dashboard", label: "Tableau", icon: LayoutDashboard, href: `/dashboard/${orgSlug}`, badge: 0 },
    { key: "demandes", label: "Demandes", icon: Inbox, href: `/dashboard/${orgSlug}/demandes`, badge: openRequests },
    { key: "personnes", label: "Personnes", icon: Users, href: `/dashboard/${orgSlug}/personnes`, badge: 0 },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex lg:hidden"
      style={{ background: PANEL_BG, padding: "10px 6px max(18px, env(safe-area-inset-bottom))" }}
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={t.href}
            className="relative flex flex-1 flex-col items-center gap-1"
            style={{ color: active ? "var(--coral)" : "rgba(255,255,255,0.6)" }}
          >
            <Icon className="size-[22px]" strokeWidth={1.75} />
            <span className="text-[9.5px] font-semibold">{t.label}</span>
            {t.badge > 0 && (
              <span className="absolute right-[20%] top-[-3px] flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={openMobile}
        className="flex flex-1 flex-col items-center gap-1"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        <Menu className="size-[22px]" strokeWidth={1.75} />
        <span className="text-[9.5px] font-semibold">Menu</span>
      </button>
    </nav>
  );
}

// ── Sidebar principale ───────────────────────────────────────────────────────
export function DashboardSidebar({
  orgSlug,
  orgName,
  openRequests = 0,
  userName = "Léo",
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
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar();
  const pathname = usePathname();

  const initials = userName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  // Sections non vides + leurs items (mémoïsé)
  const sections = useMemo(
    () =>
      MODULE_SECTIONS.map((s) => ({ section: s, items: itemsForSection(s, enabledModules, orgTier) }))
        .filter((x) => x.items.length > 0),
    [enabledModules, orgTier],
  );
  const itemsByKey = useMemo(() => {
    const m = new Map<string, SectionItem[]>();
    for (const x of sections) m.set(x.section.key, x.items);
    return m;
  }, [sections]);

  const activeSectionKey = useMemo(() => sectionKeyForSegment(activeSegment(pathname)), [pathname]);

  // État local
  const [pinned, setPinned] = useState(activeSectionKey);
  const [flyout, setFlyout] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sections" | "detail">("sections");
  const [mobileSection, setMobileSection] = useState<string | null>(null);

  // La section de l'écran actif pilote le panneau ; on referme le flyout à la navigation.
  useEffect(() => { setPinned(activeSectionKey); setFlyout(null); }, [activeSectionKey]);
  // Réinitialise le tiroir mobile à sa fermeture.
  useEffect(() => { if (!mobileOpen) { setMobileView("sections"); setMobileSection(null); } }, [mobileOpen]);

  // Fermer le flyout au clic extérieur
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!flyout) return;
    function h(e: MouseEvent) { if (asideRef.current && !asideRef.current.contains(e.target as Node)) setFlyout(null); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [flyout]);

  const pinnedSection = sections.find((x) => x.section.key === pinned) ?? sections[0];
  const flyoutSection = flyout ? sections.find((x) => x.section.key === flyout) : null;
  const mobileDetailSection = mobileSection ? sections.find((x) => x.section.key === mobileSection) : null;

  function onRailClick(key: string) {
    if (collapsed) setFlyout((f) => (f === key ? null : key));
    else setPinned(key);
  }

  const railNav = (
    <>
      {/* Logo */}
      <div className="flex shrink-0 items-center justify-center border-b border-white/[0.07] px-0 pb-3.5 pt-[18px]">
        <img src="/logo-icon.webp" alt={orgName} className="size-9 rounded-[10px] bg-white object-contain p-0.5" width={36} height={36} loading="eager" />
      </div>
      {/* Sections */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-[7px] py-2.5">
        {sections.map(({ section }) => (
          <RailButton
            key={section.key}
            section={section}
            current={section.key === activeSectionKey}
            open={collapsed ? section.key === flyout : section.key === pinned}
            onClick={() => onRailClick(section.key)}
          />
        ))}
      </nav>
      {/* Toggle */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? "Déployer le panneau" : "Réduire le panneau"}
        aria-label={collapsed ? "Déployer le panneau" : "Réduire le panneau"}
        className="flex shrink-0 cursor-pointer items-center justify-center border-t border-white/[0.08] py-3.5 text-white/50 transition-colors hover:text-white/80"
      >
        {collapsed
          ? <ChevronsRight className="size-[19px]" strokeWidth={1.8} />
          : <ChevronsLeft className="size-[19px]" strokeWidth={1.8} />
        }
      </button>
      {/* Avatar */}
      <RailUserMenu orgSlug={orgSlug} initials={initials} userName={userName} />
    </>
  );

  const panelHeader = (title: string, count: number, withCollapse: boolean) => (
    <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 pb-3 pt-5">
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-coral">{title}</div>
        <div className="mt-[3px] text-[11px] text-white/40">{count} écran{count > 1 ? "s" : ""}</div>
      </div>
      {withCollapse && (
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Réduire le panneau"
          aria-label="Réduire le panneau"
          className="flex size-[26px] cursor-pointer items-center justify-center rounded-lg bg-white/[0.06] text-white/50 transition-colors hover:text-white"
        >
          <ChevronsLeft className="size-4" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* ══ DESKTOP : rail + panneau (+ flyout) ══ */}
      <aside ref={asideRef} className="hidden h-full lg:flex">
        {/* Rail */}
        <div className="flex w-[88px] shrink-0 flex-col overflow-hidden" style={{ background: RAIL_BG }}>
          {railNav}
        </div>

        {/* Panneau épinglé (déployé) */}
        {!collapsed && pinnedSection && (
          <div className="flex w-[212px] shrink-0 flex-col overflow-hidden border-r border-white/[0.06]" style={{ background: PANEL_BG }}>
            {panelHeader(pinnedSection.section.title, pinnedSection.items.length, true)}
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
              {pinnedSection.items.map((it) => (
                <ItemRow key={it.m.key} orgSlug={orgSlug} item={it} openRequests={openRequests} />
              ))}
            </nav>
          </div>
        )}

        {/* Flyout flottant (replié + section ouverte) */}
        {collapsed && flyoutSection && (
          <div
            className="fixed left-[88px] top-[60px] z-[80] flex max-h-[480px] w-[214px] flex-col overflow-hidden rounded-r-2xl border border-l-0 border-white/10"
            style={{ background: PANEL_BG, boxShadow: "0 24px 50px -12px rgba(0,0,0,0.55)" }}
          >
            <div className="border-b border-white/[0.07] px-4 pb-3 pt-4 text-[10.5px] font-bold uppercase tracking-[0.12em] text-coral">
              {flyoutSection.section.title}
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
              {flyoutSection.items.map((it) => (
                <ItemRow key={it.m.key} orgSlug={orgSlug} item={it} openRequests={openRequests} onNavigate={() => setFlyout(null)} />
              ))}
            </nav>
          </div>
        )}
      </aside>

      {/* ══ MOBILE : tiroir 2 niveaux ══ */}
      <div className="flex h-full w-full flex-col overflow-hidden lg:hidden" style={{ background: PANEL_BG }}>
        {mobileView === "sections" ? (
          <>
            {/* En-tête */}
            <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
              <img src="/logo-icon.webp" alt={orgName} className="size-[34px] shrink-0 rounded-[10px] bg-white object-contain p-0.5" width={34} height={34} loading="eager" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-heading text-[14px] font-extrabold text-white">{orgName}</span>
                  {isDemo && <span className="shrink-0 rounded bg-coral px-1.5 py-px text-[9px] font-bold uppercase text-white">Démo</span>}
                </div>
                <div className="truncate text-[10px] text-white/40">Casa Minga · /{orgSlug}</div>
              </div>
              <button type="button" onClick={closeMobile} aria-label="Fermer" className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {/* Favoris */}
              <div className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Favoris</div>
              {(itemsByKey.get("pilotage") ?? []).slice(0, 3).map((it) => (
                <ItemRow key={it.m.key} orgSlug={orgSlug} item={it} openRequests={openRequests} onNavigate={closeMobile} mobile />
              ))}
              <div className="mx-2 my-2.5 border-t border-white/[0.08]" />
              {/* Sections */}
              <div className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Sections</div>
              {sections.map(({ section, items }) => {
                const Icon = SECTION_ICONS[section.key] ?? Gauge;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => { setMobileSection(section.key); setMobileView("detail"); }}
                    className="mb-1.5 flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-3 text-left text-white/85 transition-colors hover:bg-white/[0.08]"
                  >
                    <Icon className="size-[19px] shrink-0 text-white/70" strokeWidth={1.7} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold">{section.title}</div>
                      <div className="text-[10.5px] text-white/35">{items.length} écran{items.length > 1 ? "s" : ""}</div>
                    </div>
                    <ChevronRight className="size-[18px] shrink-0 text-white/35" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Détail d'une section */}
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 pb-3.5 pt-4">
              <button type="button" onClick={() => setMobileView("sections")} aria-label="Retour" className="flex size-9 items-center justify-center rounded-[10px] bg-white/[0.07] text-white">
                <ArrowLeft className="size-[19px]" />
              </button>
              <div className="font-heading text-[17px] font-bold text-white">{mobileDetailSection?.section.title}</div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {(mobileDetailSection?.items ?? []).map((it) => (
                <ItemRow key={it.m.key} orgSlug={orgSlug} item={it} openRequests={openRequests} onNavigate={closeMobile} mobile />
              ))}
            </nav>
          </>
        )}
      </div>
    </>
  );
}
