import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MODULE_SECTIONS } from "@/lib/modules";

const DEMO_SLUG = "bernard-kohn";

export default function LandingPage() {
  const allModules = MODULE_SECTIONS.flatMap((s) => s.modules);

  return (
    <main className="font-dmsans">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-coral font-heading text-sm font-extrabold text-white">
            CM
          </span>
          <span className="font-heading text-lg font-extrabold">Casa Minga Lieux</span>
          <nav className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Connexion</Link>
            </Button>
            <Button asChild size="sm" className="bg-coral text-white hover:bg-coral-dark">
              <Link href={`/dashboard/${DEMO_SLUG}`}>Voir la démo</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <span className="inline-block rounded-full border border-coral/30 bg-peach-pale px-3 py-1 text-xs font-semibold uppercase tracking-wide text-coral-dark">
          SaaS pour lieux collectifs vivants
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-heading text-5xl font-extrabold leading-[1.05] tracking-tight">
          Le pilotage des lieux qui font vivre le collectif.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Tiers-lieux, lieux culturels, résidences, espaces partagés : réunissez
          demandes, personnes, espaces, événements, finances et gouvernance dans un
          seul outil — clair, humain, sans usine à gaz.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-coral text-white hover:bg-coral-dark">
            <Link href={`/dashboard/${DEMO_SLUG}`}>
              Voir le dashboard démo <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/site/${DEMO_SLUG}`}>Voir un site généré</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Lieu démonstrateur : <strong className="text-foreground">Tiers-lieu Bernard Kohn</strong>
        </p>
      </section>

      {/* Modules */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="font-heading text-2xl font-bold">Un outil, tous les besoins du lieu</h2>
        <p className="mt-2 text-muted-foreground">
          18 modules pensés depuis le terrain, activables progressivement.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {allModules.map((m) => (
            <Card
              key={m.key}
              className="gap-1 p-4 transition-colors hover:border-coral"
            >
              <span className="text-sm font-semibold">{m.label}</span>
              <span className="text-xs text-muted-foreground">
                {m.ready ? "Disponible" : "Bientôt"}
              </span>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-peach-pale/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="font-heading text-3xl font-bold">Envie de structurer votre lieu ?</h2>
          <p className="max-w-xl text-muted-foreground">
            Découvrez la démo, puis créez l’espace de votre lieu.
          </p>
          <Button asChild size="lg" className="bg-coral text-white hover:bg-coral-dark">
            <Link href="/login">Demander un accès</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          Casa Minga Lieux — généré pour les maisons communes, tiers-lieux et lieux collectifs.
        </div>
      </footer>
    </main>
  );
}
