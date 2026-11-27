import fs from "node:fs";
import path from "node:path";
import { normalize } from "../src/lib/text";
/**
 * Open Icecat — fiches produit fournies par les fabricants (catalogue ouvert, réutilisation autorisée).
 *
 * Identifiant : ICECAT_USERNAME (par défaut le compte public « openIcecat-live »).
 * Clé facultative : ICECAT_APP_KEY (Full Icecat) pour les marques non couvertes par Open Icecat.
 * Les deux se configurent dans .env.local (jamais exposé au navigateur).
 *
 * Recherche par code fabricant exact (MPN, ex. SM-A176BZBAEUB) ou par GTIN : la fiche correspond donc à la
 * variante exacte (capacité, coloris). Les valeurs Icecat complètent les champs absents et ne remplacent
 * jamais une valeur relevée sur la page officielle du constructeur.
 */
import type { DatabaseSync } from "node:sqlite";

type Stats = { added: number; updated: number; notes: string[] };
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

export interface IcecatFeature {
  Feature: { ID: string | number; Name: { Value: string } };
  PresentationValue?: string;
  Value?: string;
}
export interface IcecatProduct {
  GeneralInfo: { IcecatId: number; Brand: string; BrandPartCode: string; GTIN?: string[]; Title: string };
  Image?: { Pic500x500?: string; HighPic?: string; LowPic?: string };
  FeaturesGroups: { Features: IcecatFeature[] }[];
}

const EN_MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const n = (s: string | undefined) => (s ? Number(s.replace(/\s/g, "").replace(",", ".").match(/[\d.]+/)?.[0]) : NaN);

/** Correspondance par identifiant de caractéristique Icecat (indépendant de la langue). */
export function mapIcecat(p: IcecatProduct) {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const g of p.FeaturesGroups ?? [])
    for (const f of g.Features ?? []) {
      const v = f.PresentationValue ?? f.Value ?? "";
      byId.set(String(f.Feature.ID), v);
      byName.set(f.Feature.Name.Value.toLowerCase(), v);
    }
  const v: Record<string, unknown> = {};
  const size = byId.get("944")?.match(/\(([\d.,]+)"\)/);
  if (size) v.screen_in = n(size[1]);
  const res = byId.get("1585")?.match(/(\d+)\s*x\s*(\d+)/);
  if (res) v.resolution = `${Math.max(+res[1], +res[2])} × ${Math.min(+res[1], +res[2])}`;
  if (byId.get("46952")) v.screen_tech = byId.get("46952");
  if (byId.get("7450")) v.refresh_hz = n(byId.get("7450"));
  const fam = byId.get("2196")?.replace(/^Samsung |^Qualcomm |^MediaTek |^Google /i, "");
  if (fam && byId.get("47")) v.chip = `${fam} ${byId.get("47")}`.trim();
  if (byId.get("7861")) v.ram_gb = n(byId.get("7861"));
  if (byId.get("730")) v.expandable = true;
  const cams = ["12435", "27588", "35935"].map((id) => byId.get(id)).filter(Boolean) as string[];
  if (cams.length) v.cameras = cams.map((c) => `${n(c)} Mpx`).join(" + ");
  const stab = `${byId.get("8062") ?? ""} ${byId.get("1578") ?? ""}`;
  if (/optical|optique|OIS/i.test(stab)) v.ois = true;
  const optZoom = byName.get("zoom optique");
  if (optZoom) v.optical_zoom = n(optZoom);
  if (byId.get("40629")) v.five_g = /5G/.test(byId.get("40629")!);
  if (/eSIM/i.test(`${byId.get("9166") ?? ""} ${byName.get("type de carte sim") ?? ""}`)) v.esim = true;
  const nfc = byName.get("communication en champ proche (nfc)") ?? byName.get("nfc");
  if (nfc === "Oui" || nfc === "Non") v.nfc = nfc === "Oui";
  if (byId.get("909")) v.battery_mah = n(byId.get("909"));
  if (byId.get("48507")) v.charge_w = n(byId.get("48507"));
  const wl = byName.get("recharge sans fil");
  if (wl === "Oui" || wl === "Non") v.wireless = wl === "Oui";
  if (byId.get("7900")) v.ip = byId.get("7900");
  if (byId.get("1464")) v.height_mm = n(byId.get("1464"));
  if (byId.get("1649")) v.width_mm = n(byId.get("1649"));
  if (byId.get("1650")) v.thickness_mm = n(byId.get("1650"));
  if (byId.get("94")) v.weight_g = n(byId.get("94"));
  for (const k of Object.keys(v)) if (typeof v[k] === "number" && !Number.isFinite(v[k] as number)) delete v[k];
  const storage = byId.get("8730")?.match(/(\d+)\s*(Go|To|GB|TB)/i);
  const sec = byId.get("45537")?.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  return {
    specs: v,
    storageGb: storage ? Number(storage[1]) * (/T/i.test(storage[2]) ? 1024 : 1) : null,
    securityEnd: sec && EN_MONTHS[sec[2].toLowerCase()] ? `${sec[3]}-${String(EN_MONTHS[sec[2].toLowerCase()]).padStart(2, "0")}-${sec[1].padStart(2, "0")}` : null,
    gtins: p.GeneralInfo.GTIN ?? [],
    image: p.Image?.Pic500x500 || p.Image?.HighPic || p.Image?.LowPic || null,
  };
}

export type IcecatLookup = { mpn: string; brand: string } | { gtin: string };

export async function fetchIcecat(q: IcecatLookup): Promise<{ ok: true; product: IcecatProduct } | { ok: false; reason: string }> {
  const user = process.env.ICECAT_USERNAME || "openIcecat-live";
  const params = new URLSearchParams({ UserName: user, Language: "fr" });
  if ("gtin" in q) params.set("GTIN", q.gtin);
  else {
    params.set("Brand", q.brand);
    params.set("ProductCode", q.mpn);
  }
  if (process.env.ICECAT_APP_KEY) params.set("app_key", process.env.ICECAT_APP_KEY);
  const res = await fetch(`https://live.icecat.biz/api?${params}`, { signal: AbortSignal.timeout(30_000) });
  const json = (await res.json().catch(() => null)) as { data?: IcecatProduct; Message?: string } | null;
  if (json?.data?.GeneralInfo) return { ok: true, product: json.data };
  return { ok: false, reason: json?.Message?.replace(/&[a-z]+;/g, " ") ?? `HTTP ${res.status}` };
}

/** Codes fabricant connus : Samsung les publie dans l'adresse de chaque offre (…-sm-a176bzbaeub/). */
export function samsungMpnFromUrl(url: string): string | null {
  const m = url.toLowerCase().match(/-(sm-[a-z0-9]{6,})\/?$/) ?? url.toLowerCase().match(/modelcode=(sm-[a-z0-9]{6,})/);
  return m ? m[1].toUpperCase() : null;
}

export async function importIcecat(db: DatabaseSync, stats: Stats) {
  db.exec(`CREATE TABLE IF NOT EXISTS product_ids (
    scheme TEXT NOT NULL, value TEXT NOT NULL, model_id TEXT NOT NULL, storage_gb INTEGER, source TEXT NOT NULL, checked_at TEXT NOT NULL,
    PRIMARY KEY (scheme, value))`);
  const targets = new Map<string, { modelId: string; storageGb: number; lookup: IcecatLookup }>();
  for (const r of db.prepare(`SELECT c.model_id, c.storage_gb, o.url, b.name brand FROM offers o JOIN configs c ON c.id=o.config_id
      JOIN models m ON m.id=c.model_id JOIN brands b ON b.id=m.brand_id WHERE o.is_test=0 AND o.source='samsung-fr'`).all() as { model_id: string; storage_gb: number; url: string; brand: string }[]) {
    const mpn = samsungMpnFromUrl(r.url);
    if (mpn) targets.set(mpn, { modelId: r.model_id, storageGb: r.storage_gb, lookup: { mpn, brand: r.brand } });
  }
  for (const r of db.prepare("SELECT value, model_id, storage_gb FROM product_ids WHERE scheme='gtin'").all() as { value: string; model_id: string; storage_gb: number }[])
    if (![...targets.values()].some((t) => t.modelId === r.model_id)) targets.set(r.value, { modelId: r.model_id, storageGb: r.storage_gb, lookup: { gtin: r.value } });

  const filled = new Set<string>();
  const reasons = new Map<string, number>();
  const apply = (key: string, t: { modelId: string; storageGb: number; lookup: IcecatLookup }, product: IcecatProduct) => {
    const r = { product };
    const m = mapIcecat(r.product);
    if (m.storageGb !== null && t.storageGb > 0 && m.storageGb !== t.storageGb) {
      stats.notes.push(`écart de capacité ${key} : Icecat ${m.storageGb} Go, offre ${t.storageGb} Go — fiche ignorée`);
      return;
    }
    const src = `https://icecat.biz/fr/p/${r.product.GeneralInfo.Brand.toLowerCase()}/${r.product.GeneralInfo.BrandPartCode.toLowerCase()}/${r.product.GeneralInfo.IcecatId}.html`;
    for (const g of m.gtins)
      db.prepare(`INSERT INTO product_ids (scheme, value, model_id, storage_gb, source, checked_at) VALUES ('gtin', ?, ?, ?, 'Open Icecat', ?)
        ON CONFLICT(scheme, value) DO UPDATE SET model_id=excluded.model_id, storage_gb=excluded.storage_gb, checked_at=excluded.checked_at`).run(g, t.modelId, m.storageGb ?? t.storageGb, now());
    if ("mpn" in t.lookup)
      db.prepare(`INSERT INTO product_ids (scheme, value, model_id, storage_gb, source, checked_at) VALUES ('mpn', ?, ?, ?, 'Open Icecat', ?)
        ON CONFLICT(scheme, value) DO UPDATE SET checked_at=excluded.checked_at`).run(t.lookup.mpn, t.modelId, m.storageGb ?? t.storageGb, now());
    if (filled.has(t.modelId)) return;
    filled.add(t.modelId);
    // Complète uniquement : une valeur relevée sur la page du constructeur n'est jamais remplacée.
    for (const [k, v] of Object.entries(m.specs)) {
      const res = db.prepare(`INSERT INTO specs (model_id, key, value, kind, source_name, source_url, checked_at, level) VALUES (?,?,?,'annonce',?,?,?,'autorise')
        ON CONFLICT(model_id, key, kind) DO UPDATE SET value=excluded.value, source_name=excluded.source_name, source_url=excluded.source_url,
        checked_at=excluded.checked_at, level='autorise' WHERE specs.level IN ('editorial', 'autorise')`).run(
        t.modelId, k, JSON.stringify(v), "Open Icecat — données fournies par le fabricant", src, today(),
      );
      stats.updated += Number(res.changes);
    }
    if (m.securityEnd)
      db.prepare(`INSERT INTO support (model_id, security_end, security_end_precision, source_name, source_url, checked_at, level)
          VALUES (?, ?, 'jour', 'Open Icecat — « Terme de la mise à jour de sécurité » (donnée fabricant)', ?, ?, 'autorise')
        ON CONFLICT(model_id) DO UPDATE SET security_end=excluded.security_end, security_end_precision='jour', source_name=excluded.source_name,
          source_url=excluded.source_url, checked_at=excluded.checked_at, level='autorise' WHERE support.level NOT IN ('officiel', 'absence_verifiee')`).run(t.modelId, m.securityEnd, src, today());
    if (m.image) {
      db.prepare(`INSERT INTO media (model_id, kind, view, url, thumb_url, license, author, source_url, provider, checked_at, quality)
          VALUES (?, 'photo', 'face', ?, ?, 'Open Icecat (contenu fourni par le fabricant)', ?, ?, 'Icecat', ?, 'detoure')
        ON CONFLICT(model_id, url) DO UPDATE SET checked_at=excluded.checked_at`).run(t.modelId, m.image, m.image, r.product.GeneralInfo.Brand, src, now());
      stats.added++;
    }
  };

  for (const [key, t] of targets) {
    let r: Awaited<ReturnType<typeof fetchIcecat>>;
    try {
      r = await fetchIcecat(t.lookup);
    } catch {
      continue;
    }
    await new Promise((res) => setTimeout(res, 250));
    if (!r.ok) {
      reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
      continue;
    }
    apply(key, t, r.product);
  }

  // Modèles Samsung sans offre en cours : codes de base (data/sources/samsung-codes.json) + suffixes de coloris/marché.
  // Une fiche n'est retenue que si le titre Icecat nomme le modèle (ou reprend son code de base).
  const codes = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sources", "samsung-codes.json"), "utf8")) as { codes: Record<string, string>; suffixes: string[] };
  let probed = 0;
  for (const [modelId, base] of Object.entries(codes.codes)) {
    if (filled.has(modelId)) continue;
    const model = db.prepare("SELECT name FROM models WHERE id=?").get(modelId) as { name: string } | undefined;
    if (!model) continue;
    if (db.prepare("SELECT 1 FROM media WHERE model_id=? AND provider='Icecat'").get(modelId)) continue;
    probed++;
    const want = normalize(model.name.replace(/^Samsung\s+/i, "").replace(/\+/g, " plus"));
    for (const sfx of codes.suffixes) {
      let r: Awaited<ReturnType<typeof fetchIcecat>>;
      try {
        r = await fetchIcecat({ mpn: base + sfx, brand: "Samsung" });
      } catch {
        continue;
      }
      await new Promise((res) => setTimeout(res, 150));
      if (!r.ok) continue;
      const title = normalize(r.product.GeneralInfo.Title.replace(/\+/g, " plus"));
      const compact = (x: string) => x.replace(/\s+/g, "");
      if (!compact(title).includes(compact(want)) && !compact(title).includes(compact(normalize(base)))) {
        stats.notes.push(`titre Icecat sans rapport pour ${modelId} (${base + sfx}) : ignoré`);
        break;
      }
      apply(base + sfx, { modelId, storageGb: 0, lookup: { mpn: base + sfx, brand: "Samsung" } }, r.product);
      break;
    }
  }
  stats.notes.push(`${targets.size} codes interrogés, ${probed} modèles Samsung recherchés par code, ${filled.size} modèles enrichis`);
  for (const [reason, count] of reasons) stats.notes.push(`${count} × ${reason}`);
}
