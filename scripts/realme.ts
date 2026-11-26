/**
 * Fiches officielles realme : pages « Caractéristiques techniques » de realme.com/fr (…/fr/<slug>/specs).
 * Chaque rubrique (« Écran », « Charge et batterie »…) est suivie d'un texte « Clé : valeur ». robots.txt de realme
 * n'interdit que /login et /search.
 */
import fs from "node:fs";
import path from "node:path";
import { flatText } from "./official";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
export interface RealmeEntry { slug: string; name: string; series: string }

const n = (s: string) => Number(s.replace(/[\s ]/g, "").replace(",", "."));

/** Zone des caractéristiques d'une page (entre la rubrique « Couleur » et le pied de page). */
export function realmeSpecText(pageText: string): string {
  const t = pageText.replace(/’/g, "'").replace(/[®™]/g, "").replace(/\(TM\)/g, "").replace(/，/g, ",");
  const a = t.search(/\| (?:Couleur|Color) \|/);
  const b = t.search(/Frais d'envoi gratuits|Paiements s[ée]curis[ée]s/);
  return t.slice(a >= 0 ? a : 0, b > a ? b : undefined);
}

const TOP = /^(Couleur|Color|Chipset|Processeur|Plateforme|Stockage et RAM|M[ée]moire et stockage|Stockage|M[ée]moire|[ÉE]cran|Appareil photo|Charge et batterie|Recharge et batterie|Batterie|Cellulaire et|Cellulaire et sans fil|R[ée]seau cellulaire|R[ée]seau|Dimensions et poids|Audio|Capteurs|Navigation|Ports|Boutons et prises|Syst[èe]me|Syst[èe]me d'exploitation|Contenu de la bo[îi]te|Technologie de localisation|Biom[ée]trie)$/i;

/** Rubrique : toutes les cellules qui suivent le libellé, jusqu'à la rubrique suivante. */
function section(t: string, label: RegExp): string {
  const cells = t.split(" | ").map((c) => c.replace(/^\|\s*/, "").trim());
  const i = cells.findIndex((c) => label.test(c));
  if (i < 0) return "";
  const out: string[] = [];
  for (let k = i + 1; k < cells.length && !(k > i + 1 && TOP.test(cells[k])); k++) out.push(cells[k]);
  return out.join(" | ");
}

export function parseRealmeSpecs(text: string, modelName: string) {
  const t = text;
  const v: Record<string, unknown> = {};
  const dims = section(t, /^Dimensions et poids$/i);
  const h = dims.match(/(?:Hauteur|Longueur) ?: ?(?:environ )?([\d]+[,.]\d+) ?mm/i);
  const w = dims.match(/Largeur ?: ?(?:environ )?([\d]+[,.]\d+) ?mm/i);
  const e = dims.match(/[ÉE]paisseur ?[:≈] ?(?:environ )?([\d]+[,.]\d+) ?mm/i);
  const x = dims.match(/([\d]+[,.]\d+) ?[×x] ?([\d]+[,.]\d+) ?[×x] ?([\d]+[,.]\d+) ?\(?mm/i);
  if (h && w && e) Object.assign(v, { height_mm: n(h[1]), width_mm: n(w[1]), thickness_mm: n(e[1]) });
  else if (x) Object.assign(v, { height_mm: n(x[1]), width_mm: n(x[2]), thickness_mm: n(x[3]) });
  const g = dims.match(/(?:Poids ?[:≈] ?)?(?:environ )?(\d{3}(?:[,.]\d+)?) ?g\b/i);
  if (g) v.weight_g = n(g[1]);

  const scr = section(t, /^[ÉE]cran$/i);
  const size = scr.match(/(\d[,.]\d{1,2}) ?(?:pouces|"|in\b)/i);
  if (size) v.screen_in = n(size[1]);
  const res = scr.match(/(\d[\d  ]{2,5}) ?[×x*] ?(\d[\d  ]{2,5})/);
  if (res) {
    const [a, b] = [n(res[1]), n(res[2])].sort((x, y) => y - x);
    v.resolution = `${a} × ${b}`;
  }
  const rr = scr.match(/Taux de rafra[îi]chissement ?: ?[^|]*?(\d{2,3}) ?Hz/i);
  const hz = scr.replace(/(?:chantillonnage|tactile|r[ée]activit[ée])[^|]*?\d{2,3} ?Hz/gi, "").match(/(\d{2,3}) ?Hz/i);
  if (rr) v.refresh_hz = Number(rr[1]);
  else if (hz && Number(hz[1]) <= 165) v.refresh_hz = Number(hz[1]);
  const tech = scr.match(/\b(AMOLED|OLED|LCD|IPS)\b/i);
  if (tech) v.screen_tech = tech[1].toUpperCase();

  const chipCell = section(t, /^(Processeur|Chipset|Plateforme)$/i).split(" | ")[0] ?? "";
  if (/snapdragon|dimensity|helio|unisoc|mediatek/i.test(chipCell))
    v.chip = chipCell.replace(/^(?:Plateforme mobile|Processeur)\s+/i, "").replace(/^Qualcomm\s+/i, "").replace(/\s+5G$/, "").replace(/\s+/g, " ").trim();

  const mem = section(t, /^(Stockage et RAM|M[ée]moire et stockage|Stockage|M[ée]moire)$/i);
  const rams = [...(mem.match(/RAM ?: ?([^R]*?)(?:ROM|$)/i)?.[1] ?? "").matchAll(/(\d{1,2}) ?Go/g)].map((m) => Number(m[1]));
  const roms = [...(mem.match(/ROM ?: ?([^|]*?)(?:Jusqu|\(|$)/i)?.[1] ?? "").matchAll(/(\d{2,4}|1|2) ?(Go|To)/g)].map((m) => Number(m[1]) * (m[2] === "To" ? 1024 : 1)).filter((s) => s >= 32);
  const pairs = [...mem.matchAll(/(\d{1,2}) ?Go ?\+ ?(\d{2,4}) ?Go/g)].map((m) => ({ ram: Number(m[1]), storage: Number(m[2]) }));
  if (rams.length) v.ram_gb = Math.min(...rams);
  const configs: { ram: number | null; storage: number }[] = roms.length
    ? roms.map((s) => ({ ram: null, storage: s }))
    : /jusqu/i.test(mem) ? [] : pairs.map((p) => ({ ram: p.ram, storage: p.storage }));

  const bat = section(t, /^(Charge et batterie|Recharge et batterie|Batterie)$/i);
  const mah = bat.match(/(\d[\d  ]{2,5}) ?mAh ?\((?:typ|valeur typique)/i) ?? bat.match(/(\d[\d  ]{2,5}) ?mAh/i);
  if (mah) v.battery_mah = n(mah[1]);
  const watts = [...bat.matchAll(/(\d{2,3}) ?W\b/g)].map((m) => Number(m[1])).filter((x) => x <= 240);
  if (watts.length) v.charge_w = Math.max(...watts);
  if (/sans[- ]fil/i.test(bat)) v.wireless = true;

  // Appareils photo arrière : tout ce qui précède l'appareil avant / selfie dans la rubrique « Appareil photo ».
  const cam = t.split(" | ").slice(t.split(" | ").findIndex((c) => /^Appareil photo$/i.test(c.trim())) + 1).join(" | ");
  const rear = cam.split(/Appareil photo (?:avant|selfie)|Cam[ée]ra (?:avant|selfie)|Fonctions de l'appareil photo avant/i)[0] ?? "";
  let prevEnd = 0;
  const lenses = [...rear.matchAll(/(\d{1,3}) ?MP/gi)].map((m) => {
    // Contexte : depuis la fin de l'objectif précédent, plus quelques mots après (« de 50 MP avec objectif périscope »).
    const end = m.index! + m[0].length;
    const tail = rear.slice(end, end + 40).split(/Appareil|Objectif ?:|Cam[ée]ra|R[ée]solution|Capteur/i)[0];
    const head = (rear.slice(Math.max(prevEnd, m.index! - 80), m.index!) + " " + tail).toLowerCase();
    prevEnd = end;
    const kind = /ultra[- ]?grand[- ]?angle/.test(head) ? "ultra grand-angle" : /t[ée]l[ée]objectif|p[ée]riscope/.test(head) ? "téléobjectif"
      : /macro/.test(head) ? "macro" : /profondeur|portrait|monochrome/.test(head) ? "de profondeur" : "principal";
    return { mp: Number(m[1]), kind };
  });
  // Une même caméra peut être citée deux fois (« Appareil photo IA de 64 MP | Appareil photo principal de 64 MP »).
  const uniq = lenses.filter((l, i) => !lenses.slice(0, i).some((p) => p.mp === l.mp && p.kind === l.kind));
  lenses.length = 0;
  lenses.push(...uniq);
  if (lenses.length) {
    const order = ["principal", "ultra grand-angle", "téléobjectif", "macro", "de profondeur"];
    lenses.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    v.cameras = lenses.map((l) => `${l.mp} Mpx ${l.kind}`).join(", ");
    v.ois = /OIS/i.test(rear);
    const z = t.match(/p[ée]riscope (\d+(?:[.,]\d)?) ?x|zoom optique (?:de )?(\d+(?:[.,]\d)?) ?x/i);
    if (z) v.optical_zoom = n(z[1] ?? z[2]);
    else if (!lenses.some((l) => l.kind === "téléobjectif")) v.optical_zoom = 1;
  }
  const vid = cam.match(/(8K|4K) ?@ ?(\d{2,3})/i) ?? cam.match(/(1080P) ?@ ?(\d{2,3})/i);
  if (vid) v.video = `${vid[1].toUpperCase()} à ${vid[2]} ips`;

  const net = section(t, /^(R[ée]seau cellulaire|Cellulaire et sans fil|R[ée]seau)$/i);
  if (/5G NR|\b5G\b/.test(net) || /\b5G\b/.test(modelName)) v.five_g = true;
  else if (/LTE|4G/.test(net)) v.five_g = false;
  if (/NFC (?:pris en charge|compatible)|\bNFC\b/i.test(net) || /NFC pris en charge/i.test(t)) v.nfc = true;
  if (/eSIM/i.test(net)) v.esim = true;
  const ip = [...new Set(t.match(/\bIP(?:6[4-9]|X[4-8])\b/g) ?? [])];
  if (ip.length) v.ip = ip.join("/");
  if (/carte SD|microSD/i.test(t)) v.expandable = true;
  const colors = section(t, /^(Couleur|Color)$/i).split(" | ").map((c) => c.trim()).filter((c) => c && c.length < 30 && !/^[*-]|-->/.test(c));
  if (colors.length) v.colors = colors;
  return { specs: v, configs };
}

export function realmeInventory(root = process.cwd()): { models: RealmeEntry[] } {
  return JSON.parse(fs.readFileSync(path.join(root, "data", "sources", "realme-fr.json"), "utf8"));
}

export async function fetchRealmeSpecs(slug: string): Promise<{ url: string; text: string } | null> {
  const url = `https://www.realme.com/fr/${slug}/specs`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const text = realmeSpecText(flatText(await res.text()));
    return /Dimensions et poids/i.test(text) ? { url, text } : null;
  } catch {
    return null;
  }
}
