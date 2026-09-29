"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/admin/contacts", label: "Accueil", exact: true },
  { href: "/admin/contacts/tableau", label: "Tableau", exact: false },
  { href: "/admin/contacts/lieux", label: "Lieux", exact: false },
  { href: "/admin/contacts/lots", label: "Validation par lot", exact: false },
  { href: "/admin/contacts/reglages", label: "Réglages", exact: false },
];

/** Sub-navigation of the contacts module. Keeps ?programme= from one tab to the next. */
export function ContactsNav() {
  const pathname = usePathname();
  const programme = useSearchParams().get("programme");
  return (
    <nav className="mb-5 flex flex-wrap gap-1.5 border-b border-border pb-3" aria-label="Contacts">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const href = programme ? `${t.href}?programme=${encodeURIComponent(programme)}` : t.href;
        return (
          <Link key={t.href} href={href} className={`mc-chip ${active ? "active" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
