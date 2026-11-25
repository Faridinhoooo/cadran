// Cas de livraison demandés — données de test isolées (base en mémoire ou objets construits ici).
import { describe, expect, it } from "vitest";
import { recommend, type Answers } from "../src/lib/engine";
import { cardVisual, illustrationFor } from "../src/lib/visual";
import { openDb } from "../src/lib/db";
import { runOfferSource, type OfferInput } from "../scripts/import";
import { model, offer, TODAY } from "./fixtures";

const ask: Answers = { budget: 400, conditions: ["neuf", "reconditionne", "occasion"], priorities: ["prix"], os: "any" };
const one = (id: string, o: Parameters<typeof offer>[0], storage = 128, form = "classique") =>
  model({ id, name: id, form_factor: form, configs: [{ id: `${id}-${storage}`, storage_gb: storage, ram_gb: null, offers: [offer(o)] }] });

describe("Coût total et frais", () => {
  it("399 € + livraison gratuite confirmée → dans le budget, frais inclus", () => {
    const r = recommend(ask, [one("a", { id: "o1", price: 399, shipping: 0, shipping_status: "gratuite_annoncee" })], TODAY);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.picks.map((p) => p.offer.id)).toEqual(["o1"]);
      expect(r.picks[0].total).toBe(399);
      expect(r.toVerify).toHaveLength(0);
    }
  });

  it("399 € + 5 € de livraison → hors budget (ni confirmée ni à vérifier)", () => {
    const r = recommend(ask, [one("a", { id: "o1", price: 399, shipping: 5, shipping_status: "payante" })], TODAY);
    expect(r.status).toBe("aucun");
    if (r.status === "aucun") {
      expect(r.reason).toBe("criteres");
      expect(r.funnel.hors_budget).toBe(1);
      expect(r.toVerify).toHaveLength(0);
    }
  });

  it("229 € + livraison inconnue → carte visible, frais à vérifier, marge 171 € présentée comme plafond de frais", () => {
    const r = recommend(ask, [one("a17", { id: "o1", price: 229, shipping: null })], TODAY);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.picks).toHaveLength(0);
      expect(r.toVerify).toHaveLength(1);
      expect(r.toVerify[0]).toMatchObject({ shownPrice: 229, headroom: 171 });
      expect(r.admissibleModels).toBe(1);
    }
  });

  it("prix minimum : confirmées par coût total, à vérifier par prix affiché, chacune dans sa section", () => {
    const models = [
      one("c1", { id: "c1", price: 350, shipping: 0 }),
      one("c2", { id: "c2", price: 300, shipping: 0 }),
      one("v1", { id: "v1", price: 280, shipping: null }),
      one("v2", { id: "v2", price: 129, shipping: null }),
    ];
    const r = recommend(ask, models, TODAY);
    if (r.status !== "ok") throw new Error("résultats attendus");
    expect(r.picks[0].offer.id).toBe("c2");
    expect(r.toVerify.map((v) => v.offer.id)).toEqual(["v2", "v1"]);
  });

  it("« Comparer les trois » réunit les états disponibles, même si un modèle n'existe que dans un état", () => {
    const r = recommend(ask, [one("n", { id: "n", price: 300, shipping: null }), one("r", { id: "r", price: 250, shipping: 0, condition: "reconditionne" })], TODAY);
    if (r.status !== "ok") throw new Error("résultats attendus");
    expect(r.picks.map((p) => p.offer.condition)).toEqual(["reconditionne"]);
    expect(r.toVerify.map((v) => v.offer.condition)).toEqual(["neuf"]);
  });
});

describe("Offres non actives", () => {
  it("offre expirée ou prix de démonstration → jamais présentée comme active", () => {
    const models = [
      one("vieux", { id: "exp", price: 200, shipping: 0, checked_at: "2026-10-01T00:00:00Z" }),
      one("demo", { id: "demo", price: 150, shipping: 0, is_demo: 1 }),
      one("rupture", { id: "rup", price: 150, shipping: null, stock: "rupture" }),
    ];
    const r = recommend(ask, models, TODAY);
    expect(r.status).toBe("aucun");
    if (r.status === "aucun") {
      expect(r.reason).toBe("donnees"); // aucun prix récent exploitable
      expect(r.funnel).toMatchObject({ perime: 1, demo: 1, indisponible: 1, confirmee: 0, a_verifier: 0 });
    }
  });

  it("variante incohérente avec la page vendeur → exclue", () => {
    const r = recommend(ask, [one("x", { id: "x", price: 200, shipping: 0, variant_check: "ecart" })], TODAY);
    expect(r.status === "aucun" && r.funnel.variante).toBe(1);
  });
});

describe("Capacités", () => {
  it("un prix valable pour 128 Go n'est jamais attribué au 256 Go", () => {
    const r = recommend({ ...ask, minStorage: 256 }, [one("m", { id: "p128", price: 229, shipping: null }, 128)], TODAY);
    expect(r.status).toBe("aucun");
    if (r.status === "aucun") expect(r.toVerify).toHaveLength(0);
  });
  it("un prix de départ sans capacité ne satisfait jamais un stockage minimum", () => {
    const r = recommend({ ...ask, minStorage: 128 }, [one("m", { id: "depart", price: 199, shipping: null, capacity_status: "prix_de_depart" }, 0)], TODAY);
    expect(r.status).toBe("aucun");
  });
});

describe("Visuels", () => {
  it("image manquante → illustration locale selon la forme", () => {
    expect(cardVisual(null, "classique")).toEqual({ type: "illustration", src: "/illustrations/smartphone.svg" });
    expect(cardVisual([], "pliable").src).toBe("/illustrations/pliable.svg");
    expect(illustrationFor("clapet")).toBe("/illustrations/clapet.svg");
  });
  it("photo de magasin non retenue en miniature ; détourage retenu, avec repli local si le lien casse", () => {
    expect(cardVisual({ url: "https://x/a.jpg", thumb_url: null, quality: "photo" }, "classique").type).toBe("illustration");
    expect(cardVisual({ url: "https://x/a.png", thumb_url: null, quality: "detoure" }, "classique")).toEqual({
      type: "photo", src: "https://x/a.png", fallback: "/illustrations/smartphone.svg",
    });
  });
});

describe("Flux marchand indisponible", () => {
  it("un échec n'efface ni ne redate le dernier relevé réussi", async () => {
    const db = openDb(":memory:");
    db.exec(`INSERT INTO brands (id, name) VALUES ('t', 'Test');
      INSERT INTO models (id, brand_id, name, release_scope, fr_status, created_at, updated_at, is_test) VALUES ('t-1', 't', 'Test 1', 'monde', 'a_verifier', 'x', 'x', 1);`);
    const good: OfferInput = {
      id: "src:1", modelId: "t-1", storageGb: 128, condition: "neuf", seller: "Test", platform: null, price: 229, shipping: null,
      shippingStatus: "inconnue", shippingNote: null, mandatoryFees: 0, stock: "en_stock", color: null, grade: null, batteryNote: null,
      warranty: null, returnsPolicy: null, url: "https://example.test/p", source: "src",
    };
    expect(await runOfferSource(db, "Source test", "src", async () => [good])).toBe(true);
    const before = db.prepare("SELECT checked_at, available, price FROM offers WHERE id='src:1'").get() as Record<string, unknown>;
    const lastOk = (db.prepare("SELECT MAX(finished_at) t FROM import_runs WHERE source='Source test' AND status='ok'").get() as { t: string }).t;

    expect(await runOfferSource(db, "Source test", "src", async () => { throw new Error("503 Service Unavailable"); })).toBe(false);
    expect(await runOfferSource(db, "Source test", "src", async () => [])).toBe(false); // page vide = échec
    const after = db.prepare("SELECT checked_at, available, price FROM offers WHERE id='src:1'").get() as Record<string, unknown>;
    expect({ ...after }).toEqual({ ...before });
    const runs = db.prepare("SELECT status FROM import_runs WHERE source='Source test' ORDER BY id").all().map((r) => (r as { status: string }).status);
    expect(runs).toEqual(["ok", "echec", "echec"]);
    expect((db.prepare("SELECT MAX(finished_at) t FROM import_runs WHERE source='Source test' AND status='ok'").get() as { t: string }).t).toBe(lastOk);
    db.close();
  });
});

describe("Variantes Xiaomi", () => {
  it("une offre par capacité, prix le plus bas parmi les coloris en stock, rupture signalée", async () => {
    const { xiaomiVariantOffers } = await import("../scripts/import");
    const it = (id: number, name: string, price: number, out = false) => ({ item_id: id, item_name: name, price, is_sale: true, is_out_of_stock: out, is_not_for_sale: false });
    const offers = xiaomiVariantOffers(
      [
        it(1, "REDMI A7 Pro Noir 4 GO + 64 GO", 129, true),
        it(2, "REDMI A7 Pro Vert 4 GO + 64 GO", 129),
        it(3, "REDMI A7 Pro Noir 4 GO + 128 GO", 159),
        it(4, "REDMI X Noir 8 GO + 512 GO", 449, true),
      ],
      { tag: "redmi-a7-pro", modelId: "redmi-a7-pro", create: undefined },
    );
    expect(offers.map((o) => [o.storageGb, o.price, o.stock, o.url])).toEqual([
      [64, 129, "en_stock", "https://www.mi.com/fr/product/redmi-a7-pro/buy/?gid=2"],
      [128, 159, "en_stock", "https://www.mi.com/fr/product/redmi-a7-pro/buy/?gid=3"],
      [512, 449, "rupture", "https://www.mi.com/fr/product/redmi-a7-pro/buy/?gid=4"],
    ]);
    expect(offers.every((o) => o.capacityStatus === "confirmee" && o.shipping === null)).toBe(true);
  });
});
