import { normalize, parseQuery, type BrandAliasInfo } from "./text";

export interface Searchable {
  id: string;
  name: string;
  brand_id: string;
  brand_name: string;
  series_name: string | null;
}

/**
 * Recherche par nom, marque et gamme.
 * « Xiaomi » renvoie aussi Redmi et POCO ; « One Plus », « Pocco » sont reconnus ;
 * « Galaxy A » trouve la gamme Galaxy A (chaque mot doit commencer un mot du nom ou de la gamme).
 */
export function searchModels<T extends Searchable>(items: T[], q: string, brands: BrandAliasInfo[]): T[] {
  const query = q.trim();
  if (!query) return items;
  const { brandIds, terms } = parseQuery(query, brands);
  return items.filter((m) => {
    if (brandIds.length && !brandIds.includes(m.brand_id)) return false;
    if (!terms.length) return true;
    const words = normalize(`${m.name} ${m.series_name ?? ""} ${brandIds.length ? "" : m.brand_name}`).split(" ");
    return terms.every((t) => words.some((w) => w.startsWith(t)));
  });
}
