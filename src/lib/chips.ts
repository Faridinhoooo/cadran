// Noms de puces normalisés (« Chipset MediaTek Dimensity 7050 », « Snapdragon 8 génération 2 », « 8S 3e gén. »…)
// et indice PickJust de puissance (data/sources/chip-scores.json).

/** Nom de puce lisible et comparable, ou null si le libellé ne désigne pas une puce identifiable. */
export function normalizeChip(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.normalize("NFKC").replace(/[\u{FE0F}\u{2122}\u{00AE}]/gu, "").replace(/\s+/g, " ").trim();
  s = s
    .replace(/^(?:5G |8 cœurs |Chipset |Processeur |Puce |Plateforme mobile |haut de gamme |Puce haut de gamme )+/gi, "")
    .replace(/\b(?:Qualcomm|MediaTek)\s+/gi, "")
    .replace(/\s*(?:Mobile Platform|Mobile|Chipset| en \d+ ?nm|\(SDM ?\d+G?\)|5G)\s*$/gi, "")
    .replace(/Dimensit[ée]/gi, "Dimensity")
    .replace(/Snapdragon(?=\d)/i, "Snapdragon ")
    .replace(/Dimensity (\d) (\d{3})/i, "Dimensity $1$2")
    .replace(/(\d) ?Gen ?(\d)/i, "$1 Gen $2")
    .replace(/(\d)\s*g[ée]n[ée]ration\s*(\d)/i, "$1 Gen $2")
    .replace(/(\d)([sS+]?) (\d)(?:e|re) g[ée]n\.?/i, (_m, a, b, c) => `${a}${b.toLowerCase()} Gen ${c}`)
    .replace(/ Energy$/i, "-Energy")
    .replace(/(\d) de (\d)(?:re|e) g[ée]n[ée]ration/i, "$1 Gen $2")
    .replace(/Gen(\d)/i, "Gen $1")
    .replace(/\bSUPER\b/, "Super")
    .replace(/\bMAX\b/, "Max")
    .replace(/MediaTek 6833|^6833$/i, "Dimensity 700")
    .trim();
  if (/^MT6765/i.test(s)) s = "Helio G37";
  if (!/snapdragon|dimensity|helio|exynos|tensor|unisoc|^a\d{2}|qcm\d/i.test(s)) return null;
  if (/^snapdragon$/i.test(s)) return null;
  return s;
}

export type ChipScores = Record<string, number>;

/** Indice 0–100 d'une puce, ou null si elle n'est pas classée. */
export function chipScore(raw: unknown, scores: ChipScores): number | null {
  const n = normalizeChip(raw);
  if (!n) return null;
  if (scores[n] !== undefined) return scores[n];
  const lower = Object.entries(scores).find(([k]) => k.toLowerCase() === n.toLowerCase());
  return lower ? lower[1] : null;
}

/** Niveau 1–5 déduit de l'indice (utilisé par le classement « jeux » et « usage intensif »). */
export function tierFromScore(score: number): number {
  return score >= 85 ? 5 : score >= 65 ? 4 : score >= 45 ? 3 : score >= 28 ? 2 : 1;
}
