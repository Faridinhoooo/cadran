/* eslint-disable @typescript-eslint/no-explicit-any -- JSON externes non typés (API publiques, pages boutiques) */
/**
 * Import réexécutable du catalogue.
 *   npm run import                 → toutes les sources
 *   npm run import -- --only=offers  (brands,eol,editorial,specs,media,offers)
 *   npm run import -- --refresh-media
 *
 * Idempotent : chaque enregistrement a un identifiant stable (slug, id d'offre), les UPSERT
 * mettent à jour sans dupliquer. Les offres d'une source qui ne sont plus vues sont marquées
 * indisponibles (elles sortent des recommandations, la fiche reste consultable).
 */
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { finalizeForDeploy, openDb } from "../src/lib/db";
import { isExcludedBrand } from "../src/lib/brand-policy";
import { modelSlug, normalize, slugify } from "../src/lib/text";
import { fetchIcecat, importIcecat, mapIcecat } from "./icecat";
import { ebayConfigured, importEbayUsed } from "./ebay";
import { publishedModelSql } from "../src/lib/catalog-policy";
import { configuredFeeds, downloadFeed, feedToOffers, parseCsv, toFeedRow, type FeedRow } from "./feeds";
import { importAppleSpecs, importGoogleSpecs, importGoogleSupport, importSamsungSpecs, importXiaomiSpecs, verifyAppleNoDeadline, flatText, parseXiaomiSpecs, upsertSpec } from "./official";

const ROOT = process.cwd();

// Clés privées : .env.local (ignoré par git, jamais envoyé au navigateur). Les variables déjà définies priment.
for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}
const SRC = path.join(ROOT, "data", "sources");
const UA = "Mozilla/5.0 (compatible; catalogue-smartphones-import/1.0)";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const want = (s: string) => !only || only.includes(s);
const refreshMedia = args.includes("--refresh-media");

const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));

async function get(url: string, browser = false): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": browser ? BROWSER_UA : UA, "Accept-Language": "fr-FR,fr;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

export function startRun(db: DatabaseSync, source: string) {
  const r = db.prepare("INSERT INTO import_runs (source, started_at, status) VALUES (?, ?, 'en_cours')").run(source, now());
  const id = Number(r.lastInsertRowid);
  const stats = { added: 0, updated: 0, notes: [] as string[] };
  return {
    stats,
    finish(status = "ok") {
      db.prepare("UPDATE import_runs SET finished_at=?, status=?, added=?, updated=?, notes=? WHERE id=?").run(
        now(), status, stats.added, stats.updated, stats.notes.join("\n").slice(0, 4000), id,
      );
      console.log(`[${source}] ${status} — ajoutés ${stats.added}, mis à jour ${stats.updated}${stats.notes.length ? ` — ${stats.notes.length} note(s)` : ""}`);
    },
  };
}

// ───────────────────────── Marques ─────────────────────────
function importBrands(db: DatabaseSync) {
  const run = startRun(db, "marques");
  const { brands } = readJson("brands.json");
  const st = db.prepare(`INSERT INTO brands (id, name, parent_id, origin_country, origin_note, owner_group, headquarters, source_url, aliases)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, parent_id=excluded.parent_id,
    origin_country=excluded.origin_country, origin_note=excluded.origin_note, owner_group=excluded.owner_group,
    headquarters=excluded.headquarters, source_url=excluded.source_url, aliases=excluded.aliases`);
  for (const b of brands) {
    if (isExcludedBrand(b.id)) continue;
    st.run(b.id, b.name, b.parent_id ?? null, b.origin_country, b.origin_note ?? null, b.owner_group, b.headquarters ?? null, b.source_url, JSON.stringify(b.aliases ?? []));
    run.stats.updated++;
  }
  run.finish();
}

// ───────────────────────── Modèles ─────────────────────────
interface ModelInput {
  brand: string;
  brandName: string;
  name: string;
  series: string;
  os: "ios" | "android";
  form: string;
  release: string | null;
  releaseSource: string;
  frStatus: "confirme" | "a_verifier";
  frSource?: string | null;
  discontinued?: boolean;
  releaseLevel?: "communautaire" | "editorial" | "officiel";
}

function upsertModel(db: DatabaseSync, m: ModelInput, stats: { added: number; updated: number }): string {
  const id = modelSlug(m.brandName, m.name);
  const seriesId = `${m.brand}-${slugify(m.series)}`;
  db.prepare("INSERT INTO series (id, brand_id, name) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name").run(seriesId, m.brand, m.series);
  const exists = db.prepare("SELECT fr_status FROM models WHERE id=?").get(id) as { fr_status: string } | undefined;
  const family = m.name.replace(/\s+(4G|5G)$/i, "");
  if (exists) {
    // On ne rétrograde jamais un statut « confirmé » obtenu par une autre source (ex. boutique FR).
    const fr = exists.fr_status === "confirme" ? "confirme" : m.frStatus;
    db.prepare(`UPDATE models SET series_id=?, name=?, family=?, os=?, form_factor=?, fr_status=?, fr_source=COALESCE(?, fr_source),
      discontinued=?, updated_at=? WHERE id=?`).run(seriesId, m.name, family, m.os, m.form, fr, m.frSource ?? null, m.discontinued ? 1 : 0, now(), id);
    // Une date relevée sur une source officielle n'est jamais écrasée par une source moins fiable.
    if (m.release)
      db.prepare(`UPDATE models SET release_date=?, release_scope='monde', release_source=?, release_level=? WHERE id=? AND release_level <> 'officiel'`).run(
        m.release, m.releaseSource, m.releaseLevel ?? "communautaire", id,
      );
    stats.updated++;
  } else {
    db.prepare(`INSERT INTO models (id, brand_id, series_id, name, family, os, form_factor, release_date, release_scope, release_source,
      fr_status, fr_source, discontinued, created_at, updated_at, release_level) VALUES (?,?,?,?,?,?,?,?, 'monde', ?,?,?,?,?,?,?)`).run(
      id, m.brand, seriesId, m.name, family, m.os, m.form, m.release, m.releaseSource, m.frStatus, m.frSource ?? null, m.discontinued ? 1 : 0, now(), now(),
      m.releaseLevel ?? "communautaire",
    );
    stats.added++;
  }
  return id;
}

const EOL_PRODUCTS: Record<string, { brand: string; brandName: string }> = {
  iphone: { brand: "apple", brandName: "Apple" },
  "samsung-mobile": { brand: "samsung", brandName: "Samsung" },
  pixel: { brand: "google", brandName: "Google" },
  oneplus: { brand: "oneplus", brandName: "OnePlus" },
  "motorola-mobility": { brand: "motorola", brandName: "Motorola" },
  fairphone: { brand: "fairphone", brandName: "Fairphone" },
  nokia: { brand: "nokia", brandName: "Nokia" },
};

/** Règles documentées d'exclusion : séries non distribuées en France ou appareils qui ne sont pas des téléphones. */
function excludedFromFrance(product: string, label: string): string | null {
  if (/\b(pad|tablet)\b/i.test(label)) return "tablette";
  if (product === "samsung-mobile") {
    if (/^Galaxy [MFC]\d/i.test(label) || /^W\d/i.test(label)) return "série Samsung non distribuée en France (M, F, C, W)";
  }
  if (product === "motorola-mobility") {
    if (/Play|Stylus|Power 5G \(|G Power \(|Moto G \(20|Moto G 5G \(|edge 20\d\d|Edge \(2023\)|Edge\+ \(2023\)|razr\+|Razr \d{4}|Razr \(2023\)|razr Ultra 20|Razr Ultra 20|G53J|G53Y|G64Y|Razr 50d|Razr 60d|Edge 60 Stylus|razr Fold 2026/i.test(label))
      return "modèle Motorola destiné à un autre marché (États-Unis, Japon, Inde)";
  }
  if (product === "oneplus" && /^13T$/.test(label)) return "OnePlus 13T commercialisé en Chine";
  return null;
}

function seriesFor(product: string, name: string): { series: string; form: string } {
  const n = name;
  switch (product) {
    case "iphone": {
      if (/Duo/i.test(n)) return { series: "iPhone pliable", form: "pliable" };
      const g = n.match(/iPhone (\d+)/)?.[1];
      return { series: g ? `iPhone ${g}` : "iPhone", form: "classique" };
    }
    case "samsung-mobile":
      if (/Z Fold|TriFold/i.test(n)) return { series: "Galaxy Z Fold", form: "pliable" };
      if (/Z Flip/i.test(n)) return { series: "Galaxy Z Flip", form: "clapet" };
      if (/XCover/i.test(n)) return { series: "Galaxy XCover", form: "durci" };
      if (/Galaxy S/i.test(n)) return { series: "Galaxy S", form: "classique" };
      if (/Galaxy A/i.test(n)) return { series: "Galaxy A", form: "classique" };
      return { series: "Galaxy (autres)", form: "classique" };
    case "pixel":
      if (/Fold/i.test(n)) return { series: "Pixel Fold", form: "pliable" };
      if (/\d+a$/i.test(n)) return { series: "Pixel a", form: "classique" };
      return { series: "Pixel", form: "classique" };
    case "oneplus":
      if (/\d+R$/i.test(n)) return { series: "Série R", form: "classique" };
      return { series: "Série numérotée", form: "classique" };
    case "motorola":
    case "motorola-mobility":
      if (/razr fold/i.test(n)) return { series: "razr", form: "pliable" };
      if (/razr/i.test(n)) return { series: "razr", form: "clapet" };
      if (/edge/i.test(n)) return { series: "edge", form: "classique" };
      if (/thinkphone/i.test(n)) return { series: "ThinkPhone", form: "durci" };
      if (/moto e/i.test(n)) return { series: "moto e", form: "classique" };
      return { series: "moto g", form: "classique" };
    case "nokia":
      if (/XR/i.test(n)) return { series: "Nokia XR", form: "durci" };
      if (/Nokia G/i.test(n)) return { series: "Nokia G", form: "classique" };
      return { series: "Nokia C", form: "classique" };
    case "xiaomi":
      if (/^Redmi Note/i.test(n)) return { series: "REDMI Note", form: "classique" };
      if (/^Redmi A/i.test(n)) return { series: "REDMI A", form: "classique" };
      if (/^Redmi \d+C\b/i.test(n)) return { series: "REDMI C", form: "classique" };
      if (/^Redmi/i.test(n)) return { series: "REDMI", form: "classique" };
      if (/^POCO ([CMXF])/i.test(n)) return { series: `POCO ${n.match(/^POCO ([CMXF])/i)![1].toUpperCase()}`, form: "classique" };
      if (/Ultra/i.test(n)) return { series: "Xiaomi Ultra", form: "classique" };
      if (/^Xiaomi \d+T/i.test(n)) return { series: "Xiaomi T", form: "classique" };
      return { series: "Xiaomi (série numérotée)", form: "classique" };
    default:
      return { series: "Fairphone", form: "classique" };
  }
}

function displayName(product: string, label: string): string {
  if (product === "iphone") return `iPhone ${label}`;
  if (product === "oneplus" && !/^OnePlus/i.test(label)) return `OnePlus ${label}`;
  if (product === "pixel" && !/^Pixel/i.test(label)) return `Pixel ${label}`;
  if (product === "motorola-mobility") return label.replace(/^Motorola Moto /i, "Moto ").replace(/^moto /, "Moto ");
  return label;
}

function versionsRange(s: string | undefined | null): { first: string | null; last: string | null } {
  if (!s) return { first: null, last: null };
  const parts = String(s).split("-").map((x) => x.trim()).filter(Boolean);
  return { first: parts[0] ?? null, last: parts[parts.length - 1] ?? null };
}

async function importEol(db: DatabaseSync) {
  const run = startRun(db, "endoflife.date");
  const specs = readJson("specs.json");
  const policies = specs.policies;
  for (const [product, info] of Object.entries(EOL_PRODUCTS)) {
    if (isExcludedBrand(info.brand)) continue;
    let data: { result: { releases: Record<string, unknown>[]; links: { releasePolicy: string | null; html: string } } };
    try {
      data = JSON.parse(await get(`https://endoflife.date/api/v1/products/${product}/`));
    } catch (e) {
      run.stats.notes.push(`${product}: ${(e as Error).message}`);
      continue;
    }
    for (const r of data.result.releases as Record<string, any>[]) {
      if (!r.releaseDate || r.releaseDate < "2023-01-01") continue;
      const excluded = excludedFromFrance(product, r.label);
      if (excluded) {
        run.stats.notes.push(`exclu : ${r.label} (${excluded})`);
        continue;
      }
      const name = displayName(product, r.label);
      const { series, form } = seriesFor(product, name);
      const id = upsertModel(db, {
        brand: info.brand, brandName: info.brandName, name, series, form,
        os: product === "iphone" ? "ios" : "android",
        release: r.releaseDate, releaseSource: `endoflife.date (${data.result.links.html})`,
        frStatus: "a_verifier", discontinued: !!r.isDiscontinued,
      }, run.stats);

      // Suivi logiciel
      const custom = (r.custom ?? {}) as Record<string, string>;
      const vers = versionsRange(custom.supportedIosVersions ?? custom.supportedAndroidVersions ?? custom.supportedOxygenOSVersions);
      const osName = product === "iphone" ? "iOS" : product === "oneplus" && custom.supportedOxygenOSVersions ? "OxygenOS" : "Android";
      const monthPrecision = product === "pixel" || product === "samsung-mobile";
      let policy = { text: null as string | null, url: data.result.links.releasePolicy, years: null as number | null };
      if (product === "iphone") policy = { ...policies.apple, years: null };
      else if (product === "samsung-mobile") {
        const gen = Number(name.match(/S(\d+)|Fold(\d+)|Flip(\d+)/i)?.slice(1).find(Boolean) ?? 0);
        const flagship = /Galaxy S\d+/i.test(name) ? gen >= 24 : /Z (Fold|Flip)/i.test(name) ? gen >= 6 : false;
        policy = flagship ? { ...policies["samsung-flagship-7y"] } : { ...policies["samsung-generic"], years: null };
      } else if (product === "pixel") {
        const gen = Number(name.match(/Pixel (\d+)/)?.[1] ?? 0);
        policy = gen >= 8 || /Fold/.test(name) && gen >= 9 ? { ...policies["google-7y"] } : { ...policies["google-pre8"] };
      } else if (product === "oneplus") policy = { ...policies.oneplus, years: null };
      else if (product === "motorola-mobility") policy = { ...policies.motorola, years: null };
      else if (product === "fairphone") policy = { ...policies.fairphone, years: null };
      else if (product === "nokia") policy = { ...policies.nokia, years: null };

      db.prepare(`INSERT INTO support (model_id, os_launch, os_latest_verified, upgrade_commitment, upgrade_end, upgrade_end_precision,
        security_years, security_end, security_end_precision, security_end_confirmed, source_name, source_url, policy_url, checked_at)
        VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?)
        ON CONFLICT(model_id) DO UPDATE SET os_launch=excluded.os_launch, os_latest_verified=excluded.os_latest_verified,
        upgrade_commitment=excluded.upgrade_commitment, upgrade_end=excluded.upgrade_end, upgrade_end_precision=excluded.upgrade_end_precision,
        security_years=excluded.security_years, security_end=excluded.security_end, security_end_precision=excluded.security_end_precision,
        source_name=excluded.source_name, source_url=excluded.source_url, policy_url=excluded.policy_url, checked_at=excluded.checked_at
        WHERE support.level NOT IN ('officiel', 'absence_verifiee')`).run(
        id,
        vers.first ? `${osName} ${vers.first}` : null,
        vers.last ? `${osName} ${vers.last}` : null,
        policy.text,
        r.eoasFrom ?? null,
        r.eoasFrom ? (monthPrecision ? "mois" : "jour") : null,
        policy.years ?? null,
        r.eolFrom ?? null,
        r.eolFrom ? (monthPrecision ? "mois" : "jour") : null,
        "endoflife.date (données communautaires sourcées sur les politiques constructeurs)",
        data.result.links.html,
        policy.url ?? data.result.links.releasePolicy,
        today(),
      );
    }
  }
  run.finish();
}

function importEditorial(db: DatabaseSync) {
  const run = startRun(db, "liste éditoriale");
  const ed = readJson("editorial-models.json");
  const brands = new Map((readJson("brands.json").brands as { id: string; name: string }[]).map((b) => [b.id, b.name]));
  for (const [brand, list] of Object.entries(ed.brands as Record<string, [string, string, string, string][]>)) {
    if (isExcludedBrand(brand)) continue;
    for (const [name, series, date, form] of list) {
      upsertModel(db, {
        brand, brandName: brands.get(brand) ?? brand, name, series, form, os: "android",
        release: date, releaseSource: ed.source_name, frStatus: "a_verifier", releaseLevel: "editorial",
      }, run.stats);
    }
  }
  run.finish();
}

function importSpecs(db: DatabaseSync) {
  const run = startRun(db, "caractéristiques constructeur");
  const s = readJson("specs.json");
  const fields: string[] = s.fields;
  const upsert = db.prepare(`INSERT INTO specs (model_id, key, value, kind, source_name, source_url, checked_at) VALUES (?,?,?,'annonce',?,?,NULL)
    ON CONFLICT(model_id, key, kind) DO UPDATE SET value=excluded.value, source_name=excluded.source_name, source_url=excluded.source_url
    WHERE specs.level = 'editorial'`);
  for (const [id, values] of Object.entries(s.models as Record<string, unknown[]>)) {
    const model = db.prepare("SELECT brand_id FROM models WHERE id=?").get(id) as { brand_id: string } | undefined;
    if (!model) {
      run.stats.notes.push(`fiche absente pour ${id}`);
      continue;
    }
    const url = s.brand_spec_urls[model.brand_id] ?? null;
    fields.forEach((f, i) => {
      const v = values[i];
      if (v === null || v === undefined || f === "storage") return;
      upsert.run(id, f, JSON.stringify(v), s.source_name, url);
    });
    const chip = values[fields.indexOf("chip")] as string | null;
    if (chip && s.chip_tiers[chip]) upsert.run(id, "chip_tier", JSON.stringify(s.chip_tiers[chip]), "Classement éditorial des puces (indicatif)", null);
    const ram = values[fields.indexOf("ram_gb")] as number | null;
    for (const gb of (values[fields.indexOf("storage")] as number[]) ?? []) {
      db.prepare("INSERT INTO configs (id, model_id, storage_gb, ram_gb) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET ram_gb=COALESCE(excluded.ram_gb, ram_gb)").run(`${id}-${gb}`, id, gb, ram);
    }
    run.stats.updated++;
  }
  run.finish();
}

// ───────────────────────── Médias (Wikimedia Commons) ─────────────────────────
const BAD_WORDS = /dummy|maquette|mock-?up|leak|concept|render|prototype|logo|box|boite|boîte|boot|screen|unboxing|about|settings|packag|receipt|store|keynote|event|\band\b|\bvs\b|comparison|case|coque|charger|cable|wallpaper|camera sample|sample|photo taken|shot on|taken with|chart|diagram|icon/i;
const OK_LICENSE = /^(CC0|Public domain|CC BY(-SA)? [\d.]+|CC BY(-SA)?)/i;
const SUFFIXES = ["pro", "plus", "max", "ultra", "fe", "lite", "mini", "edge", "fold", "flip", "a", "e", "xl", "neo", "s", "5g"];

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function fileMatchesModel(title: string, modelName: string): boolean {
  const t = ` ${normalize(title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""))} `;
  const m = normalize(modelName.replace(/^(Samsung|Apple|Google|Xiaomi|OPPO|HONOR|Sony|ASUS|Huawei|Crosscall|TCL)\s+/i, ""));
  const idx = t.indexOf(` ${m} `);
  if (idx < 0) return false;
  // Refuse « iPhone 15 Pro » quand on cherche « iPhone 15 »
  const after = t.slice(idx + m.length + 2).split(" ")[0];
  if (SUFFIXES.includes(after) && !m.split(" ").includes(after)) return false;
  return !BAD_WORDS.test(title);
}

function viewOf(title: string): string {
  if (/back|rear|arri|dos|verso/i.test(title)) return "dos";
  if (/front|face|avant/i.test(title)) return "face";
  if (/side|profil|edge view|thickness/i.test(title)) return "profil";
  return "autre";
}

async function importMedia(db: DatabaseSync) {
  const run = startRun(db, "Wikimedia Commons");
  const models = db.prepare(`SELECT m.id, m.name, m.release_date, b.name AS brand FROM models m JOIN brands b ON b.id=m.brand_id WHERE m.is_test=0`).all() as { id: string; name: string; brand: string; release_date: string | null }[];
  const recent = new Set(
    (db.prepare("SELECT DISTINCT model_id FROM media WHERE provider='Wikimedia Commons' AND checked_at > ?").all(new Date(Date.now() - 30 * 864e5).toISOString()) as { model_id: string }[]).map((r) => r.model_id),
  );
  // Détouré = image PNG/WebP (fond transparent) ; une photo JPEG est le plus souvent prise en magasin ou à la main.
  const ins = db.prepare(`INSERT INTO media (model_id, kind, view, url, thumb_url, color, license, author, source_url, provider, checked_at, uploaded_at, quality)
    VALUES (?, 'photo', ?, ?, ?, NULL, ?, ?, ?, 'Wikimedia Commons', ?, ?, CASE WHEN lower(?3) LIKE '%.png' OR lower(?3) LIKE '%.webp' THEN 'detoure' ELSE 'photo' END) ON CONFLICT(model_id, url) DO UPDATE SET checked_at=excluded.checked_at, license=excluded.license, author=excluded.author`);
  const todo = models.filter((m) => refreshMedia || !recent.has(m.id));
  let i = 0;
  let failures = 0;
  async function worker() {
    while (i < todo.length) {
      const m = todo[i++];
      const base = m.name.startsWith(m.brand) ? m.name : `${m.brand} ${m.name}`;
      const cats = [...new Set([base, m.name, m.name.replace(/^iPhone/, "IPhone")])].map((c) => `Category:${c.replace(/^iPhone/, "IPhone")}`);
      let found = 0;
      // On repart de zéro pour ce modèle : les photos qui ne passent plus les filtres disparaissent.
      db.prepare("DELETE FROM media WHERE model_id=? AND provider='Wikimedia Commons'").run(m.id);
      // Une photo envoyée avant la sortie montre souvent une maquette ou une fuite : exclue.
      const notBefore = m.release_date ? new Date(`${m.release_date.length === 7 ? m.release_date + "-01" : m.release_date}T00:00:00Z`) : null;
      for (const cat of cats) {
        if (found) break;
        const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file&gcmlimit=40&prop=imageinfo&iiprop=url|extmetadata|mime|timestamp&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|Artist`;
        let json: any = null;
        for (let attempt = 0; attempt < 4 && !json; attempt++) {
          try {
            json = JSON.parse(await get(url));
          } catch (e) {
            failures++;
            if (attempt === 3) run.stats.notes.push(`${cat} : ${(e as Error).message}`);
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          }
        }
        if (!json) continue;
        const pages = Object.values(json?.query?.pages ?? {}) as any[];
        const scored = pages
          .filter((p) => p.imageinfo?.[0] && /image\/(jpeg|png|webp)/.test(p.imageinfo[0].mime))
          .filter((p) => fileMatchesModel(p.title, m.name))
          .filter((p) => !notBefore || new Date(p.imageinfo[0].timestamp) >= notBefore)
          .map((p) => ({ p, view: viewOf(p.title) }))
          .sort((a, b) => (a.view === "autre" ? 1 : 0) - (b.view === "autre" ? 1 : 0));
        for (const { p, view } of scored.slice(0, 4)) {
          const ii = p.imageinfo[0];
          const lic = ii.extmetadata?.LicenseShortName?.value ?? "";
          if (!OK_LICENSE.test(lic)) continue;
          ins.run(m.id, view, ii.url, ii.thumburl ?? ii.url, lic, stripHtml(ii.extmetadata?.Artist?.value ?? "") || null, ii.descriptionurl, now(), ii.timestamp ?? null);
          found++;
        }
      }
      if (found) run.stats.added++;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  await Promise.all([worker(), worker()]);
  run.stats.notes.push(`${todo.length} modèles interrogés, ${failures} requêtes en erreur`);
  run.finish();
}

// ───────────────────────── Offres ─────────────────────────
export interface OfferInput {
  id: string;
  modelId: string;
  /** 0 = capacité non précisée par la source (prix de départ) : jamais attribuée à une capacité. */
  storageGb: number;
  capacityStatus?: "confirmee" | "prix_de_depart";
  condition: "neuf" | "reconditionne";
  seller: string;
  platform: string | null;
  price: number;
  /** null = inconnu. 0 uniquement si la gratuité est explicitement annoncée par le vendeur. */
  shipping: number | null;
  shippingStatus: "gratuite_annoncee" | "payante" | "inconnue";
  shippingNote: string | null;
  mandatoryFees: number | null;
  stock: "en_stock" | "rupture" | "inconnu";
  color: string | null;
  grade: string | null;
  batteryNote: string | null;
  warranty: string | null;
  returnsPolicy: string | null;
  url: string;
  source: string;
  /** Si le modèle n'est pas encore référencé, la boutique française suffit à créer sa fiche. */
  create?: { brand: string; brandName: string; name: string; product: string; os: "ios" | "android" };
}

/**
 * Enregistre le relevé RÉUSSI d'une source. Appelée uniquement après une lecture complète :
 * en cas d'échec, rien n'est modifié (dernier relevé et sa date conservés).
 */
export function saveOffers(db: DatabaseSync, source: string, offers: OfferInput[], stats: { added: number; updated: number; notes: string[] }) {
  if (!offers.length) throw new Error("aucune offre lue : relevé considéré en échec, données précédentes conservées");
  // Les offres de la source non revues dans ce relevé réussi passent indisponibles.
  db.prepare("UPDATE offers SET available=0 WHERE source=? AND is_test=0").run(source);
  for (const o of offers) {
    if (o.create && isExcludedBrand(o.create.brand)) continue;
    const model = db.prepare("SELECT id, brand_id FROM models WHERE id=?").get(o.modelId) as { id: string; brand_id: string } | undefined;
    if (model && isExcludedBrand(model.brand_id)) continue;
    if (!model) {
      if (!o.create) {
        stats.notes.push(`offre ignorée, modèle inconnu : ${o.modelId} ${o.storageGb} Go`);
        continue;
      }
      const { series, form } = seriesFor(o.create.product, o.create.name);
      upsertModel(db, {
        brand: o.create.brand, brandName: o.create.brandName, name: o.create.name, series, form, os: o.create.os,
        release: null, releaseSource: "Date de lancement non renseignée (modèle découvert dans une boutique française)",
        frStatus: "confirme", frSource: o.url,
      }, { added: 0, updated: 0 });
      stats.notes.push(`fiche créée depuis la boutique : ${o.create.name}`);
    }
    const configId = `${o.modelId}-${o.storageGb}`;
    db.prepare("INSERT INTO configs (id, model_id, storage_gb) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING").run(configId, o.modelId, o.storageGb);
    // Une offre française établit la vente en France à la date du relevé, pas la date de lancement.
    db.prepare("UPDATE models SET fr_status='confirme', fr_source=? WHERE id=?").run(`Vendu par ${o.seller} en France, relevé du ${now().slice(0, 10)} (${o.url})`, o.modelId);
    const exists = db.prepare("SELECT 1 FROM offers WHERE id=?").get(o.id);
    db.prepare(`INSERT INTO offers (id, config_id, condition, seller, platform, price, mandatory_fees, shipping, color, grade, battery_note,
      warranty, returns_policy, url, available, checked_at, source, is_test, market, stock, shipping_status, shipping_note, capacity_status, first_seen_at, is_demo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'FR',?,?,?,?,?,0)
      ON CONFLICT(id) DO UPDATE SET config_id=excluded.config_id, price=excluded.price, mandatory_fees=excluded.mandatory_fees, shipping=excluded.shipping,
      color=excluded.color, grade=excluded.grade, battery_note=excluded.battery_note, warranty=excluded.warranty,
      returns_policy=excluded.returns_policy, url=excluded.url, available=excluded.available, checked_at=excluded.checked_at,
      stock=excluded.stock, shipping_status=excluded.shipping_status, shipping_note=excluded.shipping_note, capacity_status=excluded.capacity_status`).run(
      o.id, configId, o.condition, o.seller, o.platform, o.price, o.mandatoryFees, o.shipping, o.color, o.grade, o.batteryNote,
      o.warranty, o.returnsPolicy, o.url, o.stock === "rupture" ? 0 : 1, now(), source,
      o.stock, o.shippingStatus, o.shippingNote, o.capacityStatus ?? "confirmee", now(),
    );
    if (exists) stats.updated++;
    else stats.added++;
  }
}

function plainText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");
}

function appleModelId(label: string): string {
  // « Air » est référencé « iPhone 17 Air » par endoflife.date
  const l = label.trim().replace(/^Air$/i, "17 Air");
  return modelSlug("Apple", `iPhone ${l}`);
}

async function importAppleStore(db: DatabaseSync) {
  const run = startRun(db, "Apple Store FR (neuf)");
  try {
    const buy = await get("https://www.apple.com/fr/shop/buy-iphone", true);
    const families = [...new Set(buy.match(/\/fr\/shop\/buy-iphone\/iphone-[a-z0-9-]+/g) ?? [])];
    const offers = new Map<string, OfferInput>();
    for (const fam of families) {
      const url = `https://www.apple.com${fam}`;
      const html = await get(url, true);
      const freeShipping = /Livraison gratuite/i.test(html);
      const metrics = html.match(/<script type="application\/json" id="metrics">([\s\S]*?)<\/script>/)?.[1];
      if (!metrics) {
        run.stats.notes.push(`pas de données produit : ${url}`);
        continue;
      }
      const products = (JSON.parse(metrics).data?.products ?? []) as { name: string; price: { fullPrice: number }; partNumber: string }[];
      for (const p of products) {
        const m = p.name.replace(/ /g, " ").match(/^iPhone (.+?) (\d+)(GB|TB) (.+)$/);
        if (!m || !p.price?.fullPrice) continue;
        const gb = Number(m[2]) * (m[3] === "TB" ? 1024 : 1);
        const modelId = appleModelId(m[1]);
        const key = `${modelId}-${gb}`;
        const prev = offers.get(key);
        if (prev && prev.price <= p.price.fullPrice) continue;
        offers.set(key, {
          id: `apple-store-fr:${key}`, modelId, storageGb: gb, condition: "neuf", seller: "Apple", platform: "apple.com/fr",
          price: p.price.fullPrice, shipping: freeShipping ? 0 : null, shippingStatus: freeShipping ? "gratuite_annoncee" : "inconnue",
          shippingNote: freeShipping ? "« Livraison gratuite » affiché sur la page Apple" : null, mandatoryFees: 0, stock: "inconnu",
          color: m[4], grade: null, batteryNote: null, warranty: null, returnsPolicy: null, url, source: "apple-store-fr",
          create: { brand: "apple", brandName: "Apple", name: `iPhone ${m[1].replace(/^Air$/i, "17 Air")}`, product: "iphone", os: "ios" },
        });
      }
    }
    saveOffers(db, "apple-store-fr", [...offers.values()], run.stats);
    run.finish();
  } catch (e) {
    run.stats.notes.push((e as Error).message);
    run.finish("echec");
  }
}

async function importAppleRefurb(db: DatabaseSync) {
  const run = startRun(db, "Apple reconditionné FR");
  const url = "https://www.apple.com/fr/shop/refurbished/iphone";
  try {
    const html = await get(url, true);
    const text = plainText(html);
    const freeShipping = /Livraison gratuite/i.test(text);
    const json = html.match(/window\.REFURB_GRID_BOOTSTRAP\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)?.[1];
    let tiles: any[] = [];
    if (json) tiles = JSON.parse(json).tiles ?? [];
    else {
      // Repli : extraire le tableau « tiles » directement
      const start = html.indexOf('"tiles":[');
      if (start >= 0) {
        let depth = 0, end = start + 8;
        for (let i = start + 8; i < html.length; i++) {
          if (html[i] === "[") depth++;
          else if (html[i] === "]") { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        tiles = JSON.parse(html.slice(start + 8, end));
      }
    }
    const offers: OfferInput[] = [];
    for (const t of tiles) {
      const title = String(t.title ?? "").replace(/ /g, " ");
      const m = title.match(/^iPhone (.+?) (\d+) ?(Go|To) reconditionné(?: - (.+?))?(?: \(|$)/i);
      const raw = Number(t.price?.currentPrice?.raw_amount);
      if (!m || !raw) continue;
      const gb = Number(m[2]) * (/To/i.test(m[3]) ? 1024 : 1);
      const modelId = appleModelId(m[1]);
      offers.push({
        id: `apple-refurb-fr:${t.price?.partNumber ?? `${modelId}-${gb}-${m[4]}`}`, modelId, storageGb: gb, condition: "reconditionne",
        seller: "Apple", platform: "Apple Store – produits reconditionnés", price: raw, shipping: freeShipping ? 0 : null, mandatoryFees: 0,
        shippingStatus: freeShipping ? "gratuite_annoncee" : "inconnue", shippingNote: freeShipping ? "« Livraison gratuite » affiché sur la page Apple" : null,
        stock: "en_stock",
        color: m[4] ?? null, grade: "Reconditionné par Apple (programme officiel, sans grade esthétique publié)", batteryNote: null,
        warranty: null, returnsPolicy: null, url: `https://www.apple.com${t.productDetailsUrl ?? "/fr/shop/refurbished/iphone"}`.split("?")[0],
        source: "apple-refurb-fr",
        create: { brand: "apple", brandName: "Apple", name: `iPhone ${m[1].replace(/^Air$/i, "17 Air")}`, product: "iphone", os: "ios" },
      });
    }
    saveOffers(db, "apple-refurb-fr", offers, run.stats);
    run.finish();
  } catch (e) {
    run.stats.notes.push((e as Error).message);
    run.finish("echec");
  }
}

async function importSamsung(db: DatabaseSync) {
  const run = startRun(db, "Samsung Shop FR");
  const url = "https://www.samsung.com/fr/smartphones/all-smartphones/";
  // Les frais de livraison ne figurent pas sur les pages lues : coût total inconnu tant que
  // SAMSUNG_FR_SHIPPING_EUR n'est pas renseigné après vérification des conditions de vente.
  const shippingEnv = process.env.SAMSUNG_FR_SHIPPING_EUR;
  const shipping = shippingEnv !== undefined && shippingEnv !== "" ? Number(shippingEnv) : null;
  try {
    const html = await get(url, true);
    const block = html.match(/<script type="application\/ld\+json" date-type="seo">([\s\S]*?)<\/script>/)?.[1];
    if (!block) throw new Error("JSON-LD introuvable");
    const list = JSON.parse(block).itemListElement as { item: { name: string; "@id": string; offers?: { price: string; availability: string } } }[];
    const offers: OfferInput[] = [];
    for (const { item } of list) {
      const pageUrl = item["@id"];
      let cap: [string, string, string] | null = pageUrl.match(/-(\d+)(gb|tb)[-/]/i) as [string, string, string] | null;
      let capacityNote: string | null = null;
      if (!cap && item.offers?.price) {
        // L'adresse ne donne que le code fabricant : la capacité exacte de ce code vient d'Open Icecat.
        const code = pageUrl.match(/modelCode=(SM-[A-Z0-9]+)/i)?.[1]?.toUpperCase();
        if (code) {
          const ice = await fetchIcecat({ brand: "Samsung", mpn: code }).catch(() => null);
          const gb = ice?.ok ? mapIcecat(ice.product).storageGb : null;
          if (gb) {
            cap = ["", String(gb >= 1024 ? gb / 1024 : gb), gb >= 1024 ? "tb" : "gb"];
            capacityNote = `capacité du code ${code} selon Open Icecat`;
          }
        }
      }
      if (!cap || !item.offers?.price) {
        run.stats.notes.push(`capacité non indiquée, offre non attribuée : ${item.name} (${pageUrl})`);
        continue;
      }
      if (!/InStock/i.test(item.offers.availability)) continue;
      const refurb = /Reconditionn/i.test(item.name);
      const name = item.name.replace(/\s*-\s*Reconditionné.*$/i, "").replace(/\s*\(Couleurs? exclusives?\)/i, "").trim();
      const gb = Number(cap[1]) * (cap[2].toLowerCase() === "tb" ? 1024 : 1);
      offers.push({
        id: `samsung-fr:${slugify(pageUrl.split("/").filter(Boolean).pop() ?? pageUrl)}`,
        modelId: modelSlug("Samsung", name), storageGb: gb, condition: refurb ? "reconditionne" : "neuf",
        seller: "Samsung", platform: "samsung.com/fr", price: Number(item.offers.price), shipping, mandatoryFees: 0,
        shippingStatus: shipping === null ? "inconnue" : shipping === 0 ? "gratuite_annoncee" : "payante",
        shippingNote: (shipping === null ? "Frais de port calculés au panier selon les CGV Samsung (« hors participation aux frais de port »)" : "Montant renseigné après vérification (SAMSUNG_FR_SHIPPING_EUR)") + (capacityNote ? ` ; ${capacityNote}` : ""),
        stock: "en_stock",
        color: null, grade: refurb ? "Reconditionné Premium par Samsung (grade esthétique non publié sur la page)" : null,
        batteryNote: null, warranty: null, returnsPolicy: null, url: pageUrl, source: "samsung-fr",
        create: { brand: "samsung", brandName: "Samsung", name, product: "samsung-mobile", os: "android" },
      });
    }
    saveOffers(db, "samsung-fr", offers, run.stats);
    if (shipping === null) run.stats.notes.push("frais de livraison non vérifiés : coût total inconnu (SAMSUNG_FR_SHIPPING_EUR)");
    run.finish();
  } catch (e) {
    run.stats.notes.push((e as Error).message);
    run.finish("echec");
  }
}

/** Offres vérifiées manuellement (data/sources/offers-manual.json), même format que OfferInput. */
function importManualOffers(db: DatabaseSync) {
  const f = path.join(SRC, "offers-manual.json");
  if (!fs.existsSync(f)) return;
  const run = startRun(db, "offres saisies manuellement");
  const list = JSON.parse(fs.readFileSync(f, "utf8")).offers as OfferInput[];
  if (list.length) saveOffers(db, "manuel", list.map((o) => ({ ...o, source: "manuel" })), run.stats);
  run.finish();
}


/**
 * Relevé d'une source marchande : en cas d'échec (réseau, page modifiée, zéro offre lue),
 * aucune offre n'est modifiée — ni effacée, ni redatée. L'échec est journalisé.
 */
export async function runOfferSource(db: DatabaseSync, name: string, source: string, read: () => Promise<OfferInput[]>) {
  const run = startRun(db, name);
  try {
    const offers = await read();
    // Garde-fou : une chute brutale du nombre d'offres signale presque toujours une page modifiée.
    const prev = (db.prepare("SELECT COUNT(*) n FROM offers WHERE source=? AND available=1 AND is_test=0").get(source) as { n: number }).n;
    if (prev >= 5 && offers.length < prev * 0.5 && process.env.FORCE_IMPORT !== "1")
      throw new Error(`anomalie : ${offers.length} offres lues contre ${prev} au relevé précédent — données précédentes conservées (FORCE_IMPORT=1 pour accepter)`);
    saveOffers(db, source, offers, run.stats);
    run.finish();
    return true;
  } catch (e) {
    run.stats.notes.push((e as Error).message);
    run.finish("echec");
    return false;
  }
}

// ───────────────────────── Inventaire REDMI France ─────────────────────────
interface RedmiEntry { tag: string; name: string; family: string; year: number | null }

/**
 * Chaque REDMI de data/sources/redmi-fr.json est confirmé sur sa page produit française (HTTP 200, titre du modèle),
 * créé ou renommé sous son nom officiel, rangé dans sa famille, puis complété par sa page « Caractéristiques ».
 * Une page disparue n'efface rien : la référence est signalée « à vérifier ».
 */
async function importRedmiInventory(db: DatabaseSync, stats: { added: number; updated: number; notes: string[] }) {
  const inv = readJson("redmi-fr.json") as { models: RedmiEntry[] };
  for (const e of inv.models) {
    const page = `https://www.mi.com/fr/product/${e.tag}/`;
    const specsUrl = `${page}specs/`;
    let html: string;
    try {
      html = await get(page, true);
    } catch (err) {
      stats.notes.push(`page inaccessible, à vérifier : ${e.name} (${page} — ${(err as Error).message})`);
      continue;
    }
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
    if (/404/.test(title)) {
      stats.notes.push(`page retirée, à vérifier : ${e.name} (${page})`);
      continue;
    }
    const before = db.prepare("SELECT 1 FROM models WHERE id=?").get(modelSlug("REDMI", e.name));
    const id = upsertModel(db, {
      brand: "redmi", brandName: "REDMI", name: e.name, series: e.family, form: "classique", os: "android",
      release: null, releaseSource: `Date de lancement en France non publiée sur la page consultée : ${page}`,
      frStatus: "confirme", frSource: `Page produit Xiaomi France : ${page}`,
    }, stats);
    if (!before) stats.notes.push(`ajouté : ${e.name}`);
    db.prepare("UPDATE models SET release_source=? WHERE id=? AND release_date IS NULL").run(`Date de lancement en France non publiée sur la page consultée : ${page}`, id);

    try {
      const text = flatText(await get(specsUrl, true));
      const { specs, configs } = parseXiaomiSpecs(text, e.name);
      if (!Object.keys(specs).length) stats.notes.push(`caractéristiques illisibles, à vérifier : ${specsUrl}`);
      for (const [k, v] of Object.entries(specs)) upsertSpec(db, id, k, v, "Xiaomi France — caractéristiques (mi.com/fr)", specsUrl, stats);
      for (const c of configs)
        db.prepare("INSERT INTO configs (id, model_id, storage_gb, ram_gb) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET ram_gb=excluded.ram_gb").run(`${id}-${c.storage}`, id, c.storage, c.ram);
      if (configs.length) upsertSpec(db, id, "ram_gb", Math.min(...configs.map((c) => c.ram)), "Xiaomi France — caractéristiques (mi.com/fr)", specsUrl, stats);
    } catch (err) {
      stats.notes.push(`page caractéristiques inaccessible : ${specsUrl} (${(err as Error).message})`);
    }
    // Suivi logiciel : Xiaomi ne publie pas de durée sur ces pages ; on conserve le lien consulté.
    db.prepare(`INSERT INTO support (model_id, source_name, source_url, checked_at, level)
        VALUES (?, 'Xiaomi France — aucune durée de suivi publiée sur la page consultée', ?, ?, 'consulte')
      ON CONFLICT(model_id) DO UPDATE SET source_url=COALESCE(support.source_url, excluded.source_url), checked_at=excluded.checked_at
      WHERE support.level IN ('consulte')`).run(id, specsUrl, new Date().toISOString().slice(0, 10));
    await new Promise((r) => setTimeout(r, 250));
  }
}

// ───────────────────────── Xiaomi Store France ─────────────────────────
/**
 * Source : Xiaomi Store France.
 *  1. Liste des smartphones : données structurées schema.org de la page publique « Smartphones ».
 *  2. Prix PAR VARIANTE : point d'accès du magasin qui alimente la page d'achat
 *     (ams-go.buy.mi.com/fr/v2/item/productdetail), utilisé avec l'autorisation explicite du propriétaire du projet.
 *     Chaque variante donne son nom exact (« 4 GO + 128 GO »), son prix et son stock.
 *  3. Si le détail d'un produit échoue, repli sur le prix de départ de la liste, jamais attribué à une capacité.
 * La livraison n'est pas indiquée : coût total inconnu → « frais à vérifier ».
 */
interface XiaomiItem {
  item_id: number;
  item_name: string;
  price: number;
  is_sale: boolean;
  is_out_of_stock: boolean;
  is_not_for_sale: boolean;
}

export function xiaomiVariantOffers(
  items: XiaomiItem[],
  ctx: { tag: string; modelId: string; create: OfferInput["create"] },
): OfferInput[] {
  // Regroupe les coloris d'une même capacité : on garde le prix le plus bas parmi les coloris en stock.
  const byStorage = new Map<number, { item: XiaomiItem; inStock: boolean }>();
  for (const it of items) {
    if (!it.is_sale || it.is_not_for_sale || !it.price) continue;
    const m = it.item_name.match(/(\d+)\s*GO\s*\+\s*(\d+)\s*(GO|TO)/i);
    if (!m) continue;
    const gb = Number(m[2]) * (/TO/i.test(m[3]) ? 1024 : 1);
    const inStock = !it.is_out_of_stock;
    const prev = byStorage.get(gb);
    const better = !prev || (inStock && !prev.inStock) || (inStock === prev.inStock && it.price < prev.item.price);
    if (better) byStorage.set(gb, { item: it, inStock });
  }
  return [...byStorage.entries()].map(([gb, { item, inStock }]) => ({
    id: `xiaomi-fr:${ctx.tag}:${gb}`, modelId: ctx.modelId, storageGb: gb, capacityStatus: "confirmee", condition: "neuf",
    seller: "Xiaomi", platform: "mi.com/fr", price: item.price, shipping: null, shippingStatus: "inconnue",
    shippingNote: "Frais de livraison non indiqués sur la page produit", mandatoryFees: 0, stock: inStock ? "en_stock" : "rupture",
    color: item.item_name.replace(/^.*?\s(\S+)\s+\d+\s*GO.*$/i, "$1"), grade: null, batteryNote: null, warranty: null, returnsPolicy: null,
    url: `https://www.mi.com/fr/product/${ctx.tag}/buy/?gid=${item.item_id}`, source: "xiaomi-fr", create: ctx.create,
  }));
}

async function importXiaomi(db: DatabaseSync) {
  const url = "https://www.mi.com/fr/product-list/phone/";
  const ok = await runOfferSource(db, "Xiaomi Store FR", "xiaomi-fr", async () => {
    const html = await get(url, true);
    const blocks = [...html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
      try { return JSON.parse(m[1]); } catch { return null; }
    });
    const list = [...(blocks.find((b) => b?.["@type"] === "ItemList")?.itemListElement ?? [])];
    const listed = new Set(list.map((x: { item: { url: string } }) => x.item.url.match(/\/product\/([^/]+)/)?.[1]));
    for (const e of (readJson("redmi-fr.json") as { models: { tag: string; name: string }[] }).models)
      if (!listed.has(e.tag)) list.push({ item: { name: e.name, url: `https://www.mi.com/fr/product/${e.tag}/` } });
    const offers: OfferInput[] = [];
    for (const { item } of list as { item: { name: string; url: string; offers?: { price: string; availability: string } } }[]) {
      const raw = String(item.name ?? "").trim();
      if (!/^(Xiaomi|REDMI|POCO)\s/i.test(raw) || /coque|case|charg|combo|watch|buds|band|tab|pad|cable|câble/i.test(raw)) continue;
      const brand = /^REDMI/i.test(raw) ? "redmi" : /^POCO/i.test(raw) ? "poco" : "xiaomi";
      const brandName = brand === "redmi" ? "REDMI" : brand === "poco" ? "POCO" : "Xiaomi";
      const name = raw.replace(/^Redmi/i, "REDMI");
      const modelId = modelSlug(brandName, name);
      const tag = item.url.match(/\/product\/([^/]+)/)?.[1];
      const create = { brand, brandName, name, product: "xiaomi", os: "android" as const };
      let variants: OfferInput[] = [];
      if (tag) {
        try {
          const res = await fetch(`https://ams-go.buy.mi.com/fr/v2/item/productdetail?from=pc&tag=${encodeURIComponent(tag)}`, {
            headers: { "User-Agent": BROWSER_UA, Referer: "https://www.mi.com/fr/", "Accept-Language": "fr-FR" },
            signal: AbortSignal.timeout(30_000),
          });
          if (res.ok) {
            const json = (await res.json()) as { data?: { item_detail?: { spu_list?: { item_list?: XiaomiItem[] }[] } } };
            const items = (json.data?.item_detail?.spu_list ?? []).flatMap((s) => s.item_list ?? []);
            variants = xiaomiVariantOffers(items, { tag, modelId, create });
          }
        } catch {
          /* repli ci-dessous */
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (variants.length) {
        offers.push(...variants);
        continue;
      }
      if (!item.offers?.price) continue;
      offers.push({
        id: `xiaomi-fr:${slugify(item.url)}`, modelId, storageGb: 0, capacityStatus: "prix_de_depart", condition: "neuf",
        seller: "Xiaomi", platform: "mi.com/fr", price: Number(item.offers.price), shipping: null, shippingStatus: "inconnue",
        shippingNote: "Frais de livraison non indiqués sur la page produit", mandatoryFees: 0,
        stock: /InStock/i.test(item.offers.availability) ? "en_stock" : /OutOfStock/i.test(item.offers.availability) ? "rupture" : "inconnu",
        color: null, grade: null, batteryNote: null, warranty: null, returnsPolicy: null, url: item.url.replace(/\/?$/, "/buy/"), source: "xiaomi-fr",
        create,
      });
    }
    return offers;
  });
  if (ok) {
    // Les anciens « prix de départ » remplacés par des prix par capacité sont supprimés (pas seulement masqués),
    // pour ne pas laisser une configuration « Prix de départ » sans offre sur la fiche.
    db.prepare("DELETE FROM offers WHERE source='xiaomi-fr' AND available=0 AND capacity_status='prix_de_depart' AND is_test=0").run();
    db.prepare("DELETE FROM configs WHERE storage_gb=0 AND id NOT IN (SELECT config_id FROM offers)").run();
  }
}

// ───────────────────────── Google Store France ─────────────────────────
/**
 * Source : pages produit publiques du Google Store France (store.google.com/fr/product/<pixel>).
 * La page affiche « À partir de X € » sans capacité : prix de départ, jamais attribué à une capacité,
 * donc toujours « à vérifier ». La livraison standard gratuite est annoncée explicitement sur la page.
 */
export function parseGoogleStorePage(html: string, modelName: string): { price: number; freeShipping: boolean } | null {
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
  // La page doit bien être celle du modèle (pas une redirection vers un autre Pixel).
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();
  if (!norm(title).includes(norm(modelName))) return null;
  const m = html.match(/data-test="price">\s*À partir de ([\d\s  ]+(?:,\d{2})?)\s*€/);
  if (!m) return null;
  const price = Number(m[1].replace(/[\s  ]/g, "").replace(",", "."));
  if (!price) return null;
  return { price, freeShipping: /Livraison standard gratuite|Livraison et retours sans frais/i.test(html) };
}

async function importGoogleStore(db: DatabaseSync) {
  return runOfferSource(db, "Google Store FR", "google-store-fr", async () => {
    const pixels = db.prepare("SELECT id, name FROM models WHERE brand_id='google' AND is_test=0").all() as { id: string; name: string }[];
    const offers: OfferInput[] = [];
    for (const p of pixels) {
      const slug = p.name.toLowerCase().replace(/\s+/g, "_");
      const url = `https://store.google.com/fr/product/${slug}?hl=fr`;
      let html: string;
      try {
        html = await get(url, true);
      } catch {
        continue; // modèle plus vendu sur le Google Store
      }
      const parsed = parseGoogleStorePage(html, p.name);
      await new Promise((r) => setTimeout(r, 300));
      if (!parsed) continue;
      offers.push({
        id: `google-store-fr:${slug}`, modelId: p.id, storageGb: 0, capacityStatus: "prix_de_depart", condition: "neuf",
        seller: "Google", platform: "store.google.com/fr", price: parsed.price,
        shipping: parsed.freeShipping ? 0 : null, shippingStatus: parsed.freeShipping ? "gratuite_annoncee" : "inconnue",
        shippingNote: parsed.freeShipping ? "« Livraison standard gratuite » affiché sur le Google Store ; prix « à partir de », capacité à choisir" : "Frais de livraison non indiqués",
        mandatoryFees: 0, stock: "inconnu", color: null, grade: null, batteryNote: null, warranty: null, returnsPolicy: null,
        url, source: "google-store-fr",
      });
    }
    return offers;
  });
}

// ───────────────────────── Contrôle des variantes ─────────────────────────
/**
 * Ouvre la page de destination de chaque offre active et vérifie qu'elle mentionne la capacité
 * et le prix importés. Écart → offre marquée « ecart » (exclue des résultats « dans le budget »).
 */
async function verifyOffers(db: DatabaseSync) {
  const run = startRun(db, "Contrôle des pages vendeurs");
  // Sources dont la page produit charge le prix par script : contrôle automatique impossible sans navigateur.
  const JS_RENDERED = new Set(["xiaomi-fr"]);
  const rows = db.prepare(`SELECT o.id, o.url, o.price, o.capacity_status, o.source, c.storage_gb FROM offers o JOIN configs c ON c.id=o.config_id
    WHERE o.available=1 AND o.is_test=0`).all() as { id: string; url: string; price: number; capacity_status: string; source: string; storage_gb: number }[];
  for (const r of rows.filter((x) => JS_RENDERED.has(x.source)))
    db.prepare("UPDATE offers SET variant_check='non_controlable', variant_checked_at=? WHERE id=?").run(now(), r.id);
  rows.splice(0, rows.length, ...rows.filter((x) => !JS_RENDERED.has(x.source)));
  const cache = new Map<string, string | null>();
  for (const r of rows) {
    if (!cache.has(r.url)) {
      try { cache.set(r.url, (await get(r.url, true)).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")); } catch { cache.set(r.url, null); }
    }
    const text = cache.get(r.url);
    if (text === null || text === undefined) { run.stats.notes.push(`page inaccessible : ${r.url}`); continue; }
    const priceStr = Number.isInteger(r.price) ? String(r.price) : r.price.toFixed(2).replace(".", ",");
    const priceOk = text.replace(/\s/g, "").includes(priceStr.replace(/\s/g, "")) || text.includes(String(r.price));
    const cap = r.storage_gb >= 1024 ? [`${r.storage_gb / 1024} To`, `${r.storage_gb / 1024}TB`, `${r.storage_gb / 1024} TB`] : [`${r.storage_gb} Go`, `${r.storage_gb}GB`, `${r.storage_gb} GB`, `${r.storage_gb}go`, `${r.storage_gb}gb`];
    const capOk = r.capacity_status === "prix_de_depart" || cap.some((c) => text.toLowerCase().includes(c.toLowerCase())) || r.url.toLowerCase().includes(`${r.storage_gb}gb`);
    // Page dont les prix sont chargés par script (aucun prix « € » dans le HTML) : contrôle impossible sans navigateur.
    const hasPrices = /\d[\d\s.,]*\s?(€|&euro;|EUR)/.test(text) || /"price"\s*:/.test(text);
    const status = !hasPrices ? "non_controlable" : priceOk && capOk ? "ok" : "ecart";
    if (status === "ecart") run.stats.notes.push(`écart ${r.id} : ${priceOk ? "" : "prix absent de la page "}${capOk ? "" : "capacité absente de la page"}`);
    db.prepare("UPDATE offers SET variant_check=?, variant_checked_at=? WHERE id=?").run(status, now(), r.id);
    run.stats.updated++;
  }
  run.finish();
}

// ───────────────────────── Main ─────────────────────────
/** Supprime toute donnée des marques exclues (règle unique : data/sources/brand-policy.json). */
export function purgeExcludedBrands(db: DatabaseSync): number {
  const ids = (db.prepare("SELECT id FROM brands").all() as { id: string }[]).map((b) => b.id).filter(isExcludedBrand);
  let removed = 0;
  for (const b of ids) {
    const models = `(SELECT id FROM models WHERE brand_id='${b}')`;
    db.exec(`DELETE FROM offers WHERE config_id IN (SELECT id FROM configs WHERE model_id IN ${models});
      DELETE FROM market_observations WHERE config_id IN (SELECT id FROM configs WHERE model_id IN ${models});
      DELETE FROM configs WHERE model_id IN ${models};
      DELETE FROM specs WHERE model_id IN ${models};
      DELETE FROM support WHERE model_id IN ${models};
      DELETE FROM media WHERE model_id IN ${models};`);
    try { db.exec(`DELETE FROM product_ids WHERE model_id IN ${models}`); } catch { /* table absente */ }
    removed += Number(db.prepare("DELETE FROM models WHERE brand_id=?").run(b).changes);
    db.prepare("DELETE FROM series WHERE brand_id=?").run(b);
    db.prepare("DELETE FROM brands WHERE id=?").run(b);
  }
  return removed;
}

/**
 * Alerte : toute étape en échec pendant cette exécution est consignée dans data/alerts.log et, si
 * ALERT_WEBHOOK_URL est défini dans .env.local (Slack, Discord, Teams…), envoyée à ce webhook.
 */
export async function reportProblems(db: DatabaseSync, since: string) {
  const failed = db.prepare("SELECT source, notes FROM import_runs WHERE started_at >= ? AND status <> 'ok' ORDER BY id").all(since) as { source: string; notes: string | null }[];
  if (!failed.length) return [];
  const lines = failed.map((f) => `• ${f.source} : ${(f.notes ?? "échec").split("\n").slice(-1)[0]}`);
  const text = `PickJust — ${failed.length} étape(s) d'import en échec le ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}\n${lines.join("\n")}`;
  // Pendant les tests, rien n'est écrit dans le vrai journal ni envoyé au webhook.
  if (process.env.VITEST) return failed;
  fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  fs.appendFileSync(path.join(ROOT, "data", "alerts.log"), `${new Date().toISOString()} ${text}\n\n`);
  console.warn(text);
  const hook = process.env.ALERT_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      console.warn(`webhook d'alerte injoignable : ${(e as Error).message}`);
    }
  }
  return failed;
}

async function main() {
  const startedAt = new Date().toISOString();
  const db = openDb();
  const purged = purgeExcludedBrands(db);
  if (purged) console.log(`[Marques exclues] ${purged} modèles supprimés (brand-policy.json)`);
  if (want("brands")) importBrands(db);
  if (want("eol")) await importEol(db);
  if (want("editorial")) importEditorial(db);
  if (want("specs")) importSpecs(db);
  // Offres d'abord : les fiches officielles Samsung/Xiaomi et Open Icecat partent des pages et codes des offres.
  if (want("offers")) {
    await importAppleStore(db);
    await importAppleRefurb(db);
    await importSamsung(db);
    await importXiaomi(db);
    await importGoogleStore(db);
    // Flux d'affiliation : actifs seulement si MERCHANT_FEEDS est renseigné dans .env.local.
    const feeds = configuredFeeds();
    if (!feeds.length) console.log("[Flux marchands] aucun flux configuré (MERCHANT_FEEDS) — étape ignorée");
    for (const f of feeds) {
      await runOfferSource(db, `Flux ${f.name}`, `flux-${f.name}`, async () => {
        const rows = parseCsv(await downloadFeed(f.url)).map(toFeedRow).filter((r): r is FeedRow => r !== null);
        const notes = { notes: [] as string[] };
        const offers = feedToOffers(db, `flux-${f.name}`, rows, notes);
        console.log(`[Flux ${f.name}] ${notes.notes.join(" ")}`);
        return offers;
      });
    }
    importManualOffers(db);
  }
  if (want("offers") || want("verify")) await verifyOffers(db);
  // Cote d'occasion : API officielle eBay, active seulement si EBAY_CLIENT_ID / EBAY_CLIENT_SECRET sont configurés.
  if (want("offers") || want("occasion")) {
    if (!ebayConfigured()) console.log("[Occasion eBay] clés absentes (EBAY_CLIENT_ID, EBAY_CLIENT_SECRET) — étape ignorée");
    else {
      const run = startRun(db, "Occasion eBay");
      try {
        const configs = (db.prepare(`SELECT c.id configId, m.name modelName, c.storage_gb storageGb FROM configs c JOIN models m ON m.id=c.model_id
          WHERE c.storage_gb > 0 AND m.is_test=0 AND ${publishedModelSql()}`).all() as { configId: string; modelName: string; storageGb: number }[]);
        await importEbayUsed(db, run.stats, configs);
        run.finish();
      } catch (e) {
        run.stats.notes.push((e as Error).message);
        run.finish("echec");
      }
    }
  }
  if (want("official")) {
    for (const [name, fn] of [
      ["Google — suivi officiel Pixel", importGoogleSupport],
      ["Apple — caractéristiques officielles", importAppleSpecs],
      ["Google Store — caractéristiques officielles", importGoogleSpecs],
      ["Apple — absence d'échéance vérifiée", verifyAppleNoDeadline],
      ["Samsung France — fiches officielles", importSamsungSpecs],
      ["Inventaire REDMI France", importRedmiInventory],
      ["Xiaomi France — fiches officielles", importXiaomiSpecs],
      ["Open Icecat", importIcecat],
    ] as const) {
      const run = startRun(db, name);
      try {
        await fn(db, run.stats);
        run.finish();
      } catch (e) {
        run.stats.notes.push((e as Error).message);
        run.finish("echec");
      }
    }
    // Classe de puce recalculée pour toute puce connue (y compris relevée sur une page officielle).
    const tiers = readJson("specs.json").chip_tiers as Record<string, number>;
    for (const r of db.prepare("SELECT model_id, value FROM specs WHERE key='chip' AND kind='annonce'").all() as { model_id: string; value: string }[]) {
      // Libellés constructeurs variés : « MediaTek Dimensity 7300-Ultra », « 8 cœurs Dimensity 6100+ ».
      const chip = String(JSON.parse(r.value)).replace(/^8 cœurs /i, "").replace(/^MediaTek /i, "").trim();
      const t = tiers[chip];
      if (t) db.prepare(`INSERT INTO specs (model_id, key, value, kind, source_name, source_url, checked_at, level) VALUES (?, 'chip_tier', ?, 'annonce', 'Classement éditorial des puces (indicatif)', NULL, NULL, 'editorial')
        ON CONFLICT(model_id, key, kind) DO UPDATE SET value=excluded.value`).run(r.model_id, JSON.stringify(t));
    }
  }
  if (want("media")) await importMedia(db);
  await reportProblems(db, startedAt);
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  console.log(`\nCatalogue : ${n("SELECT COUNT(*) n FROM models WHERE is_test=0")} modèles, ${n("SELECT COUNT(*) n FROM offers WHERE available=1 AND is_test=0")} offres actives, ${n("SELECT COUNT(DISTINCT model_id) n FROM media")} modèles illustrés.`);
  if (args.includes("--deploy")) {
    // Contrôle qualité avant mise en ligne : en cas d'échec, le build s'arrête et la version en ligne est conservée.
    const minOffers = Number(process.env.MIN_ACTIVE_OFFERS ?? 50);
    const minModels = Number(process.env.MIN_MODELS ?? 200);
    const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
    const offers = (db.prepare("SELECT COUNT(*) n FROM offers WHERE available=1 AND is_test=0 AND checked_at >= ?").get(cutoff) as { n: number }).n;
    const models = n("SELECT COUNT(*) n FROM models WHERE is_test=0");
    finalizeForDeploy(db);
    db.close();
    if (offers < minOffers || models < minModels) {
      console.error(`Contrôle qualité refusé : ${offers} offres récentes (minimum ${minOffers}), ${models} modèles (minimum ${minModels}). Déploiement annulé, la version en ligne est conservée.`);
      process.exit(1);
    }
    console.log(`Contrôle qualité validé : ${offers} offres récentes, ${models} modèles.`);
    return;
  }
  db.close();
}

// Exécuté seulement en ligne de commande (les tests importent les fonctions sans lancer l'import).
if (/import\.ts$/.test(process.argv[1] ?? "")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
