import Link from "next/link";
import type { MediaRow } from "@/lib/queries";
import type { Deadline } from "@/lib/support";
import { securityHeadline } from "@/lib/support";
import { cardVisual } from "@/lib/visual";
import { PhoneVisual } from "./PhoneVisual";

/** Illustration originale d'un téléphone générique (non identifiable) — utilisée sur l'accueil. */
export function PhoneIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 560" className={className} role="img" aria-label="Illustration d'un smartphone générique">
      <defs>
        <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a0b0d" />
          <stop offset="0.55" stopColor="#120708" />
          <stop offset="1" stopColor="#0a0a0b" />
        </linearGradient>
        <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a3a42" />
          <stop offset="0.5" stopColor="#8a8a94" />
          <stop offset="1" stopColor="#3a3a42" />
        </linearGradient>
      </defs>
      <rect x="10" y="6" width="300" height="548" rx="46" fill="url(#edge)" />
      <rect x="18" y="14" width="284" height="532" rx="40" fill="#050506" />
      <rect x="28" y="24" width="264" height="512" rx="32" fill="url(#scr)" />
      <rect x="122" y="40" width="76" height="20" rx="10" fill="#050506" />
      <g fontFamily="Archivo, sans-serif" fontWeight="900" fill="#f5f5f4">
        <text x="52" y="150" fontSize="22" letterSpacing="1">TON BUDGET</text>
        <text x="52" y="210" fontSize="56" fill="#ff3434">400 €</text>
      </g>
      <g fill="none" strokeWidth="10" strokeLinecap="round">
        <circle cx="160" cy="350" r="78" stroke="#2b2b31" />
        <path d="M160 272 a78 78 0 1 1 -74 102" stroke="#ff3434" />
      </g>
      <text x="160" y="360" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="20" fontWeight="700" fill="#f5f5f4">3 questions</text>
      <rect x="52" y="468" width="216" height="40" fill="#ff3434" style={{ clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)" }} />
      <text x="160" y="494" textAnchor="middle" fontFamily="Archivo, sans-serif" fontSize="15" fontWeight="900" fill="#0a0a0b">TROUVER</text>
    </svg>
  );
}

/** Silhouette neutre affichée quand aucun visuel fiable n'existe. */
export function NoVisual({ className = "" }: { className?: string }) {
  return (
    <div className={`grid place-items-center content-center gap-2 text-muted ${className}`}>
      <svg viewBox="0 0 40 64" className="w-7 h-11 opacity-50" aria-hidden>
        <rect x="2" y="2" width="36" height="60" rx="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <rect x="15" y="6" width="10" height="3" rx="1.5" fill="currentColor" />
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-wider">Visuel indisponible</span>
    </div>
  );
}

/** Cadre visuel homogène : détourage autorisé, sinon illustration locale (jamais une photo de magasin en miniature). */
export function PhotoFrame({ media, alt, form, className = "" }: { media: MediaRow | null; alt: string; form?: string | null; className?: string }) {
  return <PhoneVisual visual={cardVisual(media, form)} alt={alt} className={className} />;
}

export function Thumb({ media, alt, size = 96, form }: { media: MediaRow | null; alt: string; size?: number; form?: string | null }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <PhoneVisual visual={cardVisual(media, form)} alt={alt} className="w-full h-full" caption={size >= 96} />
    </div>
  );
}

export type SourceLevel = "officiel" | "communautaire" | "editorial" | string;

const LEVELS: Record<string, { label: string; short: string; icon: string; cls: string; help: string }> = {
  officiel: { label: "Source officielle", short: "Officiel", icon: "✓", cls: "text-ok border-ok/50", help: "Relevé automatiquement sur la page du constructeur, à la date indiquée." },
  autorise: { label: "Source autorisée (Icecat)", short: "Icecat", icon: "✓", cls: "text-ok border-ok/40", help: "Fiche fournie par le fabricant au catalogue ouvert Open Icecat, pour cette référence exacte." },
  communautaire: { label: "Source communautaire", short: "Communautaire", icon: "◐", cls: "text-warn border-warn/50", help: "Base collaborative sourcée sur les politiques constructeurs (endoflife.date)." },
  editorial: { label: "Saisie à vérifier", short: "À vérifier", icon: "!", cls: "text-muted border-white/25", help: "Saisie éditoriale d'après la fiche constructeur, pas encore confirmée par un relevé automatique." },
};

export function SourceBadge({ level, compact = false, iconOnMobile = false }: { level: SourceLevel | null | undefined; compact?: boolean; iconOnMobile?: boolean }) {
  const l = LEVELS[level ?? "editorial"] ?? LEVELS.editorial;
  const text = compact ? l.short : l.label;
  return (
    <span title={l.help} className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${l.cls}`}>
      <span aria-hidden>{l.icon}</span>
      {iconOnMobile ? <><span className="hidden sm:inline">{text}</span><span className="sr-only sm:hidden">{l.label}</span></> : text}
    </span>
  );
}

export function SourceLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      {Object.entries(LEVELS).map(([k, v]) => (
        <li key={k} className="flex items-center gap-2">
          <SourceBadge level={k} compact />
          <span>{v.help}</span>
        </li>
      ))}
    </ul>
  );
}

export function SecurityLine({ d, compact = false }: { d: Deadline; compact?: boolean }) {
  const ok = d.state === "en_cours" || d.state === "dernier_jour";
  const symbol = ok ? "●" : d.state === "inconnue" ? "?" : "■";
  return (
    <span className={`inline-flex items-start gap-1.5 ${compact ? "text-xs" : "text-sm"}`}>
      <span aria-hidden className={ok ? "text-ok" : d.state === "inconnue" ? "text-warn" : "text-red"}>
        {symbol}
      </span>
      <span>
        <span className="sr-only">Correctifs de sécurité : </span>
        {securityHeadline(d)}
      </span>
    </span>
  );
}

export function SectionTitle({ children, as: As = "h2", className = "" }: { children: React.ReactNode; as?: "h1" | "h2" | "h3"; className?: string }) {
  return <As className={`display text-3xl sm:text-4xl ${className}`}>{children}</As>;
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-sm text-muted mb-4">
      <ol className="flex flex-wrap gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1">
            {i > 0 && <span aria-hidden>→</span>}
            {it.href ? (
              <Link href={it.href} className="hover:text-text underline-offset-2 hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-text">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted mt-2">{children}</p>;
}

/** Jauge prix / budget : la part du budget occupée par le prix, et ce qui reste (marge ou frais tolérés). */
export function BudgetGauge({ price, budget, confirmed }: { price: number; budget: number; confirmed: boolean }) {
  const pct = Math.max(4, Math.min(100, (price / budget) * 100));
  const left = Math.max(0, budget - price);
  return (
    <div className="mt-3" aria-hidden>
      <div className="h-1.5 bg-panel-2 overflow-hidden">
        <div className={`h-full ${confirmed ? "bg-ok" : "bg-warn"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 flex justify-between text-[11px] text-muted tabular-nums">
        <span>{Math.round((price / budget) * 100)} % du budget</span>
        <span>{confirmed ? "marge" : "frais tolérés"} : {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(left)}</span>
      </p>
    </div>
  );
}
