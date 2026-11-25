export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(s: string): string {
  return normalize(s).replace(/\s+/g, "-");
}

/** Slug d'un modèle : marque + nom, sans répéter la marque (« OnePlus OnePlus 12 » → oneplus-12). */
export function modelSlug(brandName: string, modelName: string): string {
  const b = slugify(brandName);
  const m = slugify(modelName);
  return m.startsWith(b + "-") || m === b ? m : `${b}-${m}`;
}

export interface BrandAliasInfo {
  id: string;
  name: string;
  parent_id: string | null;
  aliases: string[];
}

/**
 * Transforme une recherche libre en :
 *  - brandIds : marques visées (une marque mère inclut ses sous-marques : Xiaomi → Redmi, POCO)
 *  - terms : mots restants à chercher dans le nom du modèle / de la gamme.
 * Les écritures courantes (« one plus », « pocco ») sont reconnues via les alias.
 */
export function parseQuery(q: string, brands: BrandAliasInfo[]): { brandIds: string[]; terms: string[] } {
  let text = ` ${normalize(q)} `;
  const hit = new Set<string>();
  // Alias les plus longs d'abord (« one plus » avant « one »)
  const entries: { alias: string; id: string }[] = [];
  for (const b of brands) {
    entries.push({ alias: normalize(b.name), id: b.id });
    for (const a of b.aliases) entries.push({ alias: normalize(a), id: b.id });
  }
  entries.sort((a, b) => b.alias.length - a.alias.length);
  for (const { alias, id } of entries) {
    if (!alias) continue;
    const needle = ` ${alias} `;
    if (text.includes(needle)) {
      hit.add(id);
      text = text.replace(needle, " ");
    }
  }
  // Une marque mère entraîne ses sous-marques
  for (const b of brands) if (b.parent_id && hit.has(b.parent_id)) hit.add(b.id);
  const terms = text.split(/\s+/).filter(Boolean);
  return { brandIds: [...hit], terms };
}
