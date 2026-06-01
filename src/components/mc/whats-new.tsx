import { Sparkles, Landmark, Palette, UsersRound, Plug } from "lucide-react";

/**
 * Bloc "Nouveautés Casa Minga" — façon Actualités Yapla.
 * Tenu à jour manuellement au fil des releases.
 */
interface NewsItem {
  icon: React.ReactNode;
  date: string;
  title: string;
  desc: string;
  href?: string;
}

const NEWS: NewsItem[] = [
  {
    icon: <UsersRound className="size-4" />,
    date: "Juin 2026",
    title: "Gestion d'équipe",
    desc: "Invitez des collaborateurs et attribuez-leur des rôles (coordination, trésorerie…).",
    href: "equipe",
  },
  {
    icon: <Plug className="size-4" />,
    date: "Juin 2026",
    title: "Intégration HelloAsso",
    desc: "Synchronisez automatiquement vos adhésions et paiements HelloAsso.",
    href: "parametres",
  },
  {
    icon: <Landmark className="size-4" />,
    date: "Juin 2026",
    title: "Module Subventions",
    desc: "Suivez vos conventions, versements et indicateurs d'impact pour vos financeurs.",
    href: "subventions",
  },
  {
    icon: <Palette className="size-4" />,
    date: "Juin 2026",
    title: "Résidences & artistes",
    desc: "Annuaire d'artistes, profils, jalons et suivi des résidences.",
    href: "artistes",
  },
];

export function WhatsNew({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="mc-card px-[22px] py-5">
      <div className="mc-dash-card-head">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-coral-dark" />
          <h3 className="mc-dash-h3">Nouveautés Casa Minga</h3>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {NEWS.map((n) => {
          const inner = (
            <>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-peach-pale text-coral-dark">
                {n.icon}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{n.title}</span>
                  <span className="text-[10px] text-warmgray">{n.date}</span>
                </span>
                <span className="block text-[12px] text-warmgray leading-snug">{n.desc}</span>
              </span>
            </>
          );
          return n.href ? (
            <a
              key={n.title}
              href={`/dashboard/${orgSlug}/${n.href}`}
              className="flex items-start gap-3 rounded-[14px] border border-transparent bg-gray-light px-3.5 py-3 transition-colors hover:border-peach hover:bg-white"
            >
              {inner}
            </a>
          ) : (
            <div key={n.title} className="flex items-start gap-3 rounded-[14px] bg-gray-light px-3.5 py-3">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
