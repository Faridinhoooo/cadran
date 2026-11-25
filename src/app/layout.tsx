import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";

const display = Archivo({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  openGraph: { type: "website", locale: "fr_FR", siteName: "Cadran" },
  title: { default: "Cadran — le bon smartphone pour ton budget", template: "%s · Cadran" },
  description: "Entre ton budget, réponds à trois questions et découvre quel smartphone acheter, dans quel état et pourquoi.",
};

export const viewport: Viewport = { themeColor: "#0a0a0b", width: "device-width", initialScale: 1 };



export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn btn-secondary">
          Aller au contenu
        </a>
        <header className="border-b border-line bg-ink/85 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
            <Link href="/" className="display text-2xl tracking-tight" aria-label="Cadran, accueil">
              Cadr<span className="text-red">a</span>n
            </Link>
            <NavLinks />
          </div>
        </header>
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-line mt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-sm text-muted flex flex-wrap gap-x-6 gap-y-2">
            <span>Prix en euros, marché français. Aucune inscription, aucune donnée personnelle collectée.</span>
            <Link href="/couverture" className="underline hover:text-text">Sources, couverture et méthode</Link>
            <Link href="/meilleurs-smartphones" className="underline hover:text-text">Meilleurs smartphones par budget</Link>
            <Link href="/classement" className="underline hover:text-text">Comment nous classons les offres</Link>
            <Link href="/mentions-legales" className="underline hover:text-text">Mentions légales</Link>
            <Link href="/confidentialite" className="underline hover:text-text">Confidentialité et cookies</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
