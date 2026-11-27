import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";
import { Logo } from "@/components/Logo";
import { siteUrl } from "@/lib/site-config";

// Polices intégrées au site (licence SIL OFL) : le build ne dépend plus du téléchargement depuis Google Fonts.
const display = localFont({ src: "./fonts/outfit.woff2", weight: "100 900", variable: "--font-display", display: "swap" });
const body = localFont({ src: "./fonts/inter.woff2", weight: "100 900", variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: { type: "website", locale: "fr_FR", siteName: "PickJust" },
  twitter: { card: "summary_large_image" },
  applicationName: "PickJust",
  formatDetection: { telephone: false },
  title: { default: "PickJust — le bon smartphone pour ton budget", template: "%s · PickJust" },
  description: "Entre ton budget, réponds à 7 questions rapides et découvre quel smartphone acheter, dans quel état et pourquoi.",
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };



export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn btn-secondary">
          Aller au contenu
        </a>
        <header className="border-b border-line bg-page/95 backdrop-blur-xl sticky top-0 z-40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center gap-x-2 sm:gap-x-6 h-14 sm:h-16">
            <Link href="/" aria-label="PickJust, accueil" className="shrink-0">
              <span className="sm:hidden"><Logo size={22} /></span>
              <span className="hidden sm:block"><Logo size={28} /></span>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <footer className="mt-24 bg-panel">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" aria-label="PickJust, accueil"><Logo size={30} /></Link>
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
                <p className="text-sm font-semibold">{title as string}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {(links as string[][]).map(([href, label]) => (
                    <li key={href}><Link href={href} className="text-muted hover:text-text transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="border-t border-line">
            <p className="mx-auto max-w-7xl px-4 sm:px-6 py-4 text-xs text-muted">© {new Date().getFullYear()} PickJust · Les prix peuvent changer chez le vendeur : vérifie toujours le montant final avant de payer.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
