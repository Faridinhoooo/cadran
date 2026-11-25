// Marques exclues du site : une seule source de vérité (data/sources/brand-policy.json).
import fs from "node:fs";
import path from "node:path";

let cache: Set<string> | null = null;

export function excludedBrands(root = process.cwd()): Set<string> {
  if (cache) return cache;
  const f = path.join(root, "data", "sources", "brand-policy.json");
  const list = fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")).excluded as string[]) : [];
  cache = new Set(list.map((b) => b.toLowerCase()));
  return cache;
}

export function isExcludedBrand(brandId: string | null | undefined): boolean {
  return !!brandId && excludedBrands().has(brandId.toLowerCase());
}

/** Fragment SQL « m.brand_id NOT IN (…) » (identifiants contrôlés : lettres, chiffres, tirets). */
export function excludedSql(column = "m.brand_id"): string {
  const ids = [...excludedBrands()].filter((b) => /^[a-z0-9-]+$/.test(b));
  return ids.length ? `${column} NOT IN (${ids.map((b) => `'${b}'`).join(",")})` : "1=1";
}
