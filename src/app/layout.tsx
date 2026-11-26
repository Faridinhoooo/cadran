import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";
import { siteUrl } from "@/lib/site-config";

const display = Archivo({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: { type: "website", locale: "fr_FR", siteName: "Cadran" },
  twitter: { card: "summary_large_image" },
  applicationName: "Cadran",
  formatDetection: { telephone: false },
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
          <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center gap-x-3 sm:gap-x-6 py-2 sm:py-3">
            <Link href="/" className="display text-2xl tracking-tight" aria-label="Cadran, accueil">
              Cadr<span className="text-red">a</span>n
            </Link>
            <NavLinks />
          </div>
        </header>
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-line mt-20 bg-panel/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="display text-2xl tracking-tight">Cadr<span className="text-red">a</span>n</Link>
              <p className="text-sm text-muted mt-3 max-w-xs">
                Le bon smartphone pour ton budget. Prix en euros, marché français. Aucune inscription, aucune donnée personnelle collectée.
              </p>
            </div>
            {[
              ["Choisir", [["/trouver", "Trouver mon smartphone"], ["/catalogue", "Catalogue"], ["/comparer", "Comparer"]]],
              ["Guides", [["/meilleurs-smartphones", "Meilleurs par budget"], ["/meilleurs-smartphones/300", "À 300 €"], ["/meilleurs-smartphones/500", "À 500 €"]]],
              ["Transparence", [["/couverture", "Sources et méthode"], ["/classement", "Comment nous classons"], ["/mentions-legales", "Mentions légales"], ["/confidentialite", "Confidentialité"]]],
            ].map(([title, links]) => (
              <nav key={title as string} aria-label={title as string}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{title as string}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {(links as string[][]).map(([href, label]) => (
                    <li key={href}><Link href={href} className="hover:text-red transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="border-t border-line">
            <p className="mx-auto max-w-7xl px-4 sm:px-6 py-4 text-xs text-muted">© {new Date().getFullYear()} Cadran · Les prix peuvent changer chez le vendeur : vérifie toujours le montant final avant de payer.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
