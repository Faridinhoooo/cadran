/**
 * Fiches officielles ASUS : pages « Caractéristiques » françaises (rog.asus.com/fr/phones/<slug>/spec/ et
 * asus.com/fr/mobile-handhelds/phones/zenfone/<slug>/techspec/). Textes en partie en anglais sur le site français.
 * robots.txt d'ASUS n'interdit que les pages de recherche.
 */
import { flatText } from "./official";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
export const ASUS_MODELS = [
  { url: "https://rog.asus.com/fr/phones/rog-phone-7/spec/", name: "ASUS ROG Phone 7", series: "ROG Phone" },
  { url: "https://rog.asus.com/fr/phones/rog-phone-8/spec/", name: "ASUS ROG Phone 8", series: "ROG Phone" },
  { url: "https://rog.asus.com/fr/phones/rog-phone-8-pro/spec/", name: "ASUS ROG Phone 8 Pro", series: "ROG Phone" },
  { url: "https://rog.asus.com/fr/phones/rog-phone-9/spec/", name: "ASUS ROG Phone 9", series: "ROG Phone" },
  { url: "https://rog.asus.com/fr/phones/rog-phone-9-pro/spec/", name: "ASUS ROG Phone 9 Pro", series: "ROG Phone" },
  { url: "https://www.asus.com/fr/mobile-handhelds/phones/zenfone/zenfone-10/techspec/", name: "ASUS Zenfone 10", series: "Zenfone" },
  { url: "https://www.asus.com/fr/mobile-handhelds/phones/zenfone/zenfone-11-ultra/techspec/", name: "ASUS Zenfone 11 Ultra", series: "Zenfone" },
  { url: "https://www.asus.com/fr/mobile-handhelds/phones/zenfone/zenfone-12-ultra/techspec/", name: "ASUS Zenfone 12 Ultra", series: "Zenfone" },
];

const TOP = /^(Couleur|Poids et dimensions|Syst[èe]me d'exploitation|Processeur|M[ée]moire|Stockage|[ÉE]cran|Affichage|Cam[ée]ra arri[èe]re|Cam[ée]ra avant|Enregistrement vid[ée]o|Audio|Technologie sans fil|Navigation|Cartes SIM|Norme de r[ée]seau|Capteurs?|Batterie|Adaptateur d'alimentation|Dans l'emballage)$/i;

function section(cells: string[], label: RegExp): string {
  const i = cells.findIndex((c) => label.test(c));
  if (i < 0) return "";
  const out: string[] = [];
  for (let k = i + 1; k < cells.length && !TOP.test(cells[k]); k++) out.push(cells[k]);
  return out.join(" | ");
}

export function parseAsusSpecs(pageText: string, modelName: string) {
  // Partie « caractéristiques » : à partir de la première rubrique « Couleur » suivie d'une valeur.
  const t = pageText.replace(/ \| ® \| /g, " ").replace(/[®™]/g, "").replace(/’/g, "'");
  const cells = t.split(" | ").map((c) => c.trim());
  const start = cells.findIndex((c, i) => /^Poids et dimensions$/i.test(c) && /\d ?g\b/.test(cells[i + 1] ?? ""));
  const sc = start >= 0 ? cells.slice(start) : cells;
  const v: Record<string, unknown> = {};

  const dims = section(sc, /^Poids et dimensions$/i);
  const d = dims.match(/(\d+(?:\.\d+)?) ?x ?(\d+(?:\.\d+)?) ?x ?(\d+(?:\.\d+)?)(?:~\d+(?:\.\d+)?)? ?mm/i);
  if (d) Object.assign(v, { height_mm: Number(d[1]), width_mm: Number(d[2]), thickness_mm: Number(d[3]) });
  const g = dims.match(/(\d{3}(?:\.\d+)?) ?g\b/i);
  if (g) v.weight_g = Number(g[1]);

  const chip = section(sc, /^Processeur$/i).match(/Snapdragon\s+([0-9A-Za-z+ ]+?)(?:\s+Mobile Platform|,|\s+\d\.\d ?GHz)/i);
  if (chip) v.chip = `Snapdragon ${chip[1].trim()}`;

  const rams = [...section(sc, /^M[ée]moire$/i).matchAll(/(\d{1,2}) ?GB/gi)].map((m) => Number(m[1]));
  if (rams.length) v.ram_gb = Math.min(...rams);
  const storages = [...new Set([...section(sc, /^Stockage$/i).matchAll(/(\d{3,4}|1) ?(GB|TB)/gi)].map((m) => Number(m[1]) * (m[2].toUpperCase() === "TB" ? 1024 : 1)))].filter((s) => s >= 64);
  const configs = storages.map((s) => ({ ram: null as number | null, storage: s }));

  const scr = section(sc, /^([ÉE]cran|Affichage)$/i);
  const size = scr.match(/(\d\.\d{1,2}) ?-?(?:"|”|inch)/i);
  if (size) v.screen_in = Number(size[1]);
  const res = scr.match(/\((\d{3,4}) ?x ?(\d{3,4})/i);
  if (res) v.resolution = `${res[1]} × ${res[2]}`;
  const hz = [...scr.matchAll(/(\d{2,3}) ?Hz/gi)].map((m) => Number(m[1])).filter((x) => x <= 165);
  if (hz.length) v.refresh_hz = Math.max(...hz);
  const tech = scr.match(/\b(AMOLED|OLED|LCD)\b/i);
  if (tech) v.screen_tech = tech[1].toUpperCase();

  const rear = section(sc, /^Cam[ée]ra arri[èe]re$/i);
  const parts = rear.split(/\|\s*(?=(?:Main|Second|Third|Fourth|Ultra[- ]?wide|Telephoto|Macro)(?: Rear)? Camera)/i);
  const lenses = parts.map((p) => {
    const mp = p.match(/(\d{1,3}) ?MP/i);
    if (!mp) return null;
    const kind = /ultra ?-?wide/i.test(p) ? "ultra grand-angle" : /optical zoom|telephoto|t[ée]l[ée]objectif/i.test(p) ? "téléobjectif" : /macro/i.test(p) ? "macro" : "principal";
    return { mp: Number(mp[1]), kind };
  }).filter((x): x is { mp: number; kind: string } => !!x)
    .filter((l, i, a) => a.findIndex((o) => o.mp === l.mp && o.kind === l.kind) === i);
  if (lenses.length) {
    const order = ["principal", "ultra grand-angle", "téléobjectif", "macro"];
    lenses.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    v.cameras = lenses.map((l) => `${l.mp} Mpx ${l.kind}`).join(", ");
    v.ois = /OIS/i.test(rear);
    const z = rear.match(/(\d(?:\.\d)?) ?X optical zoom/i);
    if (z) v.optical_zoom = Number(z[1]);
    else if (!lenses.some((l) => l.kind === "téléobjectif")) v.optical_zoom = 1;
  }
  const vid = section(sc, /^Enregistrement vid[ée]o$/i).match(/(8K|4K) UHD[^|]*?(\d{2,3}) ?fps/i);
  if (vid) v.video = `${vid[1]} à ${vid[2]} ips`;

  const bat = section(sc, /^Batterie$/i);
  const mah = bat.match(/(\d[\d,]{3,5}) ?mAh/i);
  if (mah) v.battery_mah = Number(mah[1].replace(/,/g, ""));
  const w = [...(bat + " " + section(sc, /^Adaptateur d'alimentation$/i)).matchAll(/(\d{2,3}) ?W\b/gi)].map((m) => Number(m[1])).filter((x) => x <= 240);
  if (w.length) v.charge_w = Math.max(...w);
  if (/wireless charging|Qi/i.test(bat)) v.wireless = true;

  const net = section(sc, /^Norme de r[ée]seau$/i);
  if (/5G/i.test(net) || /\b5G\b/.test(modelName)) v.five_g = true;
  if (/eSIM/i.test(section(sc, /^Cartes SIM$/i))) v.esim = true;
  if (/NFC/i.test(section(sc, /^Technologie sans fil$/i))) v.nfc = true;
  const ci = cells.findIndex((c, i) => /^Couleur$/i.test(c) && cells[i + 1] && !TOP.test(cells[i + 1]));
  if (ci >= 0) {
    const colors: string[] = [];
    for (let k = ci + 1; k < cells.length && !TOP.test(cells[k]); k++) if (cells[k].length < 30 && !colors.includes(cells[k])) colors.push(cells[k]);
    if (colors.length) v.colors = colors;
  }
  const ip = dims.match(/\bIP(6[4-8]|5[45])\b/);
  if (ip) v.ip = `IP${ip[1]}`;
  return { specs: v, configs };
}

export async function fetchAsusSpecs(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" }, signal: AbortSignal.timeout(45_000) });
    if (!res.ok || !res.url.includes("spec")) return null;
    const text = flatText(await res.text());
    return /mAh/i.test(text) ? text : null;
  } catch {
    return null;
  }
}
