// Règle de publication : quels téléphones sont visibles sur le site (data/sources/catalog-policy.json).
import fs from "node:fs";
import path from "node:path";

export interface CatalogPolicy {
  publishOnlyPriced: boolean;
  acceptStartingPrices: boolean;
  maxOfferAgeDays: number;
}

let cache: CatalogPolicy | null = null;

export function catalogPolicy(root = process.cwd()): CatalogPolicy {
  if (cache) return cache;
  const f = path.join(root, "data", "sources", "catalog-policy.json");
  const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  cache = {
    publishOnlyPriced: j.publishOnlyPriced !== false,
    acceptStartingPrices: j.acceptStartingPrices === true,
    maxOfferAgeDays: Number(j.maxOfferAgeDays ?? 7),
  };
  return cache;
}

/** Condition SQL d'une offre fiable (alias de table : o). */
export function reliableOfferSql(p: CatalogPolicy, now = new Date()): string {
  const cutoff = new Date(now.getTime() - p.maxOfferAgeDays * 864e5).toISOString();
  return [
    "o.available=1", "o.is_test=0", "o.is_demo=0", "o.stock<>'rupture'",
    "COALESCE(o.variant_check,'')<>'ecart'",
    "COALESCE(o.currency,'EUR')='EUR'", "o.price_conditions IS NULL",
    `o.checked_at >= '${cutoff}'`,
    p.acceptStartingPrices ? "1=1" : "o.capacity_status='confirmee'",
  ].join(" AND ");
}

/** Condition SQL « modèle avec au moins une offre fiable » (alias de table : m), quelle que soit la règle d'affichage. */
export function pricedModelSql(p: CatalogPolicy = catalogPolicy(), now = new Date()): string {
  return `m.id IN (SELECT c.model_id FROM offers o JOIN configs c ON c.id=o.config_id WHERE ${reliableOfferSql(p, now)})`;
}

/** Condition SQL « modèle publié » (alias de table : m). */
export function publishedModelSql(p: CatalogPolicy = catalogPolicy(), now = new Date()): string {
  if (!p.publishOnlyPriced) return "1=1";
  return pricedModelSql(p, now);
}
