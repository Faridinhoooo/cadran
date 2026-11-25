// Cote d'occasion entre particuliers : estimation à partir de prix DEMANDÉS dans des annonces récentes.
// Ce n'est jamais une offre achetable : elle ne peut pas déclencher « disponible dans ton budget ».

export const MARKET_WINDOW_DAYS = 30;
export const MARKET_MIN_OBSERVATIONS = 5;

export interface Observation {
  id: string;
  price: number;
  observed_at: string;
  excluded_reason: string | null;
}

export type MarketEstimate =
  | { ok: true; median: number; p25: number; p75: number; count: number; from: string; to: string }
  | { ok: false; count: number; message: string };

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Percentile par interpolation linéaire (méthode « R-7 », celle des tableurs). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function estimateMarket(obs: Observation[], today: Date, windowDays = MARKET_WINDOW_DAYS): MarketEstimate {
  const fromDate = new Date(today.getTime() - windowDays * 864e5);
  const seen = new Set<string>();
  const kept = obs.filter((o) => {
    if (o.excluded_reason) return false; // pièces, bloqué, doublon, acompte, mensualité…
    if (new Date(o.observed_at) < fromDate || new Date(o.observed_at) > today) return false;
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
  if (kept.length < MARKET_MIN_OBSERVATIONS)
    return { ok: false, count: kept.length, message: "Trop peu d'annonces comparables pour estimer le prix" };
  const prices = kept.map((o) => o.price).sort((a, b) => a - b);
  return {
    ok: true,
    median: round5(percentile(prices, 0.5)),
    p25: round5(percentile(prices, 0.25)),
    p75: round5(percentile(prices, 0.75)),
    count: kept.length,
    from: fromDate.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}
