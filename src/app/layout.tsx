import type { Metadata } from "next";
import { Poppins, Syne, DM_Sans, Geist_Mono, Fraunces, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { CookieBanner } from "@/components/mc/cookie-banner";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dmsans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Casa Minga Lieux",
  description:
    "Le pilotage des lieux collectifs vivants — tiers-lieux, lieux culturels, résidences et espaces partagés.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${poppins.variable} ${syne.variable} ${dmSans.variable} ${geistMono.variable} ${fraunces.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors closeButton />
        <CookieBanner />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
