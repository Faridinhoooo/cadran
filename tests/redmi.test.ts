import { describe, expect, it } from "vitest";
import { searchModels } from "../src/lib/search";
import { excludedBrands, isExcludedBrand } from "../src/lib/brand-policy";
import { parseXiaomiSpecs } from "../scripts/official";

const brands = [
  { id: "xiaomi", name: "Xiaomi", parent_id: null, aliases: [] },
  { id: "redmi", name: "REDMI", parent_id: "xiaomi", aliases: ["redmy"] },
  { id: "poco", name: "POCO", parent_id: "xiaomi", aliases: ["pocco"] },
];
const m = (id: string, name: string, brand = "redmi", series = "REDMI Note") => ({ id, name, brand_id: brand, brand_name: brand === "redmi" ? "REDMI" : brand, series_name: series });
const items = [
  m("n15", "REDMI Note 15"),
  m("n15-5g", "REDMI Note 15 5G"),
  m("n15p", "REDMI Note 15 Pro"),
  m("n15p-5g", "REDMI Note 15 Pro 5G"),
  m("n15pp", "REDMI Note 15 Pro+ 5G"),
  m("n14pp", "REDMI Note 14 Pro+ 5G"),
  m("r15", "REDMI 15", "redmi", "REDMI"),
  m("x15", "Xiaomi 15", "xiaomi", "Xiaomi"),
];
const ids = (q: string) => searchModels(items, q, brands).map((x) => x.id);

describe("Recherche tolérante REDMI", () => {
  it.each(["Redmi 15 Pro Plus", "Note 15 Pro Plus", "Note 15 Pro +", "redmi note 15 pro+", "REDMI Note 15 Pro+ 5G"])("« %s » trouve le Note 15 Pro+ 5G, une seule fois, sans le Pro simple", (q) => {
    const r = ids(q);
    expect(r).toContain("n15pp");
    expect(r.filter((x) => x === "n15pp")).toHaveLength(1);
    expect(r).not.toContain("n15p");
    expect(r).not.toContain("n14pp");
  });
  it("chaque REDMI Note 15 est trouvable sous son nom officiel", () => {
    expect(ids("REDMI Note 15")).toEqual(["n15", "n15-5g", "n15p", "n15p-5g", "n15pp"]);
    expect(ids("Note 15 Pro 5G")).toEqual(["n15p-5g", "n15pp"]);
  });
  it("« Xiaomi » fait ressortir les REDMI", () => {
    expect(ids("Xiaomi")).toEqual(expect.arrayContaining(["n15", "n15pp", "r15", "x15"]));
  });
});

describe("Marques exclues", () => {
  it("exactement les six marques demandées, HONOR et POCO conservées", () => {
    expect([...excludedBrands()].sort()).toEqual(["crosscall", "fairphone", "hmd", "huawei", "motorola", "tcl"]);
    expect(isExcludedBrand("honor")).toBe(false);
    expect(isExcludedBrand("poco")).toBe(false);
    expect(isExcludedBrand("Motorola")).toBe(true);
  });
});

describe("Fiches Xiaomi France (deux formats de page)", () => {
  it("format récent", () => {
    const t = "| Hauteur : 163,34 mm | Largeur : 78,31 mm | Épaisseur : 8,19 mm (Noir, Bleu) / 8,47 mm (Moka) | Poids : 207,1 g (Noir) | Écran | Écran AMOLED CrystalRes de 6,83 pouces | Résolution : 1,5K (2772 x 1280) | Taux de rafraîchissement : jusqu'à 120 Hz | Caméra arrière | Caméra principale de 200 MP | Stabilisation optique de l'image (OIS) | Caméra ultra grand-angle de 8 MP | Enregistrement vidéo de la caméra arrière | 4K à 30 fps | Caméra avant | Caméra avant de 32 MP | Batterie de 6 500 mAh (typique) | HyperCharge 100 W | Processeur | Snapdragon® 7s Gen 4 | Technologie | Stockage et RAM | 8 Go + 256 Go | 12 Go + 512 Go* | Réseau et connectivité | nano SIM + eSIM | Prend en charge la 5G / 4G | IP66, IP68 |";
    const r = parseXiaomiSpecs(t, "REDMI Note 15 Pro+ 5G");
    expect(r.specs).toMatchObject({ height_mm: 163.34, thickness_mm: 8.19, weight_g: 207.1, screen_in: 6.83, resolution: "2772 × 1280", chip: "Snapdragon 7s Gen 4", battery_mah: 6500, charge_w: 100, cameras: "200 Mpx principal, 8 Mpx ultra grand-angle", ois: true, five_g: true, esim: true, ip: "IP66/IP68" });
    expect(r.configs).toEqual([{ ram: 8, storage: 256 }, { ram: 12, storage: 512 }]);
  });
  it("format 2023", () => {
    const t = "| Écran | Écran AMOLED DotDisplay 6,67 pouces | Taux de rafraîchissement : 120 Hz | Résolution : 1080 x 2400 | Conception | 165,66 x 75,96 x 7,85 mm | 183,5 g | Caméra arrière | Caméra principale 50 MP | Caméra ultra grand-angle 8 MP | Objectif macro 2 MP | Caméra avant | Caméra avant 13 MP | Chipset | Snapdragon® 685 | CPU | Mémoire | 4+128/6+128/8+128 Go | Batterie | 5 000 mAh (type) | Charge | Charge rapide de 33 W | 4G: LTE FDD:1/3 |";
    const r = parseXiaomiSpecs(t, "REDMI Note 12");
    expect(r.specs).toMatchObject({ height_mm: 165.66, width_mm: 75.96, weight_g: 183.5, chip: "Snapdragon 685", battery_mah: 5000, charge_w: 33, five_g: false, cameras: "50 Mpx principal, 8 Mpx ultra grand-angle, 2 Mpx macro" });
    expect(r.configs.map((c) => c.storage)).toEqual([128, 128, 128]);
  });
});
