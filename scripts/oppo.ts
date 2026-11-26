/**
 * Fiches officielles OPPO : pages « Caractéristiques » des sites OPPO francophones.
 * Ordre de préférence : France, puis Belgique (fr), Luxembourg, puis Maroc, Tunisie, Algérie (pages retirées du site
 * français pour les anciens modèles). Seules les caractéristiques matérielles sont reprises ; l'édition utilisée est
 * indiquée dans la source de chaque valeur. Le fichier robots.txt d'OPPO n'interdit pas ces pages.
 */
import fs from "node:fs";
import path from "node:path";
import { flatText } from "./official";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
export const OPPO_LOCALES = [
  { code: "fr", label: "France" },
  { code: "befr", label: "Belgique" },
  { code: "lu", label: "Luxembourg" },
  { code: "ma", label: "Maroc" },
  { code: "tn", label: "Tunisie" },
  { code: "dz", label: "Algérie" },
] as const;

const n = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

/** Cellules qui suivent un libellé (texte aplati « a | b | c »), jusqu'à `count` cellules. */
function cellsAfter(cells: string[], label: RegExp, count = 3): string[] {
  const i = cells.findIndex((c) => label.test(c.trim()));
  return i < 0 ? [] : cells.slice(i + 1, i + 1 + count);
}
/** Valeur en mm/g : pour un pliable, la valeur « Plié », sinon la première. */
function measure(cells: string[], unit: "mm" | "g"): number | null {
  const re = unit === "mm" ? /(\d+(?:[.,]\d+)?) ?mm\b/i : /(\d+(?:[.,]\d+)?) ?g\b/i;
  // Pliable : valeur « Plié », dans la même cellule ou dans la suivante (« Plié : | Édition verre : environ 11,7 mm »).
  const fi = cells.findIndex((c) => /pli[ée]\s*:/i.test(c));
  const folded = fi >= 0 ? cells.slice(fi, fi + 3).find((c) => re.test(c)) : undefined;
  const m = (folded ?? cells.find((c) => re.test(c)))?.match(re);
  return m ? n(m[1]) : null;
}

export function parseOppoSpecs(text: string, modelName: string) {
  const t = text.replace(/’/g, "'").replace(/[®™]/g, "").replace(/：/g, ":").replace(/\s+\|\s+TM\s+\|\s+/g, " ");
  const cells = t.split(" | ").map((c) => c.trim());
  const v: Record<string, unknown> = {};

  const h = measure(cellsAfter(cells, /^Hauteur$/i, 2), "mm");
  const w = measure(cellsAfter(cells, /^Largeur$/i, 2), "mm");
  const e = measure(cellsAfter(cells, /^[ÉE]paisseur$/i, 6), "mm");
  const g = measure(cellsAfter(cells, /^Poids$/i, 2), "g");
  if (h && w && e) Object.assign(v, { height_mm: h, width_mm: w, thickness_mm: e });
  if (g) v.weight_g = g;

  // Configurations « 8 Go + 256 Go » (RAM + stockage).
  const seen = new Set<string>();
  const configs = [...t.matchAll(/\b(\d{1,2}) ?Go ?\+ ?(\d{2,4}|1|2) ?(Go|To)\b/gi)]
    .map((m) => ({ ram: Number(m[1]), storage: Number(m[2]) * (m[3].toLowerCase() === "to" ? 1024 : 1) }))
    .filter((c) => c.storage >= 32 && !seen.has(`${c.ram}+${c.storage}`) && seen.add(`${c.ram}+${c.storage}`));

  const size = t.match(/Taille \| (?:[ÉE]cran principal ?: ?)?(?:environ )?([\d]+[,.]\d+) ?pouces/i);
  if (size) v.screen_in = n(size[1]);
  const res = t.match(/(\d{3,4}) ?[x×] ?(\d{3,4}) ?pixels/i);
  if (res) v.resolution = `${res[1]} × ${res[2]}`;
  const rr = cellsAfter(cells, /^Taux de rafra[îi]chissement$/i, 2);
  const rrCell = rr.find((c) => /\d{2,3}(?:\/\d{2,3})* ?Hz/i.test(c) && !/chantillonnage/i.test(c));
  if (rrCell) v.refresh_hz = Math.max(...[...rrCell.matchAll(/\d{2,3}(?=(?:\/\d{2,3})* ?Hz)/gi)].map((m) => Number(m[0])));
  const tech = cellsAfter(cells, /^(Dalle|Type d'[ée]cran|Mat[ée]riau(?: de l'[ée]cran)?)$/i, 1)[0];
  if (tech && /OLED|LCD/i.test(tech)) v.screen_tech = tech.replace(/^[ÉE]cran principal ?: ?/i, "").replace(/\s+/g, " ");

  const chip = cellsAfter(cells, /^(Plateforme \(SoC\)|SoC|Mod[èe]le de (?:la )?puce|Processeur|Plateforme)$/i, 1)[0];
  if (chip && /snapdragon|dimensity|helio|mediatek|qualcomm|unisoc/i.test(chip))
    v.chip = chip.replace(/^Plateforme mobile\s+/i, "").replace(/^Qualcomm\s+/i, "").replace(/\s+/g, " ").trim();

  const batSeg = cellsAfter(cells, /^Capacit[ée] (?:de la )?batterie$/i, 2).join(" | ");
  const bat = batSeg.match(/(\d[\d ]{2,5}) ?mAh/i) ?? t.match(/Valeur typique ?: ?(\d[\d ]{2,5}) ?mAh/i);
  if (bat) v.battery_mah = n(bat[1]);
  const battery = t.match(/Batterie et charge \|(.*?)\| (?:Biom[ée]trie|Capteurs|R[ée]seau)/i)?.[1] ?? "";
  const watts = [...battery.matchAll(/(\d{2,3}) ?W\b/g)].map((m) => Number(m[1])).filter((x) => x <= 240);
  if (watts.length) v.charge_w = Math.max(...watts);
  if (/AIRVOOC|charge sans fil/i.test(battery)) v.wireless = true;

  // Appareils photo arrière : cellules entre « Arrière » (après « Appareil photo ») et « Avant ».
  const ap = cells.findIndex((c) => /^Appareil photo$/i.test(c));
  const ar = ap < 0 ? -1 : cells.findIndex((c, i) => i > ap && /^Arri[èe]re$/i.test(c));
  const av = ar < 0 ? -1 : cells.findIndex((c, i) => i > ar && /^Avant$/i.test(c));
  const rear = ar >= 0 && av > ar ? cells.slice(ar + 1, av) : [];
  const lenses: { mp: number; kind: string; zoom: number | null }[] = [];
  for (const c of rear) {
    const mp = c.match(/(\d{1,3}) ?MP/i);
    if (!mp) continue;
    const head = c.slice(0, c.search(/\d{1,3} ?MP/i) + 1).toLowerCase();
    const kind = /ultra[- ]?grand[- ]?angle/.test(head) ? "ultra grand-angle" : /t[ée]l[ée]objectif|p[ée]riscope/.test(head) ? "téléobjectif"
      : /macro|microlentille/.test(head) ? "macro" : /profondeur|portrait/.test(head) ? "de profondeur" : /mono/.test(head) ? "monochrome" : "principal";
    const z = kind === "téléobjectif" ? c.match(/(\d+(?:[.,]\d)?) ?x\b/i) : null;
    lenses.push({ mp: Number(mp[1]), kind, zoom: z ? n(z[1]) : null });
  }
  if (lenses.length) {
    const order = ["principal", "ultra grand-angle", "téléobjectif", "macro", "de profondeur", "monochrome"];
    lenses.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    v.cameras = lenses.map((l) => `${l.mp} Mpx ${l.kind}`).join(", ");
    v.ois = rear.some((c) => /OIS/.test(c));
    const zooms = lenses.map((l) => l.zoom).filter((z): z is number => z !== null);
    const photoZoom = t.match(/Zoom optique(?! vid)[^|]{0,20}?(\d+(?:[.,]\d)?) ?x/i);
    if (zooms.length) v.optical_zoom = Math.max(...zooms);
    else if (photoZoom) v.optical_zoom = n(photoZoom[1]);
    else if (!lenses.some((l) => l.kind === "téléobjectif")) v.optical_zoom = 1;
  }
  const vi = cells.findIndex((c, i) => i > Math.max(av, 0) && /^Vid[ée]o$/i.test(c));
  const vid = vi >= 0 ? cells.slice(vi + 1, vi + 3).find((c) => /\d{3,4}p|4K|8K/i.test(c)) : null;
  if (vid) v.video = vid.replace(/^(Vid[ée]o|Cam[ée]ra arri[èe]re|Support[ée])\s*:\s*/i, "").replace(/\s*;\s*$/, "").trim();

  const network = t.match(/R[ée]seau (?:cellulaire|celullaire) \|(.*?)\| (?:Connectivit[ée]|Wi-Fi)/i)?.[1] ?? "";
  if (/5G NR|5G ?: ?(?:SA|NSA|n\d)/i.test(network || t) || /\b5G\b/.test(modelName)) v.five_g = true;
  else if (/LTE/i.test(network || t)) v.five_g = false;
  if (/eSIM/i.test(network)) v.esim = true;
  const nfc = cellsAfter(cells, /^NFC$/i, 1)[0];
  if (nfc !== undefined) v.nfc = !/^non\b/i.test(nfc);
  const ip = [...new Set([...t.matchAll(/\bIP(6[4-9]|X[4-8])\b/g)].map((m) => `IP${m[1]}`))];
  if (ip.length) v.ip = ip.join("/");
  if (/microSD|carte (?:micro)?SD/i.test(t)) v.expandable = true;
  if (configs.length) v.ram_gb = Math.min(...configs.map((c) => c.ram));
  // Coloris : noms listés entre le code modèle « ( | CPH2659 | ) » et la mention « * Visuels / photos… ».
  const vis = cells.findIndex((c) => /^\*.*(visuels|photos des produits|images)/i.test(c));
  if (vis > 0) {
    const colors: string[] = [];
    for (let k = vis - 1; k > 0 && cells[k] !== ")" && colors.length < 8; k--) if (cells[k].length < 30) colors.unshift(cells[k]);
    if (colors.length && cells.slice(Math.max(0, vis - colors.length - 1), vis).includes(")")) v.colors = [...new Set(colors)];
  }
  return { specs: v, configs };
}

export interface OppoEntry { slug: string; name: string; series: string }

/** Inventaire OPPO (data/sources/oppo-fr.json) : page officielle → modèle du catalogue. */
export function oppoInventory(root = process.cwd()): { models: OppoEntry[] } {
  return JSON.parse(fs.readFileSync(path.join(root, "data", "sources", "oppo-fr.json"), "utf8"));
}

/** Page « Caractéristiques » d'un modèle : première édition francophone qui répond. */
export async function fetchOppoSpecs(slug: string): Promise<{ url: string; locale: string; text: string } | null> {
  for (const loc of OPPO_LOCALES) {
    const url = `https://www.oppo.com/${loc.code}/smartphones/${slug}/specs/`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) continue;
      const text = flatText(await res.text());
      if (!/Hauteur|Dimensions/i.test(text)) continue;
      return { url, locale: loc.label, text };
    } catch {
      /* édition suivante */
    }
  }
  return null;
}
