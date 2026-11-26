/**
 * Cote d'occasion — API officielle eBay « Browse » (marché EBAY_FR).
 *
 * Accès gratuit : compte eBay Developers Program → clés de production (App ID / Client ID et Cert ID / Client Secret).
 * Configuration privée dans .env.local (ou variables Vercel) :
 *   EBAY_CLIENT_ID=…
 *   EBAY_CLIENT_SECRET=…
 * Sans ces clés, l'étape est ignorée.
 *
 * Chaque annonce devient une OBSERVATION de prix demandé (jamais une offre « dans ton budget ») pour une
 * configuration précise : modèle exact et capacité lue dans le titre. Les annonces non comparables sont gardées
 * avec leur motif d'exclusion (pour pièces, bloqué, accessoire, lot, vendeur peu évalué…), pour la transparence.
 */
import type { DatabaseSync } from "node:sqlite";
import { normalize } from "../src/lib/text";
import { storageFromLabel } from "./feeds";

export interface EbayItem {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  conditionId?: string;
  itemWebUrl?: string;
  seller?: { feedbackPercentage?: string; feedbackScore?: number };
  itemLocation?: { country?: string };
}

const EXCLUDE: [RegExp, string][] = [
  [/pour pi[eè]ces|\bhs\b|hors service|ne s'allume|d[ée]fectueux|en panne/i, "pour pièces ou en panne"],
  [/cass[ée]|fissur|[ée]cran (?:cass|f[eê]l)/i, "endommagé"],
  [/bloqu[ée]|icloud|blacklist|compte google|verrouill/i, "bloqué ou verrouillé"],
  [/\blot\b|lot de|x\s?\d+ t[ée]l[ée]phones/i, "lot"],
  [/coque|[ée]tui|protection [ée]cran|verre tremp|chargeur|c[aâ]ble|bo[iî]te vide|sans t[ée]l[ée]phone/i, "accessoire seul"],
  [/r[ée]plique|copie|\bfake\b|\bclone\b/i, "contrefaçon possible"],
  [/acompte|r[ée]servation|location|mensualit/i, "paiement partiel"],
];
const SUFFIXES = ["pro", "plus", "ultra", "max", "lite", "fe", "mini", "edge", "fold", "flip", "neo", "5g", "4g", "s", "a", "e", "r", "t", "c", "x"];

/** Le titre désigne-t-il exactement ce modèle (pas un « Pro » ou un « 5G » de plus) ? */
export function titleMatchesModel(title: string, modelName: string): boolean {
  const words = normalize(title).split(" ");
  const mw = normalize(modelName).split(" ");
  for (let i = 0; i + mw.length <= words.length; i++) {
    if (mw.every((w, j) => words[i + j] === w)) {
      const next = words[i + mw.length];
      return !(next && SUFFIXES.includes(next));
    }
  }
  return false;
}

/** Motif d'exclusion d'une annonce, ou null si elle est comparable. */
export function exclusionReason(item: EbayItem, modelName: string, storageGb: number): string | null {
  if (item.price?.currency && item.price.currency !== "EUR") return "devise";
  if (item.itemLocation?.country && item.itemLocation.country !== "FR") return "hors de France";
  for (const [re, why] of EXCLUDE) if (re.test(item.title)) return why;
  if (!titleMatchesModel(item.title, modelName)) return "autre modèle";
  if (storageFromLabel(item.title) !== storageGb) return "capacité absente ou différente";
  const pct = Number(item.seller?.feedbackPercentage ?? 0);
  if (pct < 95 || (item.seller?.feedbackScore ?? 0) < 10) return "vendeur peu évalué";
  return null;
}

async function token(): Promise<string> {
  const id = process.env.EBAY_CLIENT_ID!;
  const secret = process.env.EBAY_CLIENT_SECRET!;
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`jeton eBay refusé (HTTP ${res.status}) : vérifie EBAY_CLIENT_ID / EBAY_CLIENT_SECRET`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export function ebayConfigured(): boolean {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

/** Interroge eBay pour chaque configuration publiée et enregistre les observations d'occasion. */
export async function importEbayUsed(db: DatabaseSync, stats: { added: number; updated: number; notes: string[] }, configs: { configId: string; modelName: string; storageGb: number }[]) {
  const t = await token();
  const reasons = new Map<string, number>();
  const now = new Date().toISOString();
  for (const c of configs) {
    const q = `${c.modelName} ${c.storageGb >= 1024 ? `${c.storageGb / 1024}To` : `${c.storageGb}Go`}`;
    const params = new URLSearchParams({
      q, category_ids: "9355", limit: "100",
      filter: "conditionIds:{3000},buyingOptions:{FIXED_PRICE},itemLocationCountry:FR,priceCurrency:EUR",
    });
    const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
      headers: { Authorization: `Bearer ${t}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR", "Accept-Language": "fr-FR" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      stats.notes.push(`eBay ${q} : HTTP ${res.status}`);
      continue;
    }
    const items = ((await res.json()) as { itemSummaries?: EbayItem[] }).itemSummaries ?? [];
    for (const it of items) {
      const price = Number(it.price?.value);
      if (!price) continue;
      const why = exclusionReason(it, c.modelName, c.storageGb);
      if (why) reasons.set(why, (reasons.get(why) ?? 0) + 1);
      const r = db.prepare(`INSERT INTO market_observations (id, config_id, condition_class, price, observed_at, source, excluded_reason, is_test)
          VALUES (?, ?, 'occasion', ?, ?, 'ebay-fr', ?, 0)
        ON CONFLICT(id) DO UPDATE SET price=excluded.price, observed_at=excluded.observed_at, excluded_reason=excluded.excluded_reason`).run(
        `ebay:${it.itemId}:${c.configId}`, c.configId, price, now, why,
      );
      if (!why) stats.added += Number(r.changes);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  stats.notes.push(`${configs.length} configurations interrogées ; exclusions : ${[...reasons].map(([k, v]) => `${v} ${k}`).join(", ") || "aucune"}`);
}
