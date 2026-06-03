import Link from "next/link";
import {
  Rocket,
  Users,
  DoorOpen,
  CalendarDays,
  Wallet,
  Globe,
  Settings,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { getHelpCategories, getHelpArticles } from "@/lib/help-data";
import { HelpSearch, type HelpSearchItem } from "@/components/help/help-search";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  users: Users,
  door: DoorOpen,
  calendar: CalendarDays,
  wallet: Wallet,
  globe: Globe,
  settings: Settings,
};

export default async function AideHomePage() {
  const [categories, articles] = await Promise.all([getHelpCategories(), getHelpArticles()]);
  const countByCat = (slug: string) => articles.filter((a) => a.categorySlug === slug).length;

  const searchItems: HelpSearchItem[] = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    categoryLabel: categories.find((c) => c.slug === a.categorySlug)?.label ?? "",
    keywords: a.keywords,
  }));

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-peach-pale to-cream px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-warmgray">
            Guides et tutoriels pour piloter votre lieu : adhésions, réservations,
            événements, caisse certifiée et plus encore.
          </p>
          <div className="mt-8">
            <HelpSearch items={searchItems} />
          </div>
        </div>
      </section>

      {/* Catégories */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="mb-6 font-heading text-xl font-bold">Parcourir par thème</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon] ?? Rocket;
            const count = countByCat(cat.slug);
            return (
              <Link
                key={cat.slug}
                href={`/aide/categorie/${cat.slug}`}
                className="group flex flex-col rounded-2xl border border-[#E5DDD6] bg-white p-5 transition hover:-translate-y-0.5 hover:border-peach hover:shadow-[0_10px_28px_rgba(255,138,101,0.14)]"
              >
                <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-peach-pale text-coral-dark">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <span className="font-heading text-[15px] font-bold">
                  {cat.label}
                </span>
                <span className="mt-1 flex-1 text-[13px] leading-relaxed text-warmgray">
                  {cat.description}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-coral-dark">
                  {count} article{count > 1 ? "s" : ""}
                  <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Articles populaires */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-6 font-heading text-xl font-bold">Articles les plus consultés</h2>
        <div className="overflow-hidden rounded-2xl border border-[#E5DDD6] bg-white">
          {articles.slice(0, 6).map((a, i) => (
            <Link
              key={a.slug}
              href={`/aide/${a.slug}`}
              className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-peach-pale ${
                i > 0 ? "border-t border-[#F0E8E0]" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-foreground">
                  {a.title}
                </span>
                <span className="block truncate text-[12.5px] text-warmgray">
                  {a.excerpt}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-warmgray" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
