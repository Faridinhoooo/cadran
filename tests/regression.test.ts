// Non-régression des analyseurs sur des extraits réels archivés (tests/fixtures/pages).
// Si un constructeur change le format de sa page, mettre à jour l'extrait et les valeurs attendues ensemble.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseAppleSpecs, parseSamsungSpecTable, parseXiaomiSpecs, samsungSpecsFrom } from "../scripts/official";
import { openDb } from "../src/lib/db";
import { reportProblems, runOfferSource, type OfferInput } from "../scripts/import";

const page = (f: string) => fs.readFileSync(path.join(__dirname, "fixtures", "pages", f), "utf8");

describe("Samsung France — Galaxy A17 5G", () => {
  const r = samsungSpecsFrom(parseSamsungSpecTable(page("samsung-galaxy-a17-5g.txt")));
  it("caractéristiques, capacité et fin des correctifs", () => {
    expect(r.specs).toMatchObject({ screen_in: 6.7, resolution: "2340 × 1080", refresh_hz: 90, battery_mah: 5000, weight_g: 192, height_mm: 164.4, width_mm: 77.9, ram_gb: 4, ois: true, optical_zoom: 1, five_g: true });
    expect(r.storageGb).toBe(128);
    expect(r.securityEnd).toBe("2031-08-31");
  });
});

describe("Apple — pages à plusieurs modèles et pliable", () => {
  it("iPhone 18 Pro / Pro Max séparés", () => {
    const r = parseAppleSpecs(page("apple-iphone-18-pro.txt"), "iPhone 18 Pro");
    expect(r.get("apple-iphone-18-pro")).toMatchObject({ weight_g: 211, screen_in: 6.3, storage: [256, 512, 1024, 2048] });
    expect(r.get("apple-iphone-18-pro-max")).toMatchObject({ weight_g: 249, screen_in: 6.9 });
  });
  it("iPhone Duo mesuré fermé", () => {
    expect(parseAppleSpecs(page("apple-iphone-duo.txt"), "iPhone Duo").get("apple-iphone-duo")).toMatchObject({ width_mm: 84.1, thickness_mm: 11.3, screen_in: 7.6 });
  });
});

describe("Xiaomi France — formats récent et 2023", () => {
  it.each([
    ["xiaomi-redmi-note-15-pro-plus-5g.txt", "REDMI Note 15 Pro+ 5G", { chip: "Snapdragon 7s Gen 4", screen_in: 6.83, battery_mah: 6500, charge_w: 100, five_g: true, esim: true }, [256, 512]],
    ["xiaomi-redmi-note-12.txt", "REDMI Note 12", { chip: "Snapdragon 685", screen_in: 6.67, battery_mah: 5000, charge_w: 33, five_g: false }, [128, 128, 128]],
    ["xiaomi-redmi-15.txt", "REDMI 15", { screen_in: 6.9, screen_tech: "DotDisplay" }, null],
    ["xiaomi-redmi-a7-pro.txt", "REDMI A7 Pro", { chip: "UNISOC T7250", screen_in: 6.9, battery_mah: 6000, five_g: false }, null],
  ])("%s", (f, name, expected, storages) => {
    const r = parseXiaomiSpecs(page(f as string), name as string);
    expect(r.specs).toMatchObject(expected as Record<string, unknown>);
    if (storages) expect(r.configs.map((c) => c.storage)).toEqual(storages);
  });
});

describe("Surveillance des imports", () => {
  const offer = (i: number): OfferInput => ({
    id: `t:${i}`, modelId: "t-1", storageGb: 128, condition: "neuf", seller: "Test", platform: null, price: 100 + i, shipping: null,
    shippingStatus: "inconnue", shippingNote: null, mandatoryFees: 0, stock: "en_stock", color: null, grade: null, batteryNote: null,
    warranty: null, returnsPolicy: null, url: `https://example.test/${i}`, source: "t",
  });
  it("une chute brutale du nombre d'offres est refusée, les données précédentes conservées et l'échec signalé", async () => {
    const db = openDb(":memory:");
    db.exec(`INSERT INTO brands (id, name) VALUES ('t','Test');
      INSERT INTO models (id, brand_id, name, release_scope, fr_status, created_at, updated_at) VALUES ('t-1','t','Test 1','monde','a_verifier','x','x');`);
    const since = new Date(Date.now() - 1000).toISOString();
    expect(await runOfferSource(db, "Source t", "t", async () => Array.from({ length: 10 }, (_, i) => offer(i)))).toBe(true);
    expect(await runOfferSource(db, "Source t", "t", async () => [offer(0), offer(1)])).toBe(false);
    expect((db.prepare("SELECT COUNT(*) n FROM offers WHERE available=1").get() as { n: number }).n).toBe(10);
    const failed = await reportProblems(db, since);
    expect(failed.map((f) => f.source)).toEqual(["Source t"]);
    expect(failed[0].notes).toContain("anomalie : 2 offres lues contre 10");
    db.close();
  });
});

describe("Adresse publique du site", () => {
  it("SITE_URL d'abord, puis l'adresse de production Vercel, puis localhost", async () => {
    const { siteUrl } = await import("../src/lib/site-config");
    const keep = { s: process.env.SITE_URL, v: process.env.VERCEL_PROJECT_PRODUCTION_URL };
    delete process.env.SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "cadran-three.vercel.app";
    expect(siteUrl()).toBe("https://cadran-three.vercel.app");
    process.env.SITE_URL = "https://exemple.fr/";
    expect(siteUrl()).toBe("https://exemple.fr");
    delete process.env.SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
    if (keep.s) process.env.SITE_URL = keep.s;
    if (keep.v) process.env.VERCEL_PROJECT_PRODUCTION_URL = keep.v;
  });
});

describe("Mentions légales", () => {
  it("particulier non professionnel par défaut ; hébergeur Vercel renseigné sur Vercel ; contact via EDITEUR_CONTACT", async () => {
    const { siteConfig } = await import("../src/lib/site-config");
    const keep = { ...process.env };
    delete process.env.EDITEUR_NOM; delete process.env.EDITEUR_EMAIL; delete process.env.HEBERGEUR_NOM;
    process.env.VERCEL = "1"; process.env.EDITEUR_CONTACT = "contact@exemple.fr";
    const c = siteConfig();
    expect(c.nonProfessional).toBe(true);
    expect(c.editor.email).toBe("contact@exemple.fr");
    expect(c.host.name).toBe("Vercel Inc.");
    expect(c.host.contact).toBe("https://vercel.com/help");
    process.env = keep;
  });
});

describe("Liens de recherche neutres", () => {
  it("requête marque + modèle sans doublon, capacité, aucun paramètre de suivi", async () => {
    const { searchQuery, shopLinks } = await import("../src/lib/shop-links");
    expect(searchQuery("Samsung", "Galaxy A17 5G", 128)).toBe("Samsung Galaxy A17 5G 128 Go");
    expect(searchQuery("REDMI", "REDMI Note 15 Pro")).toBe("REDMI Note 15 Pro");
    const links = shopLinks("OPPO", "OPPO Find X8 Pro");
    expect(links.map((l) => l.id)).toEqual(["google", "idealo", "backmarket", "ebay"]);
    for (const l of links) expect(l.url).not.toMatch(/utm_|aff|tag=|campid/i);
  });
});

describe("Puces : noms normalisés, indice et gamme", () => {
  it("les libellés variés des fabricants désignent la bonne puce", async () => {
    const { normalizeChip, chipScore, segmentOf, tierFromScore } = await import("../src/lib/chips");
    expect(normalizeChip("Chipset MediaTek Dimensity 7050")).toBe("Dimensity 7050");
    expect(normalizeChip("Snapdragon 8 génération 2")).toBe("Snapdragon 8 Gen 2");
    expect(normalizeChip("Snapdragon 7+ 3e gén.")).toBe("Snapdragon 7+ Gen 3");
    expect(normalizeChip("MediaTek Dimensity 9 500")).toBe("Dimensity 9500");
    expect(normalizeChip("Puissant")).toBeNull();
    const scores = { "Snapdragon 6s Gen 4": 33, "Helio G85": 15, "Snapdragon 8 Elite": 92 };
    expect(chipScore("Snapdragon 6s Gen 4", scores)).toBe(33);
    expect(segmentOf({ chip_score: 15 })).toBe("entree");
    expect(segmentOf({ chip_score: 33 })).toBe("milieu");
    expect(segmentOf({ chip_score: 92 })).toBe("haut");
    expect(segmentOf({})).toBeNull();
    expect(tierFromScore(92)).toBe(5);
  });
});
