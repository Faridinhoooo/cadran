/**
 * Sources OFFICIELLES relevées automatiquement (niveau « officiel », datées) :
 *  - Google : date de première disponibilité de chaque Pixel + règle des 5/7 ans (pages d'aide Google).
 *  - Apple : pages « Caractéristiques techniques » d'apple.com/fr.
 *  - Google Store : pages « Caractéristiques techniques » des Pixel.
 * Chaque valeur officielle remplace la saisie éditoriale ; les écarts sont journalisés.
 */
import type { DatabaseSync } from "node:sqlite";
import { modelSlug } from "../src/lib/text";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

type Stats = { added: number; updated: number; notes: string[] };

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, "Accept-Language": "fr-FR,fr;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** Texte de page aplati, cellules séparées par « | ». */
export function flatText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " | ")
    .replace(/&nbsp;|&#160;| | | /g, " ")
    .replace(/&#39;|&rsquo;|’/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/­/g, "")
    .replace(/(\s*\|\s*)+/g, " | ")
    .replace(/\s+/g, " ");
}

const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

export function upsertSpec(db: DatabaseSync, modelId: string, key: string, value: unknown, sourceName: string, url: string, stats: Stats) {
  const prev = db.prepare("SELECT value, level FROM specs WHERE model_id=? AND key=? AND kind='annonce'").get(modelId, key) as { value: string; level: string } | undefined;
  const json = JSON.stringify(value);
  if (prev && prev.level === "editorial" && prev.value !== json)
    stats.notes.push(`écart corrigé ${modelId}.${key} : saisie ${prev.value} → officiel ${json}`);
  db.prepare(`INSERT INTO specs (model_id, key, value, kind, source_name, source_url, checked_at, level) VALUES (?,?,?,'annonce',?,?,?,'officiel')
    ON CONFLICT(model_id, key, kind) DO UPDATE SET value=excluded.value, source_name=excluded.source_name, source_url=excluded.source_url,
    checked_at=excluded.checked_at, level='officiel'`).run(modelId, key, json, sourceName, url, today());
  stats.updated++;
}

function modelExists(db: DatabaseSync, id: string) {
  return !!db.prepare("SELECT 1 FROM models WHERE id=?").get(id);
}

// ───────────────────────── Google : suivi logiciel officiel ─────────────────────────

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export async function importGoogleSupport(db: DatabaseSync, stats: Stats) {
  const POLICY = "https://support.google.com/pixelphone/answer/4457705?hl=fr";
  const DATES = "https://support.google.com/pixelphone/answer/15738422?hl=fr";
  const policy = flatText(await get(POLICY));
  const dates = flatText(await get(DATES));

  // Listes « sept ans » et « cinq ans » telles que publiées par Google.
  const seven = policy.match(/pendant sept ans[\s\S]*?Voici les téléphones concernés : \|([\s\S]*?)\| Pixel 7a, /)?.[1] ?? "";
  const sevenSet = new Set(seven.split("|").map((s) => s.trim()).filter((s) => /^Pixel/.test(s)));
  const five = policy.match(/pendant cinq ans\. [\s\S]*?Voici les téléphones concernés : \|([\s\S]*?)\| Pixel 5a et modèles antérieurs/)?.[1] ?? "";
  const fiveSet = new Set(five.split("|").map((s) => s.trim()).filter((s) => /^Pixel/.test(s)));
  if (!sevenSet.size) throw new Error("liste « sept ans » introuvable sur la page Google");

  const re = /\| (Pixel [^|]+?) \| (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) (\d{4}) /gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dates))) {
    const name = m[1].trim();
    const years = sevenSet.has(name) ? 7 : fiveSet.has(name) ? 5 : null;
    const id = modelSlug("Google", name);
    if (!years || !modelExists(db, id)) continue;
    const month = MONTHS_FR.indexOf(m[2].toLowerCase()) + 1;
    const y = Number(m[3]);
    const start = `${y}-${String(month).padStart(2, "0")}-01`;
    const end = `${y + years}-${String(month).padStart(2, "0")}-01`;
    const text = `Google : mises à jour de sécurité et de l'OS pendant ${years === 7 ? "sept" : "cinq"} ans à compter de la première mise en vente sur le Google Store aux États-Unis (${m[2].toLowerCase()} ${y}).`;
    db.prepare(`INSERT INTO support (model_id, upgrade_commitment, upgrade_end, upgrade_end_precision, security_years, security_end, security_end_precision,
        source_name, source_url, policy_url, checked_at, level) VALUES (?,?,?,'mois',?,?,'mois',?,?,?,?,'officiel')
      ON CONFLICT(model_id) DO UPDATE SET upgrade_commitment=excluded.upgrade_commitment, upgrade_end=excluded.upgrade_end, upgrade_end_precision='mois',
        security_years=excluded.security_years, security_end=excluded.security_end, security_end_precision='mois', source_name=excluded.source_name,
        source_url=excluded.source_url, policy_url=excluded.policy_url, checked_at=excluded.checked_at, level='officiel'`).run(
      id, text, end, years, end, "Google — aide Pixel (page officielle)", DATES, POLICY, today(),
    );
    // Date de première disponibilité (États-Unis) : officielle, mais pas française.
    db.prepare("UPDATE models SET release_date=?, release_scope='monde', release_source=?, release_level='officiel' WHERE id=?").run(
      start.slice(0, 7), `Google — première mise en vente aux États-Unis (${DATES})`, id,
    );
    stats.updated++;
  }
}

// ───────────────────────── Apple : caractéristiques officielles ─────────────────────────

const APPLE_ALIASES: Record<string, string> = { "iPhone Air": "iPhone 17 Air" };
const appleId = (label: string) => modelSlug("Apple", APPLE_ALIASES[label.trim()] ?? label.trim());

export function parseAppleSpecs(text: string, pageModel: string) {
  const out = new Map<string, Record<string, unknown>>();
  const put = (label: string | null, k: string, v: unknown) => {
    const id = appleId(label ?? pageModel);
    out.set(id, { ...(out.get(id) ?? {}), [k]: v });
  };
  const labelOf = (s: string | undefined) => {
    const l = s?.split("|").map((x) => x.trim()).find((x) => /^iPhone/.test(x));
    return l ?? null;
  };

  // Capacités
  const cap = text.match(/\| Capacité \|([\s\S]*?)\| Dimensions et poids/)?.[1] ?? "";
  let current: string | null = null;
  for (const tok of cap.split("|").map((t) => t.trim())) {
    if (/^iPhone/.test(tok)) current = tok;
    const g = tok.match(/^(\d+) (Go|To)$/);
    if (g) {
      const gb = Number(g[1]) * (g[2] === "To" ? 1024 : 1);
      const id = appleId(current ?? pageModel);
      const prev = (out.get(id)?.storage as number[]) ?? [];
      put(current, "storage", [...prev, gb]);
    }
  }

  // Dimensions et poids (pliable : on garde l'appareil fermé, comme pour les autres pliables)
  const dimRe = /Largeur : \| ([\d,]+) mm \| Hauteur : \| ([\d,]+) mm \| Épaisseur : \| ([\d,]+) mm \|((?: [^|]+ \|)*?) Poids : \| ([\d,]+) g/g;
  let d: RegExpExecArray | null;
  while ((d = dimRe.exec(text))) {
    const extra = d[4] ?? "";
    if (/Ouvert/.test(extra)) continue;
    const label = labelOf(extra);
    put(label, "width_mm", num(d[1]));
    put(label, "height_mm", num(d[2]));
    put(label, "thickness_mm", num(d[3]));
    put(label, "weight_g", num(d[5]));
  }

  // Écrans : le premier écran listé (écran interne pour un pliable)
  const scrRe = /(?:\| (iPhone[^|]*?) \| )?(?:Écran interne \| )?Écran Super Retina XDR \| OLED tout écran(?: pliable)? de ([\d,]+) pouces \(diagonale\) \| Résolution de ([\d ]+) x ([\d ]+) pixels/g;
  const seen = new Set<string>();
  let s: RegExpExecArray | null;
  while ((s = scrRe.exec(text))) {
    const id = appleId(s[1] ?? pageModel);
    if (seen.has(id)) continue;
    seen.add(id);
    put(s[1] ?? null, "screen_in", num(s[2]));
    const a = num(s[3]);
    const b = num(s[4]);
    put(s[1] ?? null, "resolution", `${Math.max(a, b)} × ${Math.min(a, b)}`);
  }
  const promotion = /ProMotion[^|]*120 Hz/.test(text);
  const chip = text.match(/\| Puce (A\d+(?: Pro| Bionic)?) \|/)?.[1] ?? null;
  const ip = text.match(/Indice de protection (IP\d+)/)?.[1] ?? null;
  for (const id of out.keys()) {
    const o = out.get(id)!;
    o.refresh_hz = promotion ? 120 : 60;
    if (chip) o.chip = chip;
    if (ip) o.ip = ip;
  }
  return out;
}

export async function importAppleSpecs(db: DatabaseSync, stats: Stats) {
  const buy = await get("https://www.apple.com/fr/shop/buy-iphone");
  const families = [...new Set((buy.match(/\/fr\/shop\/buy-iphone\/iphone-[a-z0-9-]+/g) ?? []).map((f) => f.split("/").pop()!))];
  for (const fam of families) {
    const url = `https://www.apple.com/fr/${fam}/specs/`;
    let text: string;
    try {
      text = flatText(await get(url));
    } catch (e) {
      stats.notes.push(`page de caractéristiques indisponible : ${url} (${(e as Error).message})`);
      continue;
    }
    // « iphone-17-pro » → « iPhone 17 Pro », « iphone-air » → « iPhone Air »
    const pageModel = fam.replace(/^iphone/, "iPhone").split("-").map((w, i) => (i === 0 ? w : /^\d/.test(w) || w.length <= 1 ? w : w[0].toUpperCase() + w.slice(1))).join(" ").replace(/ (\d+) E$/, " $1e");
    const parsed = parseAppleSpecs(text, pageModel);
    for (const [id, values] of parsed) {
      if (!modelExists(db, id)) {
        stats.notes.push(`modèle inconnu sur ${url} : ${id}`);
        continue;
      }
      for (const [k, v] of Object.entries(values)) {
        if (k === "storage") {
          for (const gb of v as number[]) db.prepare("INSERT INTO configs (id, model_id, storage_gb) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING").run(`${id}-${gb}`, id, gb);
          continue;
        }
        upsertSpec(db, id, k, v, "Apple — caractéristiques techniques (apple.com/fr)", url, stats);
      }
    }
  }
}

// ───────────────────────── Google Store : caractéristiques officielles ─────────────────────────

export async function importGoogleSpecs(db: DatabaseSync, stats: Stats) {
  const pixels = db.prepare("SELECT id, name FROM models WHERE brand_id='google' AND is_test=0").all() as { id: string; name: string }[];
  const pages = new Map<string, string>();
  for (const p of pixels) {
    const slug = p.name.toLowerCase().replace(/\s+/g, "_");
    const candidates = [slug, slug.replace(/_xl$/, ""), slug.replace(/_fold$/, "_fold")];
    for (const c of [...new Set(candidates)]) {
      const url = `https://store.google.com/fr/product/${c}_specs?hl=fr`;
      if (!pages.has(url)) {
        try {
          pages.set(url, flatText(await get(url)));
        } catch {
          pages.set(url, "");
        }
      }
      const text = pages.get(url)!;
      if (!text) continue;
      // Plusieurs modèles par page : on cherche le bloc précédé du nom exact, sinon le seul bloc présent.
      const dimRe = /(?:\| (Pixel[^|]*?|Plié|Déplié) \| (?:: )?)?([\d,]+) mm \(hauteur\) x ([\d,]+) mm \(largeur\) x ([\d,]+) mm \(profondeur\)(?: \| (?:(Pixel[^|]*?) \| )?([\d,]+) g)?/g;
      const raw: { label: string | null; fold: string | null; h: number; w: number; t: number; g: number | null }[] = [];
      let d: RegExpExecArray | null;
      while ((d = dimRe.exec(text))) {
        const l = (d[1] ?? d[5] ?? null)?.trim() ?? null;
        const fold = l === "Plié" || l === "Déplié" ? l : null;
        raw.push({ label: fold ? null : l, fold, h: num(d[2]), w: num(d[3]), t: num(d[4]), g: d[6] ? num(d[6]) : null });
      }
      // Pliable : le poids est indiqué une fois après « Déplié » ; il vaut pour l'appareil.
      raw.forEach((b, i) => { if (b.g === null) b.g = raw.slice(i + 1).find((x) => x.g !== null)?.g ?? null; });
      const blocks = raw.filter((b) => b.fold !== "Déplié" && b.g !== null) as { label: string | null; h: number; w: number; t: number; g: number }[];
      const labelled = blocks.filter((b) => b.label === p.name);
      const pool = labelled.length ? labelled : blocks.every((b) => !b.label) ? blocks : [];
      // Pliable : dimensions de l'appareil fermé (la plus petite largeur), comme pour les autres pliables.
      const block = /Fold/i.test(p.name) ? [...pool].sort((x, y) => x.w - y.w)[0] ?? null : pool.length === 1 ? pool[0] : null;
      const batteries = [...text.matchAll(/(?:(Pixel[^|]*?) \| )?[^|]*?Capacité standard de ([\d ]+) mAh/g)].map((b) => ({ label: b[1]?.trim() ?? null, mah: num(b[2]) }));
      const battery = batteries.find((b) => b.label === p.name) ?? (batteries.length === 1 ? batteries[0] : null);
      if (!block && !battery) continue;
      if (block) {
        upsertSpec(db, p.id, "height_mm", block.h, "Google Store — caractéristiques techniques", url, stats);
        upsertSpec(db, p.id, "width_mm", block.w, "Google Store — caractéristiques techniques", url, stats);
        upsertSpec(db, p.id, "thickness_mm", block.t, "Google Store — caractéristiques techniques", url, stats);
        upsertSpec(db, p.id, "weight_g", block.g, "Google Store — caractéristiques techniques", url, stats);
      }
      if (battery) upsertSpec(db, p.id, "battery_mah", battery.mah, "Google Store — caractéristiques techniques", url, stats);
      // Page consacrée à un seul modèle : les autres champs sont sans ambiguïté.
      const single = blocks.length === 1 && !blocks[0].label && !/Fold/i.test(p.name);
      if (single) {
        const src = "Google Store — caractéristiques techniques";
        const mm = text.match(/Écran Actua(?: Super)? de ([\d,]+) mm/)?.[1];
        if (mm) upsertSpec(db, p.id, "screen_in", Math.round((num(mm) / 25.4) * 10) / 10, src, url, stats);
        const res = text.match(/OLED \(([\d ]+) x ([\d ]+) pixels\)/);
        if (res) upsertSpec(db, p.id, "resolution", `${Math.max(num(res[1]), num(res[2]))} × ${Math.min(num(res[1]), num(res[2]))}`, src, url, stats);
        const hz = text.match(/Affichage fluide \((?:de \d+ )?(?:à|jusqu'à) (\d+) Hz\)/)?.[1];
        if (hz) upsertSpec(db, p.id, "refresh_hz", Number(hz), src, url, stats);
        const chip = text.match(/\| Processeur \| Google (Tensor G\d+)/)?.[1];
        if (chip) upsertSpec(db, p.id, "chip", chip, src, url, stats);
        const ip = text.match(/Certification (IP\d+)/)?.[1];
        if (ip) upsertSpec(db, p.id, "ip", ip, src, url, stats);
        if (/Cartes SIM \|[^|]*eSIM/.test(text)) upsertSpec(db, p.id, "esim", true, src, url, stats);
        const cfg = [...text.matchAll(/\| (\d+) (Go|To) \/ (\d+) Go de RAM/g)];
        for (const c of cfg) {
          const gb = Number(c[1]) * (c[2] === "To" ? 1024 : 1);
          db.prepare("INSERT INTO configs (id, model_id, storage_gb, ram_gb) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET ram_gb=excluded.ram_gb").run(`${p.id}-${gb}`, p.id, gb, Number(c[3]));
        }
        if (cfg.length) upsertSpec(db, p.id, "ram_gb", Number(cfg[0][3]), src, url, stats);
      }
      break;
    }
  }
}

// ───────────────────────── Apple : absence d'échéance vérifiée ─────────────────────────

/**
 * Apple ne publie pas de durée de suivi. On le vérifie sur sa page officielle des mises à jour de
 * sécurité : si aucune durée n'y figure, les iPhone sans échéance passent en « aucune échéance
 * annoncée (vérifié) » — distinct d'une politique que le site n'a pas encore vérifiée.
 */
export async function verifyAppleNoDeadline(db: DatabaseSync, stats: Stats) {
  const URL_ = "https://support.apple.com/fr-fr/100100";
  const text = flatText(await get(URL_)).replace(/&[a-z]+;/g, " ");
  if (!/mises . jour de s.curit. Apple/i.test(text)) throw new Error("page Apple inattendue");
  if (/pendant (\d+|cinq|six|sept|huit) ans|(\d+|cinq|six|sept) ans de (mises à jour|correctifs)/i.test(text)) {
    stats.notes.push("une durée semble publiée par Apple : vérification manuelle nécessaire");
    return;
  }
  const r = db.prepare(`UPDATE support SET level='absence_verifiee', checked_at=?, policy_url=?,
      upgrade_commitment='Apple ne publie aucune durée ni échéance de mises à jour pour l''iPhone (vérifié sur la page officielle des mises à jour de sécurité).'
    WHERE model_id IN (SELECT id FROM models WHERE brand_id='apple') AND security_end IS NULL`).run(today(), URL_);
  stats.updated += Number(r.changes);
}

// ───────────────────────── Samsung France : fiche produit officielle ─────────────────────────

const FR_MONTHS: Record<string, number> = { janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12 };

/** Paires « libellé | valeur » du tableau « Caractéristiques » d'une fiche samsung.com/fr. */
export function parseSamsungSpecTable(text: string): Map<string, string> {
  const start = text.indexOf("| Caractéristiques | Tout ouvrir |");
  const end = text.indexOf("| Avis |", start);
  const section = start >= 0 ? text.slice(start, end > start ? end : undefined) : "";
  const toks = section.split("|").map((t) => t.trim().replace(/&quot;/g, '"').replace(/&lt;/g, "<")).filter(Boolean);
  const out = new Map<string, string>();
  for (let i = 0; i + 1 < toks.length; i++) if (!out.has(toks[i])) out.set(toks[i], toks[i + 1]);
  return out;
}

export function samsungSpecsFrom(t: Map<string, string>, foldable = false) {
  const v: Record<string, unknown> = {};
  const size = t.get("Taille (Écran principal)")?.match(/\(([\d.]+)"/);
  if (size) v.screen_in = Number(size[1]);
  const res = t.get("Résolution (Écran principal)")?.match(/(\d+)\s*x\s*(\d+)/);
  if (res) v.resolution = `${Math.max(+res[1], +res[2])} × ${Math.min(+res[1], +res[2])}`;
  if (t.get("Technologie (Écran principal)")) v.screen_tech = t.get("Technologie (Écran principal)");
  const hz = t.get("Taux de rafraîchissement (Écran principal)")?.match(/(\d+)\s*Hz/);
  if (hz) v.refresh_hz = Number(hz[1]);
  const cams = t.get("Résolution de l’appareil photo arrière (Multiple)") ?? t.get("Résolution de l'appareil photo arrière (Multiple)");
  if (cams) v.cameras = cams.split("+").map((c) => `${Number(c.replace(/[^\d.]/g, ""))} Mpx`).join(" + ");
  const ois = t.get("Stabilisation optique");
  if (ois === "Oui" || ois === "Non") v.ois = ois === "Oui";
  const zoom = t.get("Zoom");
  if (zoom) {
    // Seul un vrai zoom optique compte (« de qualité optique » est un recadrage du capteur principal).
    const optical = zoom.split(/[,;]/).filter((seg) => /optique/i.test(seg) && !/qualit/i.test(seg));
    const factors = optical.flatMap((seg) => [...seg.matchAll(/(\d+(?:\.\d+)?)\s*x/gi)].map((m) => Number(m[1])));
    if (factors.length) v.optical_zoom = Math.max(...factors);
    else if (/digital|numérique|qualit/i.test(zoom)) v.optical_zoom = 1;
  }
  if (t.get("Résolution enregistrement vidéo")) v.video = t.get("Résolution enregistrement vidéo");
  const ram = t.get("Mémoire (Go)")?.match(/([\d.]+)\s*Go/);
  if (ram) v.ram_gb = Number(ram[1]);
  const ext = t.get("Stockage externe support");
  if (ext) v.expandable = !/^Non/i.test(ext);
  const infra = t.get("Infra");
  if (infra) v.five_g = /5G/.test(infra);
  const simType = `${t.get("Type d'emplacement SIM") ?? ""} ${t.get("Taille de la SIM") ?? ""} ${t.get("Nombre de SIM") ?? ""}`;
  if (/eSIM/i.test(simType)) v.esim = true;
  const nfc = t.get("NFC");
  if (nfc === "Oui" || nfc === "Non") v.nfc = nfc === "Oui";
  // Pliables : on retient l'appareil fermé ; sans libellé explicite « plié/fermé », on n'écrit rien.
  const dimKey = foldable ? [...t.keys()].find((k) => /^Dimensions.*(Plié|Fermé)/i.test(k)) : "Dimensions (L x l x h, mm)";
  const dims = dimKey ? t.get(dimKey)?.match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)/) : null;
  if (dims) Object.assign(v, { height_mm: +dims[1], width_mm: +dims[2], thickness_mm: +dims[3] });
  const w = t.get("Poids (g)")?.match(/[\d.]+/);
  if (w) v.weight_g = Number(w[0]);
  const bat = t.get("Capacité de la batterie (mAh, Typique)")?.match(/\d+/);
  if (bat) v.battery_mah = Number(bat[0]);
  const ip = [...t.values()].find((x) => /^IP\d{2}$/.test(x));
  if (ip) v.ip = ip;
  const storage = t.get("Stockage (Go)")?.match(/(\d+)\s*(Go|To)/);
  const sec = (t.get("Mise à jour de sécurité jusqu’au") ?? t.get("Mise à jour de sécurité jusqu'au"))?.match(/(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i);
  return {
    specs: v,
    storageGb: storage ? Number(storage[1]) * (storage[2] === "To" ? 1024 : 1) : null,
    securityEnd: sec && FR_MONTHS[sec[2].toLowerCase()] ? `${sec[3]}-${String(FR_MONTHS[sec[2].toLowerCase()]).padStart(2, "0")}-${sec[1].padStart(2, "0")}` : null,
  };
}

export async function importSamsungSpecs(db: DatabaseSync, stats: Stats) {
  const pages = db.prepare(`SELECT DISTINCT c.model_id, o.url, c.storage_gb, m.form_factor FROM offers o JOIN configs c ON c.id=o.config_id
    JOIN models m ON m.id=c.model_id WHERE o.source='samsung-fr' AND o.is_test=0`).all() as { model_id: string; url: string; storage_gb: number; form_factor: string | null }[];
  const done = new Set<string>();
  for (const p of pages) {
    let text: string;
    try {
      text = flatText(await get(p.url));
    } catch (e) {
      stats.notes.push(`fiche Samsung inaccessible : ${p.url} (${(e as Error).message})`);
      continue;
    }
    const parsed = samsungSpecsFrom(parseSamsungSpecTable(text), p.form_factor === "pliable");
    if (parsed.storageGb !== null && parsed.storageGb !== p.storage_gb)
      stats.notes.push(`écart de capacité : ${p.url} indique ${parsed.storageGb} Go, offre enregistrée en ${p.storage_gb} Go`);
    if (done.has(p.model_id)) continue;
    if (!Object.keys(parsed.specs).length) {
      stats.notes.push(`tableau de caractéristiques introuvable : ${p.url}`);
      continue;
    }
    done.add(p.model_id);
    for (const [k, v] of Object.entries(parsed.specs)) upsertSpec(db, p.model_id, k, v, "Samsung France — fiche produit (samsung.com/fr)", p.url, stats);
    if (parsed.securityEnd) {
      db.prepare(`INSERT INTO support (model_id, security_end, security_end_precision, upgrade_commitment, source_name, source_url, policy_url, checked_at, level)
          VALUES (?,?, 'jour', ?, ?, ?, ?, ?, 'officiel')
        ON CONFLICT(model_id) DO UPDATE SET security_end=excluded.security_end, security_end_precision='jour', source_name=excluded.source_name,
          source_url=excluded.source_url, checked_at=excluded.checked_at, level='officiel',
          upgrade_commitment=COALESCE(support.upgrade_commitment, excluded.upgrade_commitment)`).run(
        p.model_id, parsed.securityEnd, `Samsung (fiche produit France) : mises à jour de sécurité jusqu'au ${parsed.securityEnd.split("-").reverse().join("/")}.`,
        "Samsung France — fiche produit (« Mise à jour de sécurité jusqu'au »)", p.url, "https://security.samsungmobile.com/workScope.smsb", today(),
      );
    }
  }
}

// ───────────────────────── Xiaomi France : page « Caractéristiques » officielle ─────────────────────────

export function parseXiaomiSpecs(text: string, modelName: string) {
  // Deux formats de page coexistent sur mi.com/fr : récent (« Hauteur : … ») et 2023 (« 165,66 x 75,96 x 7,85 mm »).
  const t = text.replace(/’/g, "'").replace(/®|™/g, "").replace(/ultra-grand-angle/gi, "ultra grand-angle");
  const v: Record<string, unknown> = {};
  const h = t.match(/Hauteur : ([\d,]+) mm/);
  const w = t.match(/Largeur : ([\d,]+) mm/);
  const e = t.match(/Épaisseur : ([\d,]+) mm/);
  const p = t.match(/Poids : ([\d,]+) g/);
  if (h && w && e) Object.assign(v, { height_mm: num(h[1]), width_mm: num(w[1]), thickness_mm: num(e[1]) });
  else {
    const d = t.match(/\| ([\d,]+) x ([\d,]+) x ([\d,]+) mm \|/);
    if (d) Object.assign(v, { height_mm: num(d[1]), width_mm: num(d[2]), thickness_mm: num(d[3]) });
  }
  if (p) v.weight_g = num(p[1]);
  else {
    const g = t.match(/ mm \| ([\d,]+) g \|/);
    if (g) v.weight_g = num(g[1]);
  }
  const bat = t.match(/Batterie (?:de )?([\d ]+) mAh/) ?? t.match(/\| Batterie \| ([\d ]+) mAh/) ?? t.match(/(\d[\d ]{2,5}) ?mAh/);
  if (bat) v.battery_mah = num(bat[1]);
  const charge = t.match(/(?:HyperCharge|Charge(?: turbo| rapide| filaire)?)(?: de| jusqu'à)? (\d+) ?W(?![/\w])/i);
  if (charge) v.charge_w = Number(charge[1]);
  const scr = t.match(/\| Écran ([^|]*?)(?: de)? ([\d,]+) pouces/);
  const scr2 = t.match(/\| ([\d,]+) ?(?:″|"|pouces) écran ([^|]+?) \|/);
  if (scr) {
    v.screen_in = num(scr[2]);
    if (scr[1].trim()) v.screen_tech = scr[1].trim();
  } else if (scr2) {
    v.screen_in = num(scr2[1]);
    v.screen_tech = scr2[2].trim();
  } else {
    const scr3 = t.match(/\| ((?:Grand )?[EÉé]cran[^|]*?)(\d[,.]\d{1,2}) ?(?:pouces|"|″|”)/) ?? t.match(/\| (?:[EÉ]cran \| )([^|]*?)(\d[,.]\d{1,2}) ?(?:pouces|"|″|”)/);
    if (scr3) {
      v.screen_in = num(scr3[2].replace(".", ","));
      const tech = scr3[1].replace(/^(?:Grand )?[EÉé]cran/i, "").replace(/\b(FHD\+|HD\+)/g, "").replace(/^\s*de\b/, "").replace(/\s+/g, " ").trim();
      if (tech) v.screen_tech = tech;
    }
  }
  const res = t.match(/Résolution : [^|]*?(\d[\d ]{2,4})\s*[x×]\s*(\d[\d ]{2,4})/);
  if (res) v.resolution = `${Math.max(num(res[1]), num(res[2]))} × ${Math.min(num(res[1]), num(res[2]))}`;
  const hz = t.match(/Taux de rafraîchissement : (?:jusqu'à )?(\d+) Hz/);
  if (hz) v.refresh_hz = Number(hz[1]);
  const chipRaw = t.match(/\| (?:Processeur|Chipset) \| ([^|]+?) \|/)?.[1] ?? t.match(/\b((?:Snapdragon|MediaTek|UNISOC|Dimensity|Helio)[^|,]{1,30})/)?.[1];
  if (chipRaw)
    v.chip = chipRaw.replace(/\s*Mobile Platform/i, "").replace(/^Plateforme mobile /i, "").replace(/^Processeur /i, "")
      .replace(/\s+(?:gravure|Technologie|processeur|CPU).*$/i, "").trim();
  // Appareils photo arrière (section avant « Caméra avant »)
  const rearEnd = t.indexOf("Caméra avant");
  const rear = rearEnd > 0 ? t.slice(Math.max(0, t.indexOf("Caméra arrière")), rearEnd) : t;
  const cams = [...rear.matchAll(/\| (Caméra principale|Objectif principal|Caméra ultra grand-angle|Objectif ultra grand-angle|Téléobjectif|Caméra téléobjectif|Objectif macro|Caméra macro|Caméra de profondeur|Caméra)(?: de)? (\d+) ?MP/g)]
    .map((m, i) => `${m[2]} Mpx ${i === 0 && m[1] === "Caméra" ? "principal" : m[1].replace(/^Caméra |^Objectif /, "").replace(/^principale$/, "principal")}`);
  if (!cams.length) {
    const main = rear.match(/(?:caméra|appareil photo)[^|]{0,20}? (\d+) ?MP/i);
    if (main) cams.push(`${main[1]} Mpx principal`);
  }
  if (cams.length) v.cameras = [...new Set(cams)].join(", ");
  if (/\bOIS\b|stabilisation optique/i.test(rear)) v.ois = true;
  const zoom = rear.match(/zoom optique (?:de )?(\d+(?:,\d+)?) ?x/i);
  if (zoom) v.optical_zoom = num(zoom[1]);
  else if (cams.length && !/Téléobjectif/i.test(rear)) v.optical_zoom = 1;
  const video = t.match(/Enregistrement vidéo de la caméra arrière \| ([^|]+?) \|/);
  if (video) v.video = video[1].trim();
  // Réseau
  if (/5G/.test(modelName) || /Prend en charge la 5G/i.test(t) || /5G ?: ?(?:SA|NSA|Prise en charge|n\d)/i.test(t)) v.five_g = true;
  else if (/Prend en charge la 4G|4G ?: ?LTE/i.test(t)) v.five_g = false;
  if (/eSIM/i.test(t.slice(t.indexOf("Réseau")))) v.esim = true;
  if (/\| NFC \| Oui|Prend en charge (?:le )?NFC|\| NFC \|/i.test(t) && !/\| NFC \| Non/.test(t)) v.nfc = true;
  if (/Stockage extensible|microSD/i.test(t)) v.expandable = true;
  const ips = [...new Set([...t.matchAll(/\bIP6[4-9]\b/g)].map((m) => m[0]))].sort();
  if (ips.length) v.ip = ips.join("/");
  // Capacités vendues : « 8 Go + 256 Go » (récent) ou « 4+128/6+128 » (2023)
  let configs = [...t.matchAll(/\| (\d+) ?(?:Go|GB) ?\+ ?(\d+) ?(Go|To|GB|TB)/g)].map((m) => ({ ram: Number(m[1]), storage: Number(m[2]) * (/T/.test(m[3]) ? 1024 : 1) }));
  if (!configs.length) {
    const mem = t.match(/\| (?:Mémoire|Stockage et RAM|RAM et stockage) \| ([^|]+)/)?.[1] ?? "";
    configs = [...mem.matchAll(/(\d+)\s*(?:Go)?\s*\+\s*(\d+)\s*(?:Go)?/g)].map((m) => ({ ram: Number(m[1]), storage: Number(m[2]) })).filter((c) => c.storage >= 32);
  }
  const seen = new Set<string>();
  configs = configs.filter((c) => (seen.has(`${c.ram}+${c.storage}`) ? false : (seen.add(`${c.ram}+${c.storage}`), true)));
  return { specs: v, configs };
}

/** Adresse de la page « specs » à partir d'une adresse de boutique (…/buy/?gid=… → …/specs/). */
export function xiaomiSpecsUrl(shopUrl: string): string {
  const u = new URL(shopUrl);
  u.search = "";
  u.pathname = u.pathname.replace(/\/buy\/?$/, "/specs/");
  if (!u.pathname.endsWith("/specs/")) u.pathname = u.pathname.replace(/\/?$/, "/specs/");
  return u.toString();
}

/** Adresses candidates mi.com/fr pour un modèle sans offre (identifiant du site, puis sans « -5g »). */
export function xiaomiSlugCandidates(modelId: string): string[] {
  const slugs = [modelId, modelId.replace(/-5g$/, "")];
  return [...new Set(slugs)].map((s) => `https://www.mi.com/fr/product/${s}/specs/`);
}

export async function importXiaomiSpecs(db: DatabaseSync, stats: Stats) {
  // Tous les modèles Xiaomi, REDMI et POCO : d'abord la page liée à une offre de la boutique, sinon l'adresse déduite
  // de l'identifiant du modèle (les pages des modèles retirés de la vente restent souvent en ligne).
  const models = db.prepare(`SELECT m.id, m.name FROM models m WHERE m.brand_id IN ('xiaomi','redmi','poco') AND m.is_test=0`).all() as { id: string; name: string }[];
  const shop = new Map<string, string>();
  for (const o of db.prepare(`SELECT DISTINCT c.model_id, o.url FROM offers o JOIN configs c ON c.id=o.config_id WHERE o.source='xiaomi-fr' AND o.is_test=0`).all() as { model_id: string; url: string }[])
    if (!shop.has(o.model_id)) shop.set(o.model_id, xiaomiSpecsUrl(o.url));
  let found = 0;
  const missing: string[] = [];
  for (const m of models) {
    const urls = [...new Set([shop.get(m.id), ...xiaomiSlugCandidates(m.id)].filter((u): u is string => !!u))];
    let done = false;
    for (const url of urls) {
      let text: string;
      try {
        const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, "Accept-Language": "fr-FR,fr;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(45_000) });
        if (!res.ok || res.url.includes("/errors/")) continue;
        text = flatText(await res.text()).replace(/’/g, "'");
      } catch {
        continue;
      }
      const { specs, configs } = parseXiaomiSpecs(text, m.name);
      if (Object.keys(specs).length < 4) continue;
      for (const [k, v] of Object.entries(specs)) upsertSpec(db, m.id, k, v, "Xiaomi France — caractéristiques (mi.com/fr)", url, stats);
      // Configurations annoncées (sans prix : un prix n'est jamais déduit d'une configuration).
      for (const c of configs)
        db.prepare("INSERT INTO configs (id, model_id, storage_gb, ram_gb) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET ram_gb=excluded.ram_gb").run(`${m.id}-${c.storage}`, m.id, c.storage, c.ram);
      if (configs.length) upsertSpec(db, m.id, "ram_gb", Math.min(...configs.map((c) => c.ram)), "Xiaomi France — caractéristiques (mi.com/fr)", url, stats);
      done = true;
      found++;
      break;
    }
    if (!done) missing.push(m.id);
    await new Promise((r) => setTimeout(r, 300));
  }
  stats.notes.push(`${found}/${models.length} modèles lus sur mi.com/fr` + (missing.length ? ` ; page officielle introuvable : ${missing.join(", ")}` : ""));
}
