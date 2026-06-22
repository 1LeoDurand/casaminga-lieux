import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Centre d'aide — Casa Minga Lieux",
  description:
    "Guides et tutoriels pour piloter votre lieu avec Casa Minga Lieux : adhésions, réservations, événements, caisse certifiée et plus.",
};

export default function AideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream font-sans text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#F0E8E0] bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/aide" className="flex items-center gap-2.5">
            <img src="/logo-icon.webp" alt="Casa Minga Lieux" className="size-9 object-contain" />
            <span className="font-heading text-[17px] font-extrabold tracking-tight">
              Casa Minga{" "}
              <span className="font-medium text-warmgray">· Centre d'aide</span>
            </span>
          </Link>
          <a
            href="mailto:support@casaminga.com"
            className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral-dark"
          >
            <Mail className="size-4" />
            Nous contacter
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#F0E8E0] bg-peach-pale">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-warmgray sm:flex-row">
          <span>© {new Date().getFullYear()} Casa Minga Lieux</span>
          <nav className="flex items-center gap-5">
            <Link href="/aide" className="hover:text-coral-dark">
              Centre d'aide
            </Link>
            <a href="mailto:support@casaminga.com" className="hover:text-coral-dark">
              support@casaminga.com
            </a>
            <Link href="/" className="hover:text-coral-dark">
              Accueil
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
