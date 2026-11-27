// Budget exact au centime : saisie, règle commune, seuils de chaque offre active, monotonie.
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { admissibleEntries, offerTotal, shownPrice, verifyEntries, isFresh, type Answers, type CandidateModel, type OfferLite } from "../src/lib/engine";
import { BUDGET_MAX, BUDGET_MIN, addEuros, parseBudget } from "../src/lib/money";
import { parseAnswers } from "../src/lib/answers";
import { priceStatus } from "../src/lib/price";
import { model, offer, TODAY } from "./fixtures";

const ask = (budget: number): Answers => ({ budget, conditions: ["neuf", "reconditionne", "occasion"], priorities: ["prix"], os: "any" });
const confirmed = (budget: number, models: CandidateModel[], today = TODAY) => new Set(admissibleEntries(ask(budget), models, today).map((e) => e.offer.id));
const toVerify = (budget: number, models: CandidateModel[], today = TODAY) => new Set(verifyEntries(ask(budget), models, today).map((e) => e.offer.id));

describe("Saisie du budget", () => {
  it.each([
    ["327,50", 327.5], ["327.50", 327.5], ["1 200", 1200], ["1 200,5 €", 1200.5], ["194,89", 194.89], ["50", 50], ["5000", 5000],
  ])("accepte « %s »", (input, value) => {
    expect(parseBudget(input)).toEqual({ ok: true, value });
  });
  it.each([["", "vide"], ["abc", "invalide"], ["12,345", "trois décimales"], ["-300", "négatif"], ["49,99", "sous la limite"], ["5000,01", "au-dessus"]])(
    "refuse « %s » (%s) avec un message", (input) => {
      const r = parseBudget(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    });
  it("ne ramène jamais au palier le plus proche et conserve le montant dans l'URL", () => {
    expect(parseAnswers({ budget: "327,50", etat: "neuf", prio: "photo", os: "any" })!.budget).toBe(327.5);
    expect(parseAnswers({ budget: "abc" })).toBeNull();
  });
});

describe("Règle commune du plafond (centimes)", () => {
  const m = model({
    id: "m", configs: [{ id: "m-128", storage_gb: 128, ram_gb: null, offers: [
      offer({ id: "total", price: 189.9, shipping: 4.99 }),
      offer({ id: "inconnue", price: 189.9, shipping: null }),
      offer({ id: "frais-partiels", price: 189.9, mandatory_fees: null, shipping: 4.99 }),
      offer({ id: "gratuite", price: 189.9, shipping: 0 }),
    ] }],
  });
  it("189,90 € + 4,99 € = 194,89 € : exclu à 194,88 €, retenu à 194,89 €", () => {
    expect(addEuros(189.9, 4.99)).toBe(194.89);
    expect(confirmed(194.88, [m]).has("total")).toBe(false);
    expect(confirmed(194.89, [m]).has("total")).toBe(true);
  });
  it("livraison gratuite confirmée : 0 €, frais inclus", () => {
    expect(confirmed(189.9, [m]).has("gratuite")).toBe(true);
    expect(priceStatus(m.configs[0].offers[3], 189.9).kind).toBe("total");
  });
  it("livraison inconnue : jamais supposée gratuite, offre à vérifier sous le plafond", () => {
    expect(confirmed(500, [m]).has("inconnue")).toBe(false);
    expect(toVerify(189.9, [m]).has("inconnue")).toBe(true);
    expect(toVerify(189.89, [m]).has("inconnue")).toBe(false);
  });
  it("frais partiellement inconnus : le minimum connu (prix + livraison) décide", () => {
    const o = m.configs[0].offers[2];
    expect(shownPrice(o)).toBe(194.89);
    expect(toVerify(194.88, [m]).has("frais-partiels")).toBe(false);
    expect(toVerify(194.89, [m]).has("frais-partiels")).toBe(true);
  });
  it("offre expirée, indisponible ou à prix conditionnel : jamais recommandée", () => {
    const x = model({ id: "x", configs: [{ id: "x-1", storage_gb: 128, ram_gb: null, offers: [
      offer({ id: "vieille", price: 100, checked_at: "2026-11-01T00:00:00Z" }),
      offer({ id: "rupture", price: 100, available: false }),
      offer({ id: "reprise", price: 100, price_conditions: "avec reprise d'un ancien téléphone" }),
      offer({ id: "dollars", price: 100, currency: "USD" }),
    ] }] });
    expect(confirmed(400, [x]).size).toBe(0);
    expect(toVerify(400, [x]).size).toBe(0);
  });
});

describe("Monotonie : augmenter le budget conserve les offres admissibles", () => {
  const models = [1, 2, 3, 4, 5, 6].map((k) => model({
    id: `p${k}`, configs: [{ id: `p${k}-128`, storage_gb: 128, ram_gb: null, offers: [
      offer({ id: `p${k}-a`, price: 100 + k * 37.37, shipping: k % 2 ? 4.99 : 0 }),
      offer({ id: `p${k}-b`, price: 120 + k * 41.11, shipping: null }),
    ] }],
  }));
  it("de 50 € à 600 € par pas de 0,37 €", () => {
    let prevC = new Set<string>(), prevV = new Set<string>();
    for (let c = 5000; c <= 60000; c += 37) {
      const b = c / 100;
      const nowC = confirmed(b, models), nowV = toVerify(b, models);
      for (const id of prevC) expect(nowC.has(id)).toBe(true);
      // Une offre à vérifier reste visible (à vérifier) quand le budget augmente.
      for (const id of prevV) expect(nowV.has(id)).toBe(true);
      prevC = nowC; prevV = nowV;
    }
  });
});

// ───────── Toutes les offres actives de la base locale (si elle est présente) ─────────
const DB = "data/catalog.db";
const hasDb = existsSync(DB);

function loadModels(): CandidateModel[] {
  const db = new DatabaseSync(DB, { readOnly: true });
  const rows = db.prepare(`SELECT o.*, c.model_id, c.storage_gb, c.ram_gb FROM offers o JOIN configs c ON c.id=o.config_id WHERE o.is_test=0`).all() as Record<string, unknown>[];
  const byModel = new Map<string, CandidateModel>();
  for (const r of rows) {
    const id = String(r.model_id);
    const m = byModel.get(id) ?? model({ id, configs: [] });
    let cfg = m.configs.find((c) => c.id === r.config_id);
    if (!cfg) { cfg = { id: String(r.config_id), storage_gb: Number(r.storage_gb), ram_gb: null, offers: [] }; m.configs.push(cfg); }
    cfg.offers.push({ ...(r as unknown as OfferLite), available: !!r.available });
    byModel.set(id, m);
  }
  return [...byModel.values()];
}

describe.skipIf(!hasDb)("Seuils de budget pour chaque offre active de la base", () => {
  const models = hasDb ? loadModels() : [];
  const now = new Date();
  const active = models.flatMap((m) => m.configs.flatMap((c) => c.offers)).filter((o) => isFresh(o, now));
  const inRange = (b: number) => b >= BUDGET_MIN && b <= BUDGET_MAX;

  it(`teste total − 0,01 €, total exact et total + 0,01 € (${active.length} offres actives)`, () => {
    let tested = 0;
    for (const o of active) {
      const t = offerTotal(o);
      const base = t ?? shownPrice(o);
      for (const [b, expected] of [[addEuros(base, -0.01), false], [base, true], [addEuros(base, 0.01), true]] as const) {
        if (!inRange(b)) continue;
        const set = t !== null ? confirmed(b, models, now) : toVerify(b, models, now);
        expect(set.has(o.id), `${o.id} à ${b} €`).toBe(expected);
        // Le statut affiché suit la même règle.
        const p = priceStatus(o, b);
        if (t !== null) expect(p.withinBudget).toBe(expected);
        else expect(p.headroom! >= 0).toBe(expected);
      }
      tested++;
    }
    console.info(`[budget] ${tested} offres actives testées aux seuils (${active.filter((o) => offerTotal(o) !== null).length} à total connu, ${active.filter((o) => offerTotal(o) === null).length} à frais inconnus)`);
    expect(tested).toBe(active.length);
  });
});
