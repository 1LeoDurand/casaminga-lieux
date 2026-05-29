import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizationBySlug, getPublicSiteBySlug } from "@/lib/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) return { title: "Lieu introuvable" };
  return {
    title: site.title,
    description: site.seo_description ?? undefined,
  };
}

function PhotoSlot({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-dashed border-peach bg-peach-pale text-center text-xs font-medium text-coral-dark ${className}`}
    >
      {label}
    </div>
  );
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  const org = await getOrganizationBySlug(slug);
  if (!site || !org) notFound();

  return (
    <main className="min-h-screen bg-cream">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <span className="font-heading text-lg font-extrabold">{org.name}</span>
          <nav className="ml-auto flex items-center gap-5 text-sm text-muted-foreground">
            <a href="#lieu" className="hover:text-coral-dark">Le lieu</a>
            <a href="#agenda" className="hover:text-coral-dark">Agenda</a>
            <a href="#contact" className="hover:text-coral-dark">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-8 pt-14">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full border border-coral/30 bg-peach-pale px-3 py-1 text-xs font-semibold uppercase tracking-wide text-coral-dark">
              {org.structure}
            </span>
            <h1 className="mt-4 font-heading text-4xl font-extrabold leading-tight tracking-tight">
              {org.name}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">{org.description}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {org.address} · {org.hours}
            </p>
          </div>
          <PhotoSlot label="Photo hero — vie du lieu" className="aspect-[4/3]" />
        </div>
      </section>

      {/* Le lieu */}
      <section id="lieu" className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="font-heading text-2xl font-bold">Découvrir le lieu</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <PhotoSlot label="Espace de travail" className="aspect-square" />
          <PhotoSlot label="Le jardin" className="aspect-square" />
          <PhotoSlot label="Détail architectural" className="aspect-square" />
        </div>
      </section>

      {/* Agenda */}
      <section id="agenda" className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="font-heading text-2xl font-bold">Agenda</h2>
        <p className="mt-2 text-muted-foreground">
          La programmation publiée depuis le dashboard apparaîtra ici.
        </p>
        <div className="mt-6 rounded-2xl border border-dashed border-peach bg-peach-pale/40 px-6 py-10 text-center text-sm text-muted-foreground">
          Aucun événement publié pour le moment.
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-5xl px-6 py-14">
        <div className="rounded-3xl bg-white p-8 shadow-[0_4px_20px_rgba(255,138,101,0.07)]">
          <h2 className="font-heading text-2xl font-bold">Nous écrire</h2>
          <p className="mt-2 text-muted-foreground">
            Résidence, réservation, partenariat, bénévolat… Votre message arrive
            directement à l&apos;équipe.
          </p>
          <form className="mt-6 grid gap-4 sm:grid-cols-2">
            <input
              placeholder="Votre nom"
              className="rounded-lg border border-input bg-cream px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <input
              placeholder="Votre email"
              className="rounded-lg border border-input bg-cream px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <textarea
              placeholder="Votre message"
              rows={4}
              className="rounded-lg border border-input bg-cream px-3 py-2 text-sm outline-none focus:border-coral sm:col-span-2"
            />
            <button
              type="button"
              className="justify-self-start rounded-lg bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-dark sm:col-span-2"
            >
              Envoyer (branché à Supabase en v1.x)
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-8 text-center text-sm text-muted-foreground">
          <span>
            Site généré avec{" "}
            <span className="font-semibold text-foreground">Casa Minga Lieux</span>
          </span>
          <Link href={`/dashboard/${org.slug}`} className="hover:text-coral-dark">
            Espace équipe — administrer ce lieu
          </Link>
        </div>
      </footer>
    </main>
  );
}
