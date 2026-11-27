import { frenchDate, frenchMonth } from "./support";

const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 400 € », « 327,50 € » : deux décimales dès qu'il y a des centimes. */
export const euros = (n: number) => (Math.round(n * 100) % 100 === 0 ? eur0.format(n) : eur2.format(n));
export const storageLabel = (gb: number) => (gb === 0 ? "Prix de départ" : gb >= 1024 ? `${gb / 1024} To` : `${gb} Go`);

export function dateTimeFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));
}

export function dateFr(iso: string): string {
  return /^\d{4}-\d{2}$/.test(iso) ? frenchMonth(iso + "-01") : frenchDate(iso.slice(0, 10));
}

/** « 19 septembre 2025 (date mondiale — date française à vérifier) » */
export function releaseLabel(m: { release_date: string | null; release_scope: string }): { date: string; note: string | null } {
  if (!m.release_date) return { date: "Non renseigné", note: null };
  const d = /^\d{4}-\d{2}$/.test(m.release_date) ? frenchMonth(m.release_date + "-01") : frenchDate(m.release_date);
  return m.release_scope === "fr" ? { date: d, note: null } : { date: d, note: "Date de sortie mondiale — date française à vérifier" };
}

export const NR = "Non renseigné";

export function specText(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return NR;
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  const n = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  switch (key) {
    case "screen_in": return `${n}″`;
    case "refresh_hz": return `${n} Hz`;
    case "height_mm": case "width_mm": case "thickness_mm": return `${n} mm`;
    case "weight_g": return `${n} g`;
    case "ram_gb": return `${n} Go`;
    case "battery_mah": return `${n} mAh`;
    case "charge_w": return `${n} W`;
    case "optical_zoom": return v === 1 ? "Aucun (pas de téléobjectif)" : `${n}x`;
    case "autonomy_h": return `${n} h`;
    default: return n;
  }
}

/** Libellé lisible de la source d'une offre. */
export function sourceLabel(source: string | undefined): string {
  const map: Record<string, string> = {
    "apple-store-fr": "Apple Store France (relevé automatique)",
    "apple-refurb-fr": "Apple – reconditionné officiel (relevé automatique)",
    "samsung-fr": "Samsung Shop France (données structurées de la page)",
    "xiaomi-fr": "Xiaomi Store France (prix par variante)",
    "google-store-fr": "Google Store France (page produit)",
    manuel: "Offre saisie manuellement",
  };
  if (!source) return "Source non renseignée";
  return map[source] ?? (source.startsWith("flux-") ? `Flux marchand ${source.slice(5)}` : source);
}
