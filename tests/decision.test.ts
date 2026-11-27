// Aide à la décision : prix cohérent partout, explications comparatives, questionnaire court, durée de suivi annoncée.
import { describe, expect, it } from "vitest";
import { recommend, topChoices, type Answers } from "../src/lib/engine";
import { explainChoices } from "../src/lib/explain";
import { priceStatus, priceText } from "../src/lib/price";
import { parseAnswers } from "../src/lib/answers";
import { keepYearsVerdict, securityDeadline, securityHeadline } from "../src/lib/support";
import { parseXiaomiSecurityYears } from "../scripts/official";
import { model, offer, support, TODAY } from "./fixtures";

const photo400: Answers = { budget: 400, conditions: ["neuf", "reconditionne", "occasion"], priorities: ["photo"], os: "any" };

// Reproduction du parcours 400 € « photo » : trois modèles avec la même stabilisation optique.
const photoSpecs = (tier: number, extra: Record<string, unknown> = {}) => ({
  ois: true, optical_zoom: 1, cameras: "50 Mpx principal, 8 Mpx ultra grand-angle", chip_tier: tier, chip: `Puce niveau ${tier}`, ...extra,
});
const poco = model({
  id: "poco", name: "POCO X8 Pro", brand_id: "poco", brand_name: "POCO", specs: photoSpecs(4, { battery_mah: 6500 }),
  configs: [{ id: "poco-256", storage_gb: 256, ram_gb: 8, offers: [offer({ id: "poco", price: 359, shipping: null })] }],
});
const plus = model({
  id: "plus", name: "REDMI Note 15 Pro+ 5G", brand_id: "redmi", brand_name: "REDMI", specs: photoSpecs(3, { cameras: "200 Mpx principal, 8 Mpx ultra grand-angle", esim: true, battery_mah: 6500 }),
  support: support({ security_years: 6, level: "officiel" }),
  configs: [{ id: "plus-256", storage_gb: 256, ram_gb: 8, offers: [offer({ id: "plus", price: 399, shipping: null })] }],
});
const note17 = model({
  id: "n17", name: "REDMI Note 17 Pro 5G", brand_id: "redmi", brand_name: "REDMI", specs: photoSpecs(2, { esim: true, battery_mah: 8340 }),
  support: support({ security_years: 6, level: "officiel" }),
  configs: [{ id: "n17-256", storage_gb: 256, ram_gb: 6, offers: [offer({ id: "n17", price: 399, shipping: null })] }],
});

describe("Prix : une seule présentation", () => {
  it("399 € avec livraison gratuite : total frais inclus, dans un budget de 400 €", () => {
    const p = priceStatus({ price: 399, mandatory_fees: 0, shipping: 0 }, 400);
    expect(p.kind).toBe("total");
    expect(p.amount).toBe(399);
    expect(p.withinBudget).toBe(true);
    expect(priceText({ price: 399, mandatory_fees: 0, shipping: 0 })).toBe("399 € frais inclus · livraison gratuite");
  });
  it("399 € avec frais inconnus : hors frais, budget respecté si les frais ne dépassent pas 1 €", () => {
    const p = priceStatus({ price: 399, mandatory_fees: 0, shipping: null }, 400);
    expect(priceText({ price: 399, mandatory_fees: 0, shipping: null })).toBe("399 € hors frais · livraison à vérifier");
    expect(p.headroom).toBe(1);
    expect(p.budgetNote).toBe("Cette offre respecte ton budget si les frais ne dépassent pas 1 €.");
  });
  it("399 € avec 5 € de frais : 404 € frais inclus, au-dessus du plafond", () => {
    const p = priceStatus({ price: 399, mandatory_fees: 0, shipping: 5 }, 400);
    expect(p.amount).toBe(404);
    expect(p.withinBudget).toBe(false);
  });
  it("les trois cas dans les résultats : gratuit retenu, inconnu à vérifier, 5 € exclu", () => {
    const mk = (id: string, shipping: number | null) =>
      model({ id, name: id, specs: photoSpecs(3), configs: [{ id: `${id}-128`, storage_gb: 128, ram_gb: 8, offers: [offer({ id, price: 399, shipping })] }] });
    const models = [mk("gratuite", 0), mk("inconnue", null), mk("cinq", 5)];
    const r = recommend(photo400, models, TODAY);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.picks.map((p) => p.model.id)).toEqual(["gratuite"]);
    expect(r.toVerify.map((v) => v.model.id)).toEqual(["inconnue"]);
    const ids = topChoices(photo400, models, TODAY).map((c) => c.model.id);
    expect(ids).toContain("gratuite");
    expect(ids).toContain("inconnue");
    expect(ids).not.toContain("cinq");
  });
  it("un prix « à partir de » n'est jamais présenté comme un coût total", () => {
    expect(priceStatus({ price: 299, mandatory_fees: 0, shipping: 0, capacity_status: "prix_de_depart" }).kind).toBe("depart");
  });
});

describe("Explications : pourquoi le N°1 passe devant", () => {
  const choices = topChoices(photo400, [poco, plus, note17], TODAY);
  const ex = explainChoices(choices, photo400, TODAY);

  it("garde l'ordre du classement et trois modèles distincts", () => {
    expect(choices.map((c) => c.model.id)).toEqual(["poco", "plus", "n17"]);
  });
  it("dit une seule fois l'avantage commun (stabilisation optique)", () => {
    expect(ex.shared).toMatch(/Les 3 disposent d'une stabilisation optique/);
    for (const it of ex.items) expect(`${it.lead} ${it.versus ?? ""}`).not.toMatch(/stabilisation optique/);
  });
  it("le N°1 : aucune qualité photo déduite, critère décisif et écart de 40 € avant livraison", () => {
    const t = `${ex.items[0].lead} ${ex.items[0].versus ?? ""}`;
    expect(t).toMatch(/Nos données ne permettent pas de départager leur qualité photo/);
    expect(t).toMatch(/niveau 4\/5 contre 3\/5/);
    expect(t).toMatch(/40 € de moins que le REDMI Note 15 Pro\+ 5G avant livraison/);
    expect(t).not.toMatch(/Mpx|mégapixel/i);
  });
  it("l'alternative à 399 € : ce que rapportent les 40 € de plus (6 ans annoncés)", () => {
    const t = `${ex.items[1].lead} ${ex.items[1].versus ?? ""}`;
    expect(t).toMatch(/Pour 40 € de plus avant livraison/);
    expect(t).toMatch(/6 ans de correctifs de sécurité annoncés par Xiaomi/);
  });
  it("le N°3 ne répète pas les atouts du N°2 et explique ce qui les sépare", () => {
    const t = `${ex.items[2].lead} ${ex.items[2].versus ?? ""}`;
    expect(t).toMatch(/mêmes atouts que le N°2/i);
    expect(t).not.toMatch(/6 ans/);
    expect(t).toMatch(/batterie annoncée plus grande .*pas une mesure d'autonomie/);
  });
  it("profil longévité : le suivi de sécurité vient en premier", () => {
    const a: Answers = { ...photo400, priorities: ["longevite"] };
    const dated = model({
      id: "dated", name: "Galaxy Test", brand_id: "samsung", brand_name: "Samsung", specs: photoSpecs(3),
      support: support({ security_end: "2032-10-31", security_end_precision: "jour" }),
      configs: [{ id: "d-128", storage_gb: 128, ram_gb: 8, offers: [offer({ id: "d", price: 300 })] }],
    });
    const c = topChoices(a, [dated, plus], TODAY);
    const e = explainChoices(c, a, TODAY);
    expect(c[0].model.id).toBe("dated");
    expect(e.items[0].lead).toMatch(/^Correctifs de sécurité annoncés jusqu'au 31 octobre 2032/);
    expect(e.items[1].lead).toMatch(/6 ans de correctifs de sécurité annoncés par Xiaomi, sans date de départ publiée : temps restant à vérifier/);
  });
});

describe("Questionnaire court : une question sautée vaut « Sans préférence »", () => {
  it("un conseil photo n'impose ni 128 Go ni 3 ans", () => {
    const a = parseAnswers({ budget: "400", etat: "neuf,reconditionne,occasion", prio: "photo", os: "any" })!;
    expect(a.minStorage).toBeNull();
    expect(a.keepYears).toBeNull();
    expect(a.usage).toBeNull();
    expect(a.size).toBeNull();
  });
  it("les critères précisés sont conservés", () => {
    const a = parseAnswers({ budget: "400", etat: "neuf", prio: "photo", os: "any", stockage: "128", annees: "3" })!;
    expect(a.minStorage).toBe(128);
    expect(a.keepYears).toBe(3);
  });
});

describe("Durée de suivi annoncée sans échéance", () => {
  it("lit « 6 ans de mises à jour de sécurité » sur une page Xiaomi", () => {
    expect(parseXiaomiSecurityYears("Plus rapide. 6 ans de mises à jour de sécurité Davantage de fonctions")).toBe(6);
    expect(parseXiaomiSecurityYears("Mises à jour régulières")).toBeNull();
  });
  it("affiche « 6 ans annoncés » sans inventer de temps restant", () => {
    const d = securityDeadline(support({ security_years: 6, level: "officiel" }), TODAY);
    expect(d.state).toBe("inconnue");
    expect(d.monthsLeft).toBeNull();
    expect(securityHeadline(d)).toBe("6 ans annoncés · temps restant à vérifier");
    expect(keepYearsVerdict(3, d).ok).toBeNull();
    expect(keepYearsVerdict(3, d).text).toMatch(/reste à vérifier/);
  });
});
