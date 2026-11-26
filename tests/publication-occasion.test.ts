import { describe, expect, it } from "vitest";
import { exclusionReason, titleMatchesModel, type EbayItem } from "../scripts/ebay";
import { publishedModelSql, reliableOfferSql, type CatalogPolicy } from "../src/lib/catalog-policy";
import { openDb } from "../src/lib/db";

const item = (title: string, over: Partial<EbayItem> = {}): EbayItem => ({
  itemId: title, title, price: { value: "150", currency: "EUR" }, itemLocation: { country: "FR" },
  seller: { feedbackPercentage: "99.5", feedbackScore: 250 }, ...over,
});

describe("Occasion eBay : seules les annonces comparables comptent", () => {
  it("modèle exact, sans suffixe en plus", () => {
    expect(titleMatchesModel("Samsung Galaxy A17 5G 128Go Bleu très bon état", "Galaxy A17 5G")).toBe(true);
    expect(titleMatchesModel("Samsung Galaxy A17 5G 128Go", "Galaxy A17")).toBe(false);
    expect(titleMatchesModel("Apple iPhone 16 Pro 256 Go", "iPhone 16")).toBe(false);
    expect(titleMatchesModel("iPhone 16 128 Go noir", "iPhone 16")).toBe(true);
  });
  it.each([
    ["Galaxy A17 5G 128Go pour pièces", "pour pièces ou en panne"],
    ["Galaxy A17 5G 128Go écran cassé", "endommagé"],
    ["Galaxy A17 5G 128Go bloqué compte Google", "bloqué ou verrouillé"],
    ["Lot de 3 Galaxy A17 5G 128Go", "lot"],
    ["Coque Galaxy A17 5G 128Go", "accessoire seul"],
    ["Galaxy A17 5G", "capacité absente ou différente"],
    ["Galaxy A17 5G 256Go", "capacité absente ou différente"],
  ])("« %s » → %s", (title, why) => {
    expect(exclusionReason(item(title), "Galaxy A17 5G", 128)).toBe(why);
  });
  it("vendeur peu évalué ou annonce hors de France exclus ; annonce saine retenue", () => {
    expect(exclusionReason(item("Galaxy A17 5G 128Go", { seller: { feedbackPercentage: "88", feedbackScore: 400 } }), "Galaxy A17 5G", 128)).toBe("vendeur peu évalué");
    expect(exclusionReason(item("Galaxy A17 5G 128Go", { itemLocation: { country: "DE" } }), "Galaxy A17 5G", 128)).toBe("hors de France");
    expect(exclusionReason(item("Samsung Galaxy A17 5G 128 Go Bleu - très bon état"), "Galaxy A17 5G", 128)).toBeNull();
  });
});

describe("Publication : seuls les téléphones avec un prix actuel fiable", () => {
  const strict: CatalogPolicy = { publishOnlyPriced: true, acceptStartingPrices: false, maxOfferAgeDays: 7 };
  const now = new Date("2026-11-26T12:00:00Z");
  function db() {
    const d = openDb(":memory:");
    d.exec(`INSERT INTO brands (id, name) VALUES ('b','B');
      INSERT INTO models (id, brand_id, name, release_scope, fr_status, created_at, updated_at) VALUES
        ('ok','b','OK','monde','confirme','x','x'), ('vieux','b','Vieux','monde','confirme','x','x'), ('rupture','b','Rupture','monde','confirme','x','x'),
        ('depart','b','Départ','monde','confirme','x','x'), ('ecart','b','Écart','monde','confirme','x','x'), ('sans','b','Sans','monde','confirme','x','x');
      INSERT INTO configs (id, model_id, storage_gb) VALUES ('ok-128','ok',128), ('vieux-128','vieux',128), ('rupture-128','rupture',128), ('depart-0','depart',0), ('ecart-128','ecart',128);`);
    const o = d.prepare(`INSERT INTO offers (id, config_id, condition, seller, price, url, available, checked_at, source, stock, capacity_status, variant_check)
      VALUES (?, ?, 'neuf', 'V', 100, 'u', ?, ?, 's', ?, ?, ?)`);
    o.run("1", "ok-128", 1, "2026-11-25T08:00:00Z", "en_stock", "confirmee", "ok");
    o.run("2", "vieux-128", 1, "2026-11-10T08:00:00Z", "en_stock", "confirmee", "ok");
    o.run("3", "rupture-128", 1, "2026-11-25T08:00:00Z", "rupture", "confirmee", "ok");
    o.run("4", "depart-0", 1, "2026-11-25T08:00:00Z", "inconnu", "prix_de_depart", null);
    o.run("5", "ecart-128", 1, "2026-11-25T08:00:00Z", "en_stock", "confirmee", "ecart");
    return d;
  }
  const published = (p: CatalogPolicy) => (db().prepare(`SELECT id FROM models m WHERE ${publishedModelSql(p, now)} ORDER BY id`).all() as { id: string }[]).map((r) => r.id);

  it("règle stricte : récent, en stock, capacité précise, cohérent avec la page vendeur", () => {
    expect(published(strict)).toEqual(["ok"]);
  });
  it("les prix « à partir de » peuvent être acceptés par réglage", () => {
    expect(published({ ...strict, acceptStartingPrices: true })).toEqual(["depart", "ok"]);
  });
  it("règle désactivée : tout le catalogue est publié", () => {
    expect(published({ ...strict, publishOnlyPriced: false })).toHaveLength(6);
    expect(reliableOfferSql(strict, now)).toContain("2026-11-19");
  });
});

describe("Comptage des téléphones avec un prix fiable", () => {
  it("pricedModelSql ne dépend pas de la règle d'affichage", async () => {
    const { pricedModelSql } = await import("../src/lib/catalog-policy");
    const p: CatalogPolicy = { publishOnlyPriced: false, acceptStartingPrices: false, maxOfferAgeDays: 7 };
    expect(pricedModelSql(p, new Date("2026-11-26T12:00:00Z"))).toContain("o.capacity_status='confirmee'");
    expect(publishedModelSql(p)).toBe("1=1");
  });
});
