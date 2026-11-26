import { describe, expect, it } from "vitest";
import { parseAppleSpecs } from "../scripts/official";
import fs from "node:fs";
import path from "node:path";

// Extraits réels (texte aplati) des pages apple.com/fr relevées le 24 novembre 2026.
const PRO = `| Capacité | 1 | iPhone 18 Pro | 256 Go | 512 Go | 1 To | 2 To | iPhone 18 Pro Max | 256 Go | 512 Go | 1 To | 2 To | Dimensions et poids | 2 | Largeur : | 71,9 mm | Hauteur : | 150 mm | Épaisseur : | 8,75 mm | iPhone 18 Pro | Poids : | 211 g | Largeur : | 78 mm | Hauteur : | 163,4 mm | Épaisseur : | 8,75 mm | iPhone 18 Pro Max | Poids : | 249 g | Écran | iPhone 18 Pro | Écran Super Retina XDR | OLED tout écran de 6,3 pouces (diagonale) | Résolution de 2 622 x 1 206 pixels à 460 ppp | iPhone 18 Pro Max | Écran Super Retina XDR | OLED tout écran de 6,9 pouces (diagonale) | Résolution de 2 868 x 1 320 pixels à 460 ppp | Technologie ProMotion avec taux de rafraîchissement adaptatif atteignant 120 Hz | Puce | Puce A20 Pro | CPU | Indice de protection IP68 (jusqu'à 6 mètres)`;
const DUO = `| Capacité | 1 | 256 Go | 512 Go | 1 To | 2 To | Dimensions et poids | 2 | Largeur : | 164,6 mm | Hauteur : | 117,8 mm | Épaisseur : | 5,2 mm | Ouvert | Poids : | 254 g | Largeur : | 84,1 mm | Hauteur : | 117,8 mm | Épaisseur : | 11,3 mm | Fermé | Poids : | 254 g | Écrans | Écran interne | Écran Super Retina XDR | OLED tout écran pliable de 7,6 pouces (diagonale) | Résolution de 1 878 x 2 670 pixels à 430 ppp | Écran externe | Écran Super Retina XDR | OLED tout écran de 5,4 pouces (diagonale) | Résolution de 1 398 x 2 034 pixels | Technologie ProMotion avec taux de rafraîchissement adaptatif atteignant 120 Hz | Puce | Puce A20 Pro | x`;

describe("Relevé officiel Apple", () => {
  it("sépare les deux modèles d'une page Pro", () => {
    const r = parseAppleSpecs(PRO, "iPhone 18 Pro");
    expect(r.get("apple-iphone-18-pro")).toMatchObject({ width_mm: 71.9, height_mm: 150, weight_g: 211, screen_in: 6.3, resolution: "2622 × 1206", storage: [256, 512, 1024, 2048], chip: "A20 Pro", ip: "IP68", refresh_hz: 120 });
    expect(r.get("apple-iphone-18-pro-max")).toMatchObject({ width_mm: 78, weight_g: 249, screen_in: 6.9, resolution: "2868 × 1320" });
  });
  it("pliable : dimensions fermé et écran interne", () => {
    const r = parseAppleSpecs(DUO, "iPhone Duo").get("apple-iphone-duo")!;
    expect(r).toMatchObject({ width_mm: 84.1, thickness_mm: 11.3, weight_g: 254, screen_in: 7.6, storage: [256, 512, 1024, 2048] });
  });
});

describe("Fiches officielles OPPO (pages archivées)", () => {
  const page = (f: string) => fs.readFileSync(path.join(__dirname, "fixtures", "pages", f), "utf8");
  it("Find X8 Pro : dimensions, écran, puce, batterie, photo", async () => {
    const { parseOppoSpecs } = await import("../scripts/oppo");
    const { specs, configs } = parseOppoSpecs(page("oppo-find-x8-pro.txt"), "OPPO Find X8 Pro");
    expect(specs).toMatchObject({ height_mm: 162.27, width_mm: 76.67, weight_g: 215, screen_in: 6.78, refresh_hz: 120, chip: "MediaTek Dimensity 9400", battery_mah: 5910, five_g: true });
    expect(String(specs.cameras)).toMatch(/^50 Mpx principal, 50 Mpx ultra grand-angle, 50 Mpx téléobjectif/);
    expect(configs).toEqual([{ ram: 16, storage: 512 }]);
  });
  it("Find N3 (pliable) : épaisseur et dimensions pliées, zoom optique", async () => {
    const { parseOppoSpecs } = await import("../scripts/oppo");
    const { specs } = parseOppoSpecs(page("oppo-find-n3.txt"), "OPPO Find N3");
    expect(specs).toMatchObject({ height_mm: 153.4, width_mm: 73.3, thickness_mm: 11.7, optical_zoom: 6, chip: "Snapdragon 8 Gen 2" });
  });
  it("A18 (ancien format) : fluidité 90 Hz, pas de 5G, 4 + 128 Go", async () => {
    const { parseOppoSpecs } = await import("../scripts/oppo");
    const { specs, configs } = parseOppoSpecs(page("oppo-a18.txt"), "OPPO A18");
    expect(specs).toMatchObject({ refresh_hz: 90, five_g: false, battery_mah: 5000, chip: "MediaTek Helio G85" });
    expect(configs).toEqual([{ ram: 4, storage: 128 }]);
  });
});

describe("Fiches officielles realme, ASUS, HONOR", () => {
  const page = (f: string) => fs.readFileSync(path.join(__dirname, "fixtures", "pages", f), "utf8");
  it("realme GT 8 Pro : objectifs reconnus, 144 Hz, 7000 mAh", async () => {
    const { parseRealmeSpecs } = await import("../scripts/realme");
    const { specs } = parseRealmeSpecs(page("realme-gt-8-pro.txt"), "realme GT 8 Pro");
    expect(specs).toMatchObject({ refresh_hz: 144, battery_mah: 7000, chip: "Snapdragon 8 Elite Gen 5", cameras: "50 Mpx principal, 50 Mpx ultra grand-angle, 200 Mpx téléobjectif" });
  });
  it("ASUS ROG Phone 9 : batterie « 5,800mAh » lue 5800, objectifs séparés", async () => {
    const { parseAsusSpecs } = await import("../scripts/asus");
    const { specs } = parseAsusSpecs(page("asus-rog-phone-9.txt"), "ASUS ROG Phone 9");
    expect(specs).toMatchObject({ battery_mah: 5800, chip: "Snapdragon 8 Elite", weight_g: 227, screen_in: 6.78 });
    expect(String(specs.cameras)).toMatch(/^50 Mpx principal, 13 Mpx ultra grand-angle/);
  });
  it("HONOR 200 : valeurs data-value de la copie datée", async () => {
    const { parseHonorSpecs, readHonorCache } = await import("../scripts/honor");
    const p = readHonorCache()["honor-200"];
    const { specs, configs } = parseHonorSpecs(p.pairs, "HONOR 200");
    expect(specs).toMatchObject({ height_mm: 161.5, weight_g: 187, chip: "Snapdragon 7 Gen 3", battery_mah: 5100, five_g: true });
    expect(configs).toContainEqual({ ram: 12, storage: 512 });
  });
});
