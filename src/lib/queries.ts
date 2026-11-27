import "server-only";
import { getDb } from "./db";
import { excludedBrands, excludedSql, isExcludedBrand } from "./brand-policy";
import { cardVisual } from "./visual";
import { catalogPolicy, pricedModelSql, publishedModelSql, reliableOfferSql } from "./catalog-policy";
import fs from "node:fs";
import path from "node:path";
import { modelSlug } from "./text";
import type { CandidateModel, ConfigLite, OfferLite } from "./engine";
import type { SupportRow } from "./support";
import type { BrandAliasInfo } from "./text";
import { estimateMarket, type MarketEstimate } from "./market";

export interface BrandRow {
  id: string;
  name: string;
  parent_id: string | null;
  origin_country: string | null;
  origin_note: string | null;
  owner_group: string | null;
  headquarters: string | null;
  source_url: string | null;
  aliases: string;
}

export interface ModelRow {
  id: string;
  name: string;
  brand_id: string;
  brand_name: string;
  series_id: string | null;
  series_name: string | null;
  os: "ios" | "android" | null;
  form_factor: string | null;
  release_date: string | null;
  release_scope: string;
  release_source: string | null;
  release_level: string;
  fr_status: string;
  fr_source: string | null;
  discontinued: number;
}

export interface MediaRow {
  id: number;
  model_id: string;
  kind: "photo" | "3d";
  view: string | null;
  url: string;
  thumb_url: string | null;
  color: string | null;
  license: string;
  author: string | null;
  source_url: string;
  provider: string;
  checked_at: string;
  quality: string | null;
}

export interface SpecRow {
  key: string;
  value: string;
  kind: "annonce" | "mesure";
  source_name: string;
  source_url: string | null;
  checked_at: string | null;
  level: string;
}

export interface OfferRow extends OfferLite {
  config_id: string;
  color: string | null;
  source: string;
}

const db = () => getDb();
// node:sqlite renvoie des objets sans prototype : on les copie en objets ordinaires (sérialisables vers le client).
const rows = <T>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).all(...p).map((r) => ({ ...r })) as unknown as T[];
const row = <T>(sql: string, ...p: (string | number | null)[]) => {
  const r = db().prepare(sql).get(...p);
  return (r ? { ...r } : undefined) as unknown as T | undefined;
};

// Modèles visibles sur le site : marques non exclues ET, selon catalog-policy.json, au moins une offre fiable.
// Calculé à chaque requête (la fraîcheur des offres dépend de la date du jour).
const MODEL_SELECT = () => `SELECT m.id, m.name, m.brand_id, b.name AS brand_name, m.series_id, s.name AS series_name, m.os, m.form_factor,
  m.release_date, m.release_scope, m.release_source, m.release_level, m.fr_status, m.fr_source, m.discontinued
  FROM models m JOIN brands b ON b.id=m.brand_id LEFT JOIN series s ON s.id=m.series_id
  WHERE m.is_test=0 AND ${excludedSql("m.brand_id")} AND ${publishedModelSql()}`;

export function brands(): BrandRow[] {
  return rows<BrandRow>(`SELECT * FROM brands WHERE ${excludedSql("id")} ORDER BY name COLLATE NOCASE`);
}

export function brandAliases(): BrandAliasInfo[] {
  return brands().map((b) => ({ id: b.id, name: b.name, parent_id: b.parent_id, aliases: JSON.parse(b.aliases) }));
}

export function seriesList(): { id: string; brand_id: string; name: string; n: number }[] {
  return rows(`SELECT s.id, s.brand_id, s.name, COUNT(m.id) n FROM series s JOIN models m ON m.series_id=s.id AND m.is_test=0 AND ${excludedSql("m.brand_id")}
    AND ${publishedModelSql()} GROUP BY s.id ORDER BY s.name COLLATE NOCASE`);
}

export function allModels(): ModelRow[] {
  return rows<ModelRow>(`${MODEL_SELECT()} ORDER BY COALESCE(m.release_date,'0000') DESC, m.name`);
}

export function getModel(id: string): ModelRow | undefined {
  return row<ModelRow>(`${MODEL_SELECT()} AND m.id=?`, id);
}

export function getBrand(id: string) {
  return isExcludedBrand(id) ? undefined : row<BrandRow>("SELECT * FROM brands WHERE id=?", id);
}

export function specsFor(id: string): SpecRow[] {
  return rows<SpecRow>("SELECT key, value, kind, source_name, source_url, checked_at, level FROM specs WHERE model_id=?", id);
}

export function specMap(list: SpecRow[], kind: "annonce" | "mesure" = "annonce"): Record<string, unknown> {
  return Object.fromEntries(list.filter((s) => s.kind === kind).map((s) => [s.key, JSON.parse(s.value)]));
}

export function supportFor(id: string): SupportRow | null {
  return row<SupportRow>("SELECT * FROM support WHERE model_id=?", id) ?? null;
}

export function mediaFor(id: string): MediaRow[] {
  return rows<MediaRow>(`SELECT * FROM media WHERE model_id=? ORDER BY CASE view WHEN 'face' THEN 0 WHEN 'dos' THEN 1 WHEN 'profil' THEN 2 ELSE 3 END, id`, id);
}

/** Visuel de vignette par modèle : détouré autorisé d'abord, puis une photo libre utilisable en miniature, sinon la première. */
export function thumbnails(): Map<string, MediaRow> {
  const all = new Map<string, MediaRow[]>();
  for (const r of rows<MediaRow>(`SELECT * FROM media WHERE kind='photo' ORDER BY CASE quality WHEN 'detoure' THEN 0 ELSE 1 END, CASE view WHEN 'face' THEN 0 WHEN 'dos' THEN 1 WHEN 'autre' THEN 2 ELSE 3 END, id`))
    all.set(r.model_id, [...(all.get(r.model_id) ?? []), r]);
  const m = new Map<string, MediaRow>();
  for (const [id, list] of all) {
    const v = cardVisual(list, null);
    const pick = v.type === "photo" ? list.find((x) => (x.thumb_url ?? x.url) === v.src) : undefined;
    m.set(id, pick ?? list[0]);
  }
  return m;
}

function mapOffer(o: Record<string, unknown>): OfferRow {
  return { ...(o as unknown as OfferRow), available: !!o.available };
}

export function configsFor(id: string): (ConfigLite & { offers: OfferRow[] })[] {
  const cfgs = rows<{ id: string; storage_gb: number; ram_gb: number | null }>("SELECT * FROM configs WHERE model_id=? ORDER BY storage_gb", id);
  return cfgs.map((c) => ({
    ...c,
    offers: rows<Record<string, unknown>>("SELECT * FROM offers WHERE config_id=? AND is_test=0 ORDER BY price", c.id).map(mapOffer),
  }));
}

export function marketFor(configId: string, today: Date): MarketEstimate {
  const obs = rows<{ id: string; price: number; observed_at: string; excluded_reason: string | null }>(
    "SELECT id, price, observed_at, excluded_reason FROM market_observations WHERE config_id=? AND is_test=0",
    configId,
  );
  return estimateMarket(obs, today);
}

/** Tous les modèles qui ont au moins une offre (les seuls recommandables), prêts pour le moteur. */
export function candidates(): CandidateModel[] {
  const ids = rows<{ id: string }>(`SELECT DISTINCT c.model_id id FROM offers o JOIN configs c ON c.id=o.config_id
    JOIN models m ON m.id=c.model_id WHERE o.is_test=0 AND m.is_test=0 AND ${excludedSql("m.brand_id")} AND ${publishedModelSql()}`);
  const policy = catalogPolicy();
  const thumbs = thumbnails();
  return ids.map(({ id }) => {
    const m = getModel(id)!;
    const sp = specsFor(id);
    return {
      id, name: m.name, brand_id: m.brand_id, brand_name: m.brand_name, os: m.os, form_factor: m.form_factor,
      image: thumbs.get(id)?.thumb_url ?? null, specs: specMap(sp), measured: specMap(sp, "mesure"),
      support: supportFor(id),
      // Un prix « à partir de » n'est pas rattaché à une capacité : écarté si la règle de publication l'exige.
      configs: configsFor(id).map((c) => ({ ...c, offers: c.offers.filter((o) => policy.acceptStartingPrices || o.capacity_status !== "prix_de_depart") })),
    };
  });
}

export interface ModelSummary extends ModelRow {
  thumb: MediaRow | null;
  minNew: number | null;
  minRefurb: number | null;
  security_end: string | null;
  security_end_precision: string | null;
  security_end_confirmed: number;
  specs: Record<string, unknown>;
  storages: number[];
  officialSpecs: boolean;
  supportLevel: string | null;
  /** Caractéristiques relevées sur une source officielle (seules mises en avant sur les cartes). */
  reliable: Record<string, unknown>;
  /** Offres connues mais trop anciennes ou indisponibles : « Prix à actualiser ». */
  staleOffers: number;
  /** Sans prix fiable : ce qu'on sait quand même (rupture chez le vendeur, prix « à partir de », prix ancien). */
  priceNote: { kind: "rupture" | "depart" | "ancien"; price: number; seller: string } | null;
}

/** Données légères pour le catalogue (une requête par table, pas par modèle). */
export function catalogSummaries(): ModelSummary[] {
  const thumbs = thumbnails();
  const prices = new Map<string, { neuf: number | null; reco: number | null }>();
  for (const r of rows<{ model_id: string; condition: string; p: number }>(`SELECT c.model_id, o.condition, MIN(o.price) p FROM offers o
      JOIN configs c ON c.id=o.config_id WHERE ${reliableOfferSql(catalogPolicy())}
      GROUP BY c.model_id, o.condition`)) {
    const e = prices.get(r.model_id) ?? { neuf: null, reco: null };
    if (r.condition === "neuf") e.neuf = r.p;
    if (r.condition === "reconditionne") e.reco = r.p;
    prices.set(r.model_id, e);
  }
  const sup = new Map(rows<{ model_id: string; security_end: string | null; security_end_precision: string | null; security_end_confirmed: number; level: string }>(
    "SELECT model_id, security_end, security_end_precision, security_end_confirmed, level FROM support").map((s) => [s.model_id, s]));
  const official = new Set(rows<{ model_id: string }>("SELECT DISTINCT model_id FROM specs WHERE level='officiel'").map((r) => r.model_id));
  const specs = new Map<string, Record<string, unknown>>();
  const reliable = new Map<string, Record<string, unknown>>();
  for (const s of rows<{ model_id: string; key: string; value: string; level: string }>("SELECT model_id, key, value, level FROM specs WHERE kind='annonce'")) {
    const o = specs.get(s.model_id) ?? {};
    o[s.key] = JSON.parse(s.value);
    specs.set(s.model_id, o);
    if (s.level === "officiel" || s.level === "autorise") {
      const r = reliable.get(s.model_id) ?? {};
      r[s.key] = JSON.parse(s.value);
      reliable.set(s.model_id, r);
    }
  }
  const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
  const fresh = new Set(rows<{ model_id: string }>(`SELECT DISTINCT c.model_id FROM offers o JOIN configs c ON c.id=o.config_id
    WHERE o.available=1 AND o.is_test=0 AND o.is_demo=0 AND o.checked_at >= ?`, cutoff).map((r) => r.model_id));
  const staleCount = new Map(rows<{ model_id: string; n: number }>(`SELECT c.model_id, COUNT(*) n FROM offers o JOIN configs c ON c.id=o.config_id
    WHERE o.is_test=0 GROUP BY c.model_id`).map((r) => [r.model_id, r.n]));
  // Dernière information de prix non fiable, par ordre d'intérêt : rupture récente, prix de départ récent, prix ancien.
  const notes = new Map<string, ModelSummary["priceNote"]>();
  for (const r of rows<{ model_id: string; kind: "rupture" | "depart" | "ancien"; price: number; seller: string }>(`
      SELECT c.model_id, CASE WHEN o.checked_at < ? THEN 'ancien' WHEN o.stock='rupture' THEN 'rupture' ELSE 'depart' END kind, o.price, o.seller
      FROM offers o JOIN configs c ON c.id=o.config_id
      WHERE o.is_test=0 AND o.is_demo=0 AND COALESCE(o.variant_check,'')<>'ecart'
      ORDER BY CASE WHEN o.checked_at < ? THEN 2 WHEN o.stock='rupture' THEN 0 ELSE 1 END, o.price`, cutoff, cutoff))
    if (!notes.has(r.model_id)) notes.set(r.model_id, { kind: r.kind, price: r.price, seller: r.seller });
  const storages = new Map<string, number[]>();
  for (const c of rows<{ model_id: string; storage_gb: number }>("SELECT model_id, storage_gb FROM configs ORDER BY storage_gb")) {
    storages.set(c.model_id, [...(storages.get(c.model_id) ?? []), c.storage_gb]);
  }
  return allModels().map((m) => {
    const s = sup.get(m.id);
    return {
      ...m, thumb: thumbs.get(m.id) ?? null, minNew: prices.get(m.id)?.neuf ?? null, minRefurb: prices.get(m.id)?.reco ?? null,
      security_end: s?.security_end ?? null, security_end_precision: s?.security_end_precision ?? null, security_end_confirmed: s?.security_end_confirmed ?? 0,
      specs: specs.get(m.id) ?? {}, storages: storages.get(m.id) ?? [],
      officialSpecs: official.has(m.id), supportLevel: s?.level ?? null,
      reliable: reliable.get(m.id) ?? {},
      staleOffers: fresh.has(m.id) ? 0 : staleCount.get(m.id) ?? 0,
      priceNote: prices.has(m.id) ? null : notes.get(m.id) ?? null,
    };
  });
}

export function coverage() {
  const byBrand = rows<{ brand: string; brand_id: string; n: number; confirmed: number; with_specs: number; with_official: number; with_media: number; with_offers: number }>(`
    SELECT b.name brand, b.id brand_id, COUNT(m.id) n, SUM(m.fr_status='confirme') confirmed,
      SUM(EXISTS(SELECT 1 FROM specs s WHERE s.model_id=m.id AND s.level IN ('officiel','autorise'))) with_official,
      SUM(EXISTS(SELECT 1 FROM specs s WHERE s.model_id=m.id)) with_specs,
      SUM(EXISTS(SELECT 1 FROM media d WHERE d.model_id=m.id)) with_media,
      SUM(EXISTS(SELECT 1 FROM offers o JOIN configs c ON c.id=o.config_id WHERE c.model_id=m.id AND o.available=1)) with_offers
    FROM brands b LEFT JOIN models m ON m.brand_id=b.id AND m.is_test=0 WHERE ${excludedSql("b.id")} GROUP BY b.id ORDER BY n DESC`);
  const bySeries = rows<{ brand: string; series: string; n: number }>(`SELECT b.name brand, s.name series, COUNT(m.id) n FROM models m
    JOIN brands b ON b.id=m.brand_id JOIN series s ON s.id=m.series_id WHERE m.is_test=0 AND ${excludedSql("m.brand_id")} GROUP BY s.id ORDER BY b.name, s.name`);
  const byYear = rows<{ year: string; n: number }>(`SELECT COALESCE(substr(release_date,1,4),'inconnue') year, COUNT(*) n FROM models m
    WHERE is_test=0 AND ${excludedSql("m.brand_id")} GROUP BY year ORDER BY year`);
  const runs = rows<{ source: string; finished_at: string | null; status: string; added: number; updated: number; notes: string | null }>(`
    SELECT r.source, r.finished_at, r.status, r.added, r.updated, r.notes FROM import_runs r
    WHERE r.id = (SELECT MAX(id) FROM import_runs r2 WHERE r2.source=r.source) ORDER BY r.finished_at DESC`);
  const totals = row<{ models: number; published: number; priced: number; offers: number; media: number; officialSpecs: number; officialSupport: number; editorialSpecs: number }>(`SELECT
    (SELECT COUNT(DISTINCT model_id) FROM specs WHERE level IN ('officiel','autorise')) officialSpecs,
    (SELECT COUNT(*) FROM support WHERE level IN ('officiel','autorise')) officialSupport,
    (SELECT COUNT(DISTINCT model_id) FROM specs WHERE level='editorial' AND key<>'chip_tier' AND model_id NOT IN (SELECT model_id FROM specs WHERE level IN ('officiel','autorise'))) editorialSpecs,
    (SELECT COUNT(*) FROM models m WHERE is_test=0 AND ${excludedSql("m.brand_id")}) models,
    (SELECT COUNT(*) FROM models m WHERE is_test=0 AND ${excludedSql("m.brand_id")} AND ${publishedModelSql()}) published,
    (SELECT COUNT(*) FROM models m WHERE is_test=0 AND ${excludedSql("m.brand_id")} AND ${pricedModelSql()}) priced,
    (SELECT COUNT(*) FROM offers WHERE available=1 AND is_test=0) offers,
    (SELECT COUNT(DISTINCT model_id) FROM media) media`)!;
  return { byBrand, bySeries, byYear, runs, totals };
}

export function lastUpdate(): string | null {
  return row<{ t: string | null }>("SELECT MAX(finished_at) t FROM import_runs WHERE status='ok'")?.t ?? null;
}

export const MERCHANT_SOURCES = ["Apple Store FR (neuf)", "Apple reconditionné FR", "Samsung Shop FR", "Xiaomi Store FR", "Google Store FR"];

/** Dernier relevé réussi de chaque source marchande ; un échec ultérieur ne le remplace pas. */
export function merchantSyncs(): { source: string; lastOk: string | null; lastFailed: boolean }[] {
  return MERCHANT_SOURCES.map((source) => {
    const ok = row<{ t: string | null }>("SELECT MAX(finished_at) t FROM import_runs WHERE source=? AND status='ok'", source)?.t ?? null;
    const last = row<{ status: string }>("SELECT status FROM import_runs WHERE source=? ORDER BY id DESC LIMIT 1", source);
    return { source, lastOk: ok, lastFailed: last?.status === "echec" };
  });
}

/** Inventaire REDMI France (data/sources/redmi-fr.json) comparé au catalogue. */
export function redmiInventoryStatus() {
  const inv = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sources", "redmi-fr.json"), "utf8")) as {
    sources: string[]; models: { tag: string; name: string; family: string; year: number | null }[]; to_check: { name: string; reason: string }[];
  };
  const ids = new Set(rows<{ id: string }>("SELECT id FROM models WHERE brand_id='redmi' AND is_test=0").map((r) => r.id));
  const families = ["REDMI", "REDMI Note", "REDMI A", "REDMI C"];
  const years = [...new Set(inv.models.map((m) => (m.year === null ? "non publiée" : String(m.year))))].sort();
  return {
    sources: inv.sources,
    inventory: inv.models.map((m) => ({ ...m, year: m.year === null ? null : String(m.year) })),
    inCatalog: inv.models.filter((m) => ids.has(modelSlug("REDMI", m.name))).length,
    families, years, toCheck: inv.to_check,
    excluded: [...excludedBrands()].map((b) => ({ hmd: "HMD", tcl: "TCL" })[b] ?? b[0].toUpperCase() + b.slice(1)),
  };
}
