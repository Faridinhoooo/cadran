import { describe, expect, it } from "vitest";
import { parseAppleSpecs } from "../scripts/official";

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
