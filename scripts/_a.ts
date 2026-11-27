import { DatabaseSync } from "node:sqlite";
import { normalize } from "../src/lib/text";
const d = new DatabaseSync("data/catalog.db");
const have = (brands: string[]) => (d.prepare(`SELECT id, name FROM models WHERE brand_id IN (${brands.map(() => "?").join(",")}) AND is_test=0`).all(...brands) as { id: string; name: string }[]);
const norm = (s: string) => normalize(s).replace(/\b(samsung|galaxy|apple|google|oneplus|sony|xperia|nokia)\b/g, "").replace(/\s+/g, " ").trim();
(async () => {
  for (const [prod, brands] of [["iphone", ["apple"]], ["samsung-mobile", ["samsung"]], ["pixel", ["google"]], ["oneplus", ["oneplus"]], ["sony-xperia", ["sony"]], ["nokia", ["nokia"]]] as const) {
    const rel = (await (await fetch(`https://endoflife.date/api/${prod}.json`)).json()) as { cycle: string; releaseDate: string; label?: string }[];
    const recent = rel.filter((r) => r.releaseDate >= "2023-01-01");
    const h = have(brands as unknown as string[]).map((m) => norm(m.name));
    const missing = recent.filter((r) => !h.includes(norm(r.label ?? r.cycle)));
    console.log(`\n${prod}: ${recent.length} depuis 2023, ${missing.length} absents :`, missing.map((r) => `${r.label ?? r.cycle} (${r.releaseDate})`).join(" | "));
  }
})();
