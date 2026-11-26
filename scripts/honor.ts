/**
 * Fiches officielles HONOR : pages « Caractéristiques » de honor.com/fr (…/phones/<slug>/spec/).
 * Les valeurs sont dans des attributs data-value, à la suite de chaque libellé <h3>.
 * robots.txt d'HONOR demande 30 s entre deux requêtes : les pages relevées sont conservées (libellés et valeurs
 * officiels, datés) dans data/sources/honor-specs.json et relues au plus une fois tous les 30 jours, jamais pendant un
 * déploiement. Le lecteur s'applique ensuite à cette copie, ce qui permet de l'améliorer sans retélécharger.
 */
import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
export const HONOR_CRAWL_DELAY_MS = 30_000;
export const HONOR_MAX_AGE_DAYS = 30;

export interface HonorPair { label: string; value: string }
export interface HonorPage { url: string; fetched_at: string; pairs: HonorPair[] }
export interface HonorEntry { slug: string; name: string; series: string }

const decode = (s: string) => s
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();

/** Libellés (<h3>) et valeurs (data-value) dans l'ordre de la page ; les notes « * » sont écartées. */
export function honorPairs(html: string): HonorPair[] {
  const pairs: HonorPair[] = [];
  let label: string | null = null;
  for (const m of html.matchAll(/<h3[^>]*products-spec[^>]*>([\s\S]*?)<\/h3>|data-value="([^"]*)"/g)) {
    if (m[1] !== undefined) { label = decode(m[1]); continue; }
    const value = decode(m[2]);
    if (!value || value.startsWith("*")) continue;
    pairs.push({ label: label ?? "", value });
  }
  return pairs;
}

const n = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

export function parseHonorSpecs(pairs: HonorPair[], modelName: string) {
  const get = (re: RegExp) => pairs.find((p) => re.test(p.label))?.value ?? null;
  const all = (re: RegExp) => pairs.filter((p) => re.test(p.label)).map((p) => p.value);
  const v: Record<string, unknown> = {};
  const foldedMm = (s: string | null) => {
    if (!s) return null;
    const m = s.match(/pli[ée] ?: ?([\d]+(?:[.,]\d+)?) ?mm/i) ?? s.match(/([\d]+(?:[.,]\d+)?) ?mm/i);
    return m ? n(m[1]) : null;
  };
  const h = foldedMm(get(/^Hauteur$/i));
  const w = foldedMm(get(/^Largeur$/i));
  const e = foldedMm(get(/^[ÉE]paisseur$/i));
  if (h && w && e) Object.assign(v, { height_mm: h, width_mm: w, thickness_mm: e });
  const g = get(/^Poids$/i)?.match(/(\d+(?:[.,]\d+)?) ?g\b/i);
  if (g) v.weight_g = n(g[1]);

  const size = get(/^Taille$/i);
  if (size) {
    // Pliable : écran interne (le plus grand) ; sinon la seule diagonale.
    const all = [...size.matchAll(/(\d+[,.]\d+) ?pouces/gi)].map((m) => n(m[1]));
    if (all.length) v.screen_in = Math.max(...all);
  }
  const res = get(/^R[ée]solution$/i)?.match(/(\d{3,4}) ?[x×] ?(\d{3,4})/);
  if (res) v.resolution = `${res[1]} × ${res[2]}`;
  const rr = get(/Taux de rafra[îi]chissement/i) ?? pairs.map((p) => p.value).join(" | ").match(/rafra[îi]chissement[^|]{0,40}?\d{2,3} ?Hz/i)?.[0] ?? null;
  if (rr) {
    const hz = [...rr.matchAll(/(\d{2,3}) ?Hz/gi)].map((m) => Number(m[1])).filter((x) => x <= 165);
    if (hz.length) v.refresh_hz = Math.max(...hz);
  }
  const type = all(/^Type$/i).find((t) => /OLED|LCD|TFT/i.test(t));
  if (type) v.screen_tech = type.replace(/[ÉE]cran (?:interne|principal) ?: ?/i, "").replace(/\s*[ÉE]cran externe.*$/i, "").split(/,/)[0].trim();
  const chip = get(/^Mod[èe]le de (?:CPU|processeur)$/i) ?? get(/^Processeur$/i);
  if (chip) v.chip = chip.replace(/[®™]/g, "").replace(/^(?:Processeur|Plateforme mobile)\s+/i, "").replace(/^Qualcomm\s+/i, "").replace(/Dimension (\d)/, "Dimensity $1").replace(/\s+/g, " ").trim();

  // Configurations « 8Go + 256Go » (valeur sans libellé propre, souvent rattachée à « Système »).
  const seen = new Set<string>();
  const configs = pairs.flatMap((p) => [...p.value.matchAll(/(\d{1,2}) ?Go ?\+ ?(\d{2,4}|1|2) ?(Go|To)/gi)])
    .map((m) => ({ ram: Number(m[1]), storage: Number(m[2]) * (m[3].toLowerCase() === "to" ? 1024 : 1) }))
    .filter((c) => c.storage >= 32 && !seen.has(`${c.ram}+${c.storage}`) && seen.add(`${c.ram}+${c.storage}`));
  if (configs.length) v.ram_gb = Math.min(...configs.map((c) => c.ram));

  const bat = all(/^Capacit[ée]$/i).find((x) => /mAh/i.test(x))?.match(/(\d[\d ]{2,5}) ?mAh/i);
  if (bat) v.battery_mah = n(bat[1]);
  const charge = all(/charge/i).join(" ");
  const watts = [...charge.matchAll(/(\d{2,3}) ?W\b/g)].map((m) => Number(m[1]));
  if (watts.length) v.charge_w = Math.max(...watts);
  if (pairs.some((p) => /Charge sans fil/i.test(p.label) && !/^non/i.test(p.value))) v.wireless = true;

  const rear = get(/^Appareil photo arri[èe]re$/i);
  if (rear) {
    const lenses = [...rear.matchAll(/(?:Cam[ée]ra\s+)?([^\d+]*?)\s*(\d{1,3}) ?(?:MP|Mpx)/gi)].map((m, i) => {
      const head = m[1].toLowerCase();
      // HONOR appelle « grand-angle » l'ultra grand-angle quand il n'est pas la caméra principale.
      const kind = /ultra[- ]?grand[- ]?angle/.test(head) || (i > 0 && /grand[- ]?angle/.test(head)) ? "ultra grand-angle"
        : /t[ée]l[ée]objectif|p[ée]riscope/.test(head) ? "téléobjectif"
        : /macro/.test(head) ? "macro" : /profondeur|bokeh/.test(head) ? "de profondeur" : "principal";
      return { mp: Number(m[2]), kind };
    });
    if (lenses.length) {
      const order = ["principal", "ultra grand-angle", "téléobjectif", "macro", "de profondeur"];
      lenses.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
      v.cameras = lenses.map((l) => `${l.mp} Mpx ${l.kind}`).join(", ");
      v.ois = /OIS/i.test(rear);
      const zoom = pairs.map((p) => p.value).join(" ").match(/zoom optique (\d+(?:[.,]\d)?) ?x|(\d+(?:[.,]\d)?) ?x (?:de )?zoom optique/i);
      if (zoom) v.optical_zoom = n(zoom[1] ?? zoom[2]);
      else if (!lenses.some((l) => l.kind === "téléobjectif")) v.optical_zoom = 1;
    }
  }
  const video = get(/^R[ée]solution vid[ée]o$/i) ?? get(/^Vid[ée]o$/i);
  if (video) v.video = video.replace(/^Prend en charge jusqu'à\s*/i, "jusqu'à ");

  const network = all(/Norme r[ée]seau|R[ée]seau|Carte SIM/i).join(" ");
  if (/5G/i.test(network) || /\b5G\b/.test(modelName)) v.five_g = true;
  else if (/4G|LTE/i.test(network)) v.five_g = false;
  if (/eSIM/i.test(network)) v.esim = true;
  const nfc = get(/^NFC$/i);
  if (nfc) v.nfc = !/^non\b|non pris en charge/i.test(nfc);
  const ip = [...new Set(pairs.map((p) => p.value).join(" ").match(/\bIP(?:6[4-9]|X[4-8])\b/g) ?? [])];
  if (ip.length) v.ip = ip.join("/");
  return { specs: v, configs };
}

export function honorInventory(root = process.cwd()): { models: HonorEntry[] } {
  return JSON.parse(fs.readFileSync(path.join(root, "data", "sources", "honor-fr.json"), "utf8"));
}

const CACHE = (root = process.cwd()) => path.join(root, "data", "sources", "honor-specs.json");
export function readHonorCache(root = process.cwd()): Record<string, HonorPage> {
  const f = CACHE(root);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
}

/**
 * Met à jour la copie des pages HONOR dont le relevé a plus de 30 jours (une requête toutes les 30 s).
 * Jamais pendant un déploiement Vercel : la copie versionnée suffit.
 */
export async function refreshHonorCache(slugs: string[], notes: string[], root = process.cwd()): Promise<Record<string, HonorPage>> {
  const cache = readHonorCache(root);
  if (process.env.VERCEL === "1") return cache;
  const cutoff = Date.now() - HONOR_MAX_AGE_DAYS * 864e5;
  const todo = slugs.filter((s) => !cache[s] || Date.parse(cache[s].fetched_at) < cutoff || process.env.HONOR_REFRESH === "1");
  let first = true;
  for (const slug of todo) {
    if (!first) await new Promise((r) => setTimeout(r, HONOR_CRAWL_DELAY_MS));
    first = false;
    const url = `https://www.honor.com/fr/phones/${slug}/spec/`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" }, signal: AbortSignal.timeout(45_000) });
      if (!res.ok) { notes.push(`HONOR ${slug} : HTTP ${res.status}`); continue; }
      const pairs = honorPairs(await res.text());
      if (pairs.length < 10) { notes.push(`HONOR ${slug} : caractéristiques introuvables`); continue; }
      cache[slug] = { url, fetched_at: new Date().toISOString(), pairs };
      fs.writeFileSync(CACHE(root), JSON.stringify(cache, null, 1) + "\n");
    } catch (e) {
      notes.push(`HONOR ${slug} : ${(e as Error).message}`);
    }
  }
  if (todo.length) notes.push(`${todo.length} page(s) HONOR relevée(s) (30 s entre deux pages, robots.txt)`);
  return cache;
}
