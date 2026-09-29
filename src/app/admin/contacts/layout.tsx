import type { Metadata } from "next";
import { ContactsNav } from "@/components/outreach/contacts-nav";

export const metadata: Metadata = { title: "Contacts · Administration" };

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-4">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Contacts</h1>
        <p className="mt-1 text-sm text-warmgray">
          Les échanges par mail avec les lieux et les membres, programme par programme. Tu valides, tu réponds à ce qui est « à toi ».
        </p>
      </header>
      <ContactsNav />
      {children}
    </div>
  );
}
