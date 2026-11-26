// Échelles des jauges « Puissance » et « Batterie » : bornes calculées sur tout le catalogue, hors téléphones
// gaming (ROG Phone…), pour situer un modèle par rapport aux smartphones du marché.
import { catalogSummaries } from "./queries";

export interface Scales {
  battery: { min: number; max: number; values: number[] };
  chip: { min: number; max: number; values: number[] };
}

const GAMING = /rog-phone|red-?magic|black-?shark|legion/i;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

let cache: { at: number; s: Scales } | null = null;

export function scales(): Scales {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.s;
  const models = catalogSummaries().filter((m) => !GAMING.test(m.id));
  const bat = models.map((m) => num(m.specs.battery_mah)).filter((x): x is number => x !== null && x > 1000).sort((a, b) => a - b);
  const chip = models.map((m) => num(m.specs.chip_score)).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const s: Scales = {
    battery: { min: bat[0] ?? 3000, max: bat[bat.length - 1] ?? 7000, values: bat },
    chip: { min: chip[0] ?? 0, max: chip[chip.length - 1] ?? 100, values: chip },
  };
  cache = { at: Date.now(), s };
  return s;
}

/** Position 0–1 entre le minimum et le maximum du catalogue. */
export function position(v: number, r: { min: number; max: number }): number {
  if (r.max <= r.min) return 1;
  return Math.max(0, Math.min(1, (v - r.min) / (r.max - r.min)));
}

/** Part des modèles du catalogue strictement en dessous (en %). */
export function percentileBelow(v: number, values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.filter((x) => x < v).length / values.length) * 100);
}

export const CHIP_LEVELS = ["", "entrée de gamme", "milieu de gamme", "milieu de gamme supérieur", "haut de gamme", "très haut de gamme"];
