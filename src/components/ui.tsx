import Link from "next/link";
import type { MediaRow } from "@/lib/queries";
import type { Deadline } from "@/lib/support";
import { securityHeadline } from "@/lib/support";
import { cardVisual } from "@/lib/visual";
import { PhoneVisual } from "./PhoneVisual";

/** Illustration originale (non identifiable) : un téléphone qui affiche l'écran « Tes 3 choix » de PickJust. Accueil. */
export function PhoneIllustration({ className = "" }: { className?: string }) {
  const display = { fontFamily: "var(--font-display), system-ui, sans-serif" };
  const body = { fontFamily: "var(--font-body), system-ui, sans-serif" };
  const row = (y: number, first: boolean, w1: number, w2: number) => (
    <g key={y}>
      <rect x="34" y={y} width="252" height="104" rx="18" fill={first ? "#ffffff" : "#f4f4f6"} stroke={first ? "#e0222c" : "none"} strokeWidth="2.5" />
      <rect x="48" y={y + 14} width="48" height="76" rx="10" fill={first ? "#f4f4f6" : "#e9e9ee"} />
      <rect x="62" y={y + 20} width="20" height="5" rx="2.5" fill="#cfcfd6" />
      <text x="110" y={y + 30} fontSize="12" fontWeight="600" fill={first ? "#e0222c" : "#8b8b94"} style={body}>{first ? "N°1 · Meilleur choix" : `N°${y > 300 ? 3 : 2}`}</text>
      <rect x="110" y={y + 40} width={w1} height="11" rx="5.5" fill="#111114" />
      <rect x="110" y={y + 62} width="160" height="7" rx="3.5" fill="#e3e3e8" />
      <rect x="110" y={y + 62} width={w2} height="7" rx="3.5" fill={first ? "#e0222c" : "#9a9aa3"} />
      <rect x="110" y={y + 78} width="160" height="7" rx="3.5" fill="#e3e3e8" />
      <rect x="110" y={y + 78} width={w2 - 24} height="7" rx="3.5" fill={first ? "#22c55e" : "#b7b7bf"} />
    </g>
  );
  return (
    <svg viewBox="0 0 320 600" className={className} role="img" aria-label="Illustration : l'écran des 3 choix PickJust sur un smartphone générique">
      <defs>
        <linearGradient id="pj-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9d9de" />
          <stop offset="0.5" stopColor="#f6f6f8" />
          <stop offset="1" stopColor="#bdbdc4" />
        </linearGradient>
      </defs>
      <rect x="6" y="4" width="308" height="592" rx="52" fill="url(#pj-edge)" />
      <rect x="13" y="11" width="294" height="578" rx="46" fill="#0f0f12" />
      <rect x="20" y="18" width="280" height="564" rx="40" fill="#ffffff" />
      <rect x="128" y="32" width="64" height="18" rx="9" fill="#0f0f12" />
      <text x="34" y="96" fontSize="13" fontWeight="600" fill="#8b8b94" style={body}>Budget 400 € · Photo</text>
      <text x="34" y="128" fontSize="28" fontWeight="700" fill="#111114" letterSpacing="-0.8" style={display}>Tes 3 choix</text>
      {row(148, true, 120, 138)}
      {row(266, false, 100, 112)}
      {row(384, false, 86, 96)}
      <rect x="34" y="512" width="252" height="46" rx="23" fill="#0f0f12" />
      <text x="160" y="541" textAnchor="middle" fontSize="14" fontWeight="600" fill="#ffffff" style={body}>Voir pourquoi</text>
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
  editorial: { label: "Saisie à vérifier", short: "À vérifier", icon: "!", cls: "text-muted border-text/25", help: "Saisie éditoriale d'après la fiche constructeur, pas encore confirmée par un relevé automatique." },
};

export function SourceBadge({ level, compact = false, iconOnMobile = false }: { level: SourceLevel | null | undefined; compact?: boolean; iconOnMobile?: boolean }) {
  const l = LEVELS[level ?? "editorial"] ?? LEVELS.editorial;
  const text = compact ? l.short : l.label;
  return (
    <span title={l.help} className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${l.cls}`}>
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
      <div className="h-1.5 bg-panel-2 rounded-full overflow-hidden">
        <div className={`h-full ${confirmed ? "bg-ok" : "bg-warn"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 flex justify-between text-[11px] text-muted tabular-nums">
        <span>{Math.round((price / budget) * 100)} % du budget</span>
        <span>{confirmed ? "marge" : "frais tolérés"} : {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(left)}</span>
      </p>
    </div>
  );
}
