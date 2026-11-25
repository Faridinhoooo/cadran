// Connecteur de flux marchands — données de test isolées (base en mémoire, CSV fictif au format Awin).
import { describe, expect, it } from "vitest";
import { configuredFeeds, feedToOffers, matchModel, parseCsv, storageFromLabel, toFeedRow, type FeedRow } from "../scripts/feeds";
import { mapIcecat, samsungMpnFromUrl } from "../scripts/icecat";
import { parseGoogleStorePage } from "../scripts/import";
import { openDb } from "../src/lib/db";

const CSV = `aw_deep_link,product_name,aw_product_id,merchant_name,search_price,delivery_cost,ean,in_stock,condition,brand_name
https://example.test/a17,"Samsung Galaxy A17 5G 4Go 128Go Bleu",1,Boutique A,219.99,,8806097640257,1,new,Samsung
https://example.test/rn17,"Xiaomi Redmi Note 17 5G 6 Go + 128 Go Noir",2,Boutique B,279.00,0.00,,1,new,Xiaomi
https://example.test/pro,"Xiaomi Redmi Note 17 Pro 5G 8Go 256Go",3,Boutique B,349.00,4.99,,1,new,Xiaomi
https://example.test/amb,"Xiaomi Redmi Note 17 5G 128Go/256Go",4,Boutique B,279.00,0,,1,new,Xiaomi
https://example.test/occ,"Samsung Galaxy A17 5G 128Go",5,Boutique C,150,0,,1,used,Samsung
`;

function db() {
  const d = openDb(":memory:");
  d.exec(`INSERT INTO brands (id, name) VALUES ('samsung','Samsung'), ('redmi','Redmi');
    INSERT INTO models (id, brand_id, name, release_scope, fr_status, created_at, updated_at, is_test) VALUES
      ('samsung-galaxy-a17-5g','samsung','Galaxy A17 5G','monde','confirme','x','x',0),
      ('redmi-note-17','redmi','Redmi Note 17','monde','confirme','x','x',0),
      ('redmi-note-17-5g','redmi','Redmi Note 17 5G','monde','confirme','x','x',0);
    CREATE TABLE IF NOT EXISTS product_ids (scheme TEXT, value TEXT, model_id TEXT, storage_gb INTEGER, source TEXT, checked_at TEXT, PRIMARY KEY (scheme, value));
    INSERT INTO product_ids VALUES ('gtin','8806097640257','samsung-galaxy-a17-5g',128,'test','x');`);
  return d;
}

describe("Flux marchands", () => {
  const rows = parseCsv(CSV).map(toFeedRow).filter((r): r is FeedRow => r !== null);

  it("lit les colonnes Awin ; livraison vide = inconnue, 0,00 = gratuite", () => {
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ price: 219.99, shipping: null, ean: "8806097640257", seller: "Boutique A", condition: "neuf", inStock: true });
    expect(rows[1].shipping).toBe(0);
    expect(rows[4].condition).toBe("occasion");
  });

  it("rattache par EAN (capacité certaine) puis par nom + capacité unique ; ignore ambigus, suffixes orphelins et occasion", () => {
    const notes = { notes: [] as string[] };
    const offers = feedToOffers(db(), "flux-test", rows, notes);
    expect(offers.map((o) => [o.modelId, o.storageGb, o.price, o.shipping])).toEqual([
      ["samsung-galaxy-a17-5g", 128, 219.99, null],
      ["redmi-note-17-5g", 128, 279, 0],
    ]);
    expect(notes.notes[0]).toContain("1 modèle inconnu, 1 capacité ambiguë, 1 occasion");
  });

  it("le nom le plus précis gagne, un suffixe non référencé bloque le rattachement", () => {
    const models = [
      { id: "a", name: "Redmi Note 17", brand: "Redmi" },
      { id: "b", name: "Redmi Note 17 5G", brand: "Redmi" },
    ];
    expect(matchModel("Xiaomi Redmi Note 17 5G 128Go", "Xiaomi", models)?.id).toBe("b");
    expect(matchModel("Redmi Note 17 Pro 5G", null, models)).toBeNull();
    expect(storageFromLabel("8Go RAM 256Go")).toBe(256);
    expect(storageFromLabel("128 Go / 256 Go")).toBeNull();
  });

  it("configuration privée : plusieurs flux nommés", () => {
    expect(configuredFeeds("awin|https://x.test/a.gz;kelkoo|https://y.test/b.csv")).toEqual([
      { name: "awin", url: "https://x.test/a.gz" },
      { name: "kelkoo", url: "https://y.test/b.csv" },
    ]);
    expect(configuredFeeds("")).toEqual([]);
  });
});

describe("Open Icecat et Google Store", () => {
  it("extrait le code fabricant Samsung des deux formes d'adresse", () => {
    expect(samsungMpnFromUrl("https://www.samsung.com/fr/smartphones/galaxy-a/galaxy-a17-5g-blue-128gb-sm-a176bzbaeub/")).toBe("SM-A176BZBAEUB");
    expect(samsungMpnFromUrl("https://www.samsung.com/fr/smartphones/galaxy-s25/buy/?modelCode=SM-S931BDBDEUB")).toBe("SM-S931BDBDEUB");
  });
  it("convertit une fiche Icecat (identifiants de caractéristiques)", () => {
    const f = (ID: number, v: string, name = "x") => ({ Feature: { ID, Name: { Value: name } }, PresentationValue: v });
    const m = mapIcecat({
      GeneralInfo: { IcecatId: 1, Brand: "Samsung", BrandPartCode: "SM-A176BZBAEUB", GTIN: ["8806097640257"], Title: "t" },
      Image: { Pic500x500: "https://images.icecat.biz/x.jpg" },
      FeaturesGroups: [{ Features: [f(944, '17 cm (6.7")'), f(909, "5000 mAh"), f(94, "192 g"), f(1649, "77,9 mm"), f(8730, "128 Go"), f(45537, "31 August 2031"), f(7900, "IP54")] }],
    });
    expect(m.specs).toMatchObject({ screen_in: 6.7, battery_mah: 5000, weight_g: 192, width_mm: 77.9, ip: "IP54" });
    expect(m).toMatchObject({ storageGb: 128, securityEnd: "2031-08-31", gtins: ["8806097640257"] });
  });
  it("Google Store : prix « à partir de » seulement si la page est celle du modèle", () => {
    const html = `<title>Pixel 9a - Google Store</title><div data-test="price">À partir de 399 €</div> Livraison standard gratuite`;
    expect(parseGoogleStorePage(html, "Pixel 9a")).toEqual({ price: 399, freeShipping: true });
    expect(parseGoogleStorePage(html, "Pixel 10a")).toBeNull();
  });
});
