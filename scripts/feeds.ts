/**
 * Flux produits marchands autorisés (affiliation) — Awin « Create-a-Feed » ou tout flux CSV équivalent.
 *
 * Configuration privée dans .env.local (jamais envoyé au navigateur, ignoré par git) :
 *   MERCHANT_FEEDS="awin|https://productdata.awin.com/datafeed/download/apikey/…/compression/gzip/"
 *   (plusieurs flux séparés par un saut de ligne ou un point-virgule ; le préfixe sert de nom de source)
 *
 * Rattachement d'une ligne à une variante :
 *  1. par GTIN/EAN exact (table product_ids, alimentée par Open Icecat) → capacité certaine ;
 *  2. sinon par nom + capacité unique lue dans le libellé, avec garde contre les suffixes (Pro, Plus, Ultra…).
 * Les lignes ambiguës sont ignorées et comptées.
 */
import zlib from "node:zlib";
import type { DatabaseSync } from "node:sqlite";
import { normalize } from "../src/lib/text";

export interface FeedRow {
  name: string;
  brand: string | null;
  ean: string | null;
  price: number | null;
  shipping: number | null;
  seller: string;
  url: string;
  inStock: boolean | null;
  condition: "neuf" | "reconditionne" | "occasion" | null;
  id: string;
}

/** Analyse CSV minimale (guillemets, virgules ou points-virgules, retours ligne entre guillemets). */
export function parseCsv(text: string): Record<string, string>[] {
  const firstLine = text.slice(0, text.indexOf("\n"));
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : firstLine.includes("|") && !firstLine.includes(",") ? "|" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), (r[i] ?? "").trim()])));
}

const pick = (r: Record<string, string>, keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== "") ?? null;
const money = (s: string | null) => (s === null ? null : Number.isFinite(Number(s.replace(",", ".").replace(/[^\d.]/g, ""))) && /\d/.test(s) ? Number(s.replace(",", ".").replace(/[^\d.]/g, "")) : null);

/** Colonnes Awin et alias courants (Effiliation, Kelkoo, flux Google Shopping). */
export function toFeedRow(r: Record<string, string>): FeedRow | null {
  const name = pick(r, ["product_name", "title", "name", "nom"]);
  const url = pick(r, ["aw_deep_link", "deeplink", "link", "url", "lien"]);
  const price = money(pick(r, ["search_price", "store_price", "price", "sale_price", "prix"]));
  if (!name || !url || price === null) return null;
  const ship = pick(r, ["delivery_cost", "shipping_cost", "shipping", "frais_de_port"]);
  const stock = pick(r, ["in_stock", "stock_status", "availability", "disponibilite"]);
  const cond = (pick(r, ["condition", "product_condition", "etat"]) ?? "new").toLowerCase();
  return {
    name, url, price,
    brand: pick(r, ["brand_name", "brand", "marque"]),
    ean: pick(r, ["ean", "product_gtin", "gtin", "upc"])?.replace(/\D/g, "") || null,
    // Livraison : nombre explicite (0 compris) seulement ; une cellule vide reste « inconnue ».
    shipping: ship !== null && /\d/.test(ship) ? money(ship) : null,
    seller: pick(r, ["merchant_name", "merchant", "vendeur", "seller"]) ?? "Vendeur du flux",
    inStock: stock === null ? null : /^(1|yes|oui|true|in ?stock|en stock|available)/i.test(stock),
    condition: /refurb|recondition/.test(cond) ? "reconditionne" : /used|occasion/.test(cond) ? "occasion" : /new|neuf/.test(cond) ? "neuf" : null,
    id: pick(r, ["aw_product_id", "merchant_product_id", "id", "sku"]) ?? url,
  };
}

export interface ModelRef { id: string; name: string; brand: string }
const SUFFIXES = ["pro", "plus", "ultra", "max", "lite", "fe", "mini", "edge", "fold", "flip", "neo", "5g", "4g", "s", "a", "e", "r", "t"];

/** Modèle le plus spécifique dont tous les mots figurent dans le libellé, sans suffixe orphelin. */
export function matchModel(label: string, brand: string | null, models: ModelRef[]): ModelRef | null {
  const words = normalize(label).split(" ");
  const cands = models
    .filter((m) => !brand || normalize(m.brand) === normalize(brand) || normalize(label).includes(normalize(m.brand)))
    .filter((m) => {
      const mw = normalize(m.name).split(" ");
      // tous les mots du modèle, dans l'ordre, consécutifs
      for (let i = 0; i + mw.length <= words.length; i++) {
        if (mw.every((w, j) => words[i + j] === w)) {
          const next = words[i + mw.length];
          return !(next && SUFFIXES.includes(next));
        }
      }
      return false;
    })
    .sort((a, b) => b.name.length - a.name.length);
  return cands[0] ?? null;
}

/** Capacité de stockage lue dans le libellé : unique valeur ≥ 32 Go (la RAM est plus petite). */
export function storageFromLabel(label: string): number | null {
  const caps = [...label.matchAll(/(\d+)\s?(go|gb|to|tb)\b/gi)].map((m) => Number(m[1]) * (/t/i.test(m[2]) ? 1024 : 1)).filter((g) => g >= 32);
  const uniq = [...new Set(caps)];
  return uniq.length === 1 ? uniq[0] : null;
}

export function configuredFeeds(env = process.env.MERCHANT_FEEDS ?? ""): { name: string; url: string }[] {
  return env.split(/[;\n]/).map((s) => s.trim()).filter(Boolean).map((s, i) => {
    const [name, ...rest] = s.split("|");
    return rest.length ? { name: name.trim(), url: rest.join("|").trim() } : { name: `flux-${i + 1}`, url: s };
  });
}

export async function downloadFeed(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString("utf8");
}

export function feedToOffers(db: DatabaseSync, source: string, rows: FeedRow[], stats: { notes: string[] }) {
  const models = db.prepare(`SELECT m.id, m.name, b.name brand FROM models m JOIN brands b ON b.id=m.brand_id WHERE m.is_test=0`).all() as unknown as ModelRef[];
  const byGtin = new Map((db.prepare("SELECT value, model_id, storage_gb FROM product_ids WHERE scheme='gtin'").all() as { value: string; model_id: string; storage_gb: number }[]).map((r) => [r.value, r]));
  const skipped = { modele: 0, capacite: 0, occasion: 0 };
  const offers = [];
  for (const r of rows) {
    if (r.condition === "occasion") { skipped.occasion++; continue; }
    let modelId: string | null = null;
    let storage: number | null = null;
    const g = r.ean ? byGtin.get(r.ean) ?? byGtin.get(r.ean.padStart(13, "0")) : undefined;
    if (g) { modelId = g.model_id; storage = g.storage_gb; }
    else {
      const m = matchModel(r.name, r.brand, models);
      if (!m) { skipped.modele++; continue; }
      modelId = m.id;
      storage = storageFromLabel(r.name);
      if (!storage) { skipped.capacite++; continue; }
    }
    offers.push({
      id: `${source}:${r.id}`, modelId, storageGb: storage, capacityStatus: "confirmee" as const, condition: (r.condition ?? "neuf") as "neuf" | "reconditionne",
      seller: r.seller, platform: `flux ${source}`, price: r.price!, shipping: r.shipping,
      shippingStatus: (r.shipping === null ? "inconnue" : r.shipping === 0 ? "gratuite_annoncee" : "payante") as "inconnue" | "gratuite_annoncee" | "payante",
      shippingNote: r.shipping === null ? "Frais de livraison absents du flux" : `Frais de livraison indiqués dans le flux ${source}`,
      mandatoryFees: 0, stock: (r.inStock === null ? "inconnu" : r.inStock ? "en_stock" : "rupture") as "inconnu" | "en_stock" | "rupture",
      color: null, grade: null, batteryNote: null, warranty: null, returnsPolicy: null, url: r.url, source,
    });
  }
  stats.notes.push(`${rows.length} lignes, ${offers.length} offres rattachées ; ignorées : ${skipped.modele} modèle inconnu, ${skipped.capacite} capacité ambiguë, ${skipped.occasion} occasion`);
  return offers;
}
