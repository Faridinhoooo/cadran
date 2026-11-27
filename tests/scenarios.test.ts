import { describe, expect, it } from "vitest";
import { admissibleEntries, availableWithinBudget, recommend, topChoices, type Answers } from "../src/lib/engine";
import { parseAnswers, toParams, withPatch } from "../src/lib/answers";
import { estimateMarket } from "../src/lib/market";
import { searchModels } from "../src/lib/search";
import { securityDeadline, securityHeadline, keepYearsVerdict } from "../src/lib/support";
import { model, offer, phoneA, phoneB, support, TODAY } from "./fixtures";

const base: Answers = { budget: 400, conditions: ["neuf", "reconditionne"], priorities: ["photo"], os: "any" };

describe("Budget et coût total", () => {
  const m = model({
    id: "m", configs: [{ id: "m-128", storage_gb: 128, ram_gb: null, offers: [
      offer({ id: "pile", price: 400 }),
      offer({ id: "frais", price: 395, mandatory_fees: 10 }),
      offer({ id: "livraison-inconnue", price: 300, shipping: null }),
    ] }],
  });
  it("accepte une offre à 400 € tout compris pour un plafond de 400 €", () => {
    const ids = admissibleEntries(base, [m], TODAY).map((e) => e.offer.id);
    expect(ids).toContain("pile");
  });
  it("exclut une offre à 395 € avec 10 € de frais obligatoires", () => {
    const ids = admissibleEntries(base, [m], TODAY).map((e) => e.offer.id);
    expect(ids).not.toContain("frais");
  });
  it("exclut une offre dont le coût total est inconnu", () => {
    const ids = admissibleEntries(base, [m], TODAY).map((e) => e.offer.id);
    expect(ids).not.toContain("livraison-inconnue");
  });
  it("affiche la marge sous le budget et 'pile à ton plafond'", () => {
    const r = recommend(base, [m], TODAY);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.picks[0].margin).toBe(0);
      expect(r.picks[0].explanation.join(" ")).toContain("pile à ton plafond");
    }
  });
});

describe("Capacités", () => {
  it("une offre 128 Go ne sert jamais à recommander la version 256 Go", () => {
    const r = recommend({ ...base, minStorage: 256 }, [phoneA], TODAY);
    // L'offre 256 Go coûte 450 € (> 400 €) ; l'offre 128 Go à 380 € ne doit pas être utilisée.
    expect(r.status).toBe("aucun");
    if (r.status === "aucun") {
      const s = r.blockers.find((b) => b.criterion === "stockage");
      expect(s?.message).toContain("128 Go");
      expect(s?.suggestion?.patch).toEqual({ minStorage: 128 });
      expect(r.blockers.find((b) => b.criterion === "budget")?.message).toContain("450 €");
    }
  });
  it("changer de capacité change le prix utilisé", () => {
    const r128 = recommend({ ...base, budget: 500 }, [phoneA], TODAY);
    const r256 = recommend({ ...base, budget: 500, minStorage: 256 }, [phoneA], TODAY);
    expect(r128.status === "ok" && r128.picks[0].total).toBe(380);
    expect(r256.status === "ok" && r256.picks[0].total).toBe(450);
    expect(r256.status === "ok" && r256.picks[0].config.storage_gb).toBe(256);
  });
  it("le budget n'est jamais relevé automatiquement", () => {
    const r = recommend({ ...base, budget: 200 }, [phoneA, phoneB], TODAY);
    expect(r.status).toBe("aucun");
    if (r.status === "aucun") expect(r.blockers[0].suggestion?.patch).toEqual({});
  });
});

describe("Recherche catalogue", () => {
  const brands = [
    { id: "samsung", name: "Samsung", parent_id: null, aliases: ["galaxy"] },
    { id: "xiaomi", name: "Xiaomi", parent_id: null, aliases: [] },
    { id: "redmi", name: "Redmi", parent_id: "xiaomi", aliases: [] },
    { id: "poco", name: "POCO", parent_id: "xiaomi", aliases: ["pocco"] },
    { id: "oneplus", name: "OnePlus", parent_id: null, aliases: ["one plus"] },
  ];
  const items = [
    { id: "s-a55", name: "Galaxy A55 5G", brand_id: "samsung", brand_name: "Samsung", series_name: "Galaxy A" },
    { id: "s-s25", name: "Galaxy S25", brand_id: "samsung", brand_name: "Samsung", series_name: "Galaxy S" },
    { id: "x-14", name: "Xiaomi 14", brand_id: "xiaomi", brand_name: "Xiaomi", series_name: "Xiaomi (série numérotée)" },
    { id: "r-n13", name: "Redmi Note 13", brand_id: "redmi", brand_name: "Redmi", series_name: "Redmi Note" },
    { id: "p-x6", name: "POCO X6 Pro 5G", brand_id: "poco", brand_name: "POCO", series_name: "POCO X" },
    { id: "o-12", name: "OnePlus 12", brand_id: "oneplus", brand_name: "OnePlus", series_name: "Série numérotée" },
  ];
  const ids = (q: string) => searchModels(items, q, brands).map((m) => m.id);
  it("un Galaxy A est trouvable par sa gamme", () => expect(ids("Galaxy A")).toEqual(["s-a55"]));
  it("une recherche Xiaomi retrouve aussi Redmi et POCO", () => expect(ids("Xiaomi").sort()).toEqual(["p-x6", "r-n13", "x-14"]));
  it("Redmi Note reste un filtre distinct", () => expect(ids("Redmi Note")).toEqual(["r-n13"]));
  it("accepte « One Plus » et « Pocco »", () => {
    expect(ids("One Plus 12")).toEqual(["o-12"]);
    expect(ids("pocco")).toEqual(["p-x6"]);
  });
});

describe("Modifier une priorité", () => {
  it("conserve les autres réponses et recalcule classement et explication", () => {
    const a: Answers = { budget: 600, conditions: ["neuf"], priorities: ["photo"], os: "android", minStorage: 128, esim: false };
    const changed = parseAnswers(Object.fromEntries(new URLSearchParams(withPatch(a, { priorities: ["autonomie"] }))))!;
    expect(changed).toMatchObject({ budget: 600, conditions: ["neuf"], os: "android", minStorage: 128, priorities: ["autonomie"] });
    const r1 = recommend(a, [phoneA, phoneB], TODAY);
    const r2 = recommend(changed, [phoneA, phoneB], TODAY);
    if (r1.status !== "ok" || r2.status !== "ok") throw new Error("résultats attendus");
    expect(r1.picks[0].model.id).toBe("phone-a"); // téléobjectif + stabilisation
    expect(r2.picks[0].model.id).toBe("phone-b"); // 6000 mAh pour 6,7″
    expect(r1.picks[0].explanation[0]).toContain("photos");
    expect(r2.picks[0].explanation[0]).toContain("batterie");
  });
  it("les réponses font l'aller-retour par l'URL", () => {
    const a: Answers = { budget: 450, conditions: ["reconditionne"], priorities: ["longevite", "une_main"], os: "ios", keepYears: 4, minStorage: 256, esim: true, includeBrands: ["apple"], excludeBrands: [], usage: "intensif", size: "compact" };
    expect(parseAnswers(Object.fromEntries(toParams(a)))).toEqual(a);
  });
});

describe("Offres expirées", () => {
  it("une offre expirée sort des recommandations, le modèle reste dans le catalogue", () => {
    const old = model({ id: "vieux", name: "Vieux", configs: [{ id: "v-128", storage_gb: 128, ram_gb: null, offers: [offer({ id: "o", price: 100, checked_at: "2026-10-01T00:00:00Z" })] }] });
    const gone = model({ id: "retire", name: "Retiré", configs: [{ id: "r-128", storage_gb: 128, ram_gb: null, offers: [offer({ id: "o2", price: 100, available: false })] }] });
    expect(recommend(base, [old, gone], TODAY).status).toBe("aucun");
    expect(searchModels([{ id: "vieux", name: "Vieux", brand_id: "test", brand_name: "Test", series_name: null }], "vieux", [])).toHaveLength(1);
  });
});

describe("Occasion entre particuliers", () => {
  it("une cote seule ne déclenche pas « disponible dans ton budget »", () => {
    const r = recommend({ ...base, conditions: ["occasion"] }, [phoneA, phoneB], TODAY);
    expect(r.status).toBe("aucun");
    if (r.status === "aucun") expect(r.blockers.find((b) => b.criterion === "etat")?.message).toContain("cote estimée");
    expect(availableWithinBudget(offer({ id: "x", price: 100, shipping: null }), 400, TODAY)).toBe(false);
  });
  it("cote : médiane et 25e–75e percentiles arrondis à 5 €, au moins 5 annonces sur 30 jours", () => {
    const obs = [210, 230, 240, 250, 262, 300].map((price, i) => ({ id: `a${i}`, price, observed_at: "2026-11-10", excluded_reason: null }));
    const est = estimateMarket([...obs, { id: "pieces", price: 50, observed_at: "2026-11-10", excluded_reason: "pour pièces" }, { id: "vieille", price: 999, observed_at: "2026-09-01", excluded_reason: null }, obs[0]], TODAY);
    expect(est).toMatchObject({ ok: true, count: 6, median: 245, p25: 235, p75: 260 });
    expect(estimateMarket(obs.slice(0, 4), TODAY)).toMatchObject({ ok: false, message: "Trop peu d'annonces comparables pour estimer le prix" });
  });
});

describe("Suivi logiciel", () => {
  const d = (end: string | null, precision: string | null = "jour", confirmed = 0) =>
    securityDeadline(support({ security_end: end, security_end_precision: precision, security_end_confirmed: confirmed }), TODAY);
  it("avant l'échéance (date exacte)", () => {
    expect(securityHeadline(d("2031-03-15"))).toBe("Correctifs garantis jusqu'au 15 mars 2031 · Encore 4 ans et 3 mois");
  });
  it("sous un mois : jours restants", () => {
    expect(securityHeadline(d("2026-12-10"))).toBe("Correctifs garantis jusqu'au 10 décembre 2026 · Encore 16 jours");
  });
  it("le jour de l'échéance", () => {
    expect(d("2026-11-24").state).toBe("dernier_jour");
    expect(securityHeadline(d("2026-11-24"))).toContain("dernier jour");
  });
  it("après l'échéance : période garantie terminée, « Support terminé » seulement si confirmé", () => {
    expect(securityHeadline(d("2026-11-23"))).toBe("Période garantie terminée");
    expect(securityHeadline(d("2025-01-01", "jour", 1))).toBe("Support terminé");
  });
  it("mois connu : pas de jour inventé", () => {
    const h = securityHeadline(d("2033-08-01", "mois"));
    expect(h).toBe("Correctifs garantis jusqu'en août 2033 · Encore environ 6 ans et 9 mois");
  });
  it("aucune date publiée", () => {
    expect(securityHeadline(d(null))).toBe("Date de fin non annoncée");
    expect(keepYearsVerdict(4, d(null)).ok).toBeNull();
  });
  it("garder 4 ans : comparé à la durée restante aujourd'hui", () => {
    expect(keepYearsVerdict(4, d("2031-03-15")).ok).toBe(true);
    expect(keepYearsVerdict(4, d("2029-01-01")).ok).toBe(false);
  });
});

describe("Exigences inconnues", () => {
  it("une eSIM inconnue ne valide pas l'exigence eSIM", () => {
    const ids = admissibleEntries({ ...base, budget: 1000, esim: true }, [phoneA, phoneB], TODAY).map((e) => e.model.id);
    expect(ids).toContain("phone-a");
    expect(ids).not.toContain("phone-b");
  });
  it("le choix iPhone ou Android est un filtre obligatoire", () => {
    expect(admissibleEntries({ ...base, os: "ios" }, [phoneA, phoneB], TODAY)).toHaveLength(0);
  });
  it("priorité prix : l'offre la moins chère qui satisfait le besoin, pas le plafond", () => {
    const r = recommend({ ...base, budget: 1000, priorities: ["prix"] }, [phoneA, phoneB], TODAY);
    expect(r.status === "ok" && r.picks[0].total).toBe(250);
  });
});

describe("Profil et 3 choix", () => {
  const phone = (id: string, price: number, specs: Record<string, unknown>) =>
    model({ id, name: id, specs, configs: [{ id: `${id}-128`, storage_gb: 128, ram_gb: 8, offers: [offer({ id: `o-${id}`, price })] }] });
  const petit = phone("petit", 300, { screen_in: 6.1, battery_mah: 4000, chip_tier: 3 });
  const grand = phone("grand", 300, { screen_in: 6.8, battery_mah: 6000, chip_tier: 4 });
  const moyen = phone("moyen", 300, { screen_in: 6.5, battery_mah: 5000, chip_tier: 3 });
  const tous = [petit, grand, moyen];
  it("la taille d'écran préférée départage des modèles équivalents", () => {
    const a = { ...base, priorities: ["prix" as const] };
    expect(topChoices({ ...a, priorities: ["photo"], size: "compact" }, tous, TODAY)[0].model.id).toBe("petit");
    expect(topChoices({ ...a, priorities: ["photo"], size: "grand" }, tous, TODAY)[0].model.id).toBe("grand");
  });
  it("trois modèles différents au plus, chacun avec une phrase d'explication", () => {
    const c = topChoices({ ...base, priorities: ["autonomie"], usage: "intensif" }, tous, TODAY);
    expect(c.map((x) => x.model.id)).toEqual(["grand", "moyen", "petit"]);
    expect(new Set(c.map((x) => x.model.id)).size).toBe(3);
    for (const x of c) expect(x.why.length).toBeGreaterThan(10);
  });
});

describe("Fiabilité du questionnaire : le budget sert à viser la bonne gamme", () => {
  const phone = (id: string, price: number, mah: number) =>
    model({ id, name: id, specs: { battery_mah: mah, screen_in: 6.6, chip_tier: 3 }, configs: [{ id: `${id}-256`, storage_gb: 256, ram_gb: 8, offers: [offer({ id: `o-${id}`, price })] }] });
  const tous = [phone("pas-cher", 350, 8000), phone("haut", 750, 7000), phone("milieu", 500, 5000), phone("trop-cher", 900, 9000)];
  it("à 800 € pour l'autonomie, un modèle qui exploite le budget passe devant un modèle bien moins cher à peine meilleur", () => {
    const c = topChoices({ ...base, budget: 800, priorities: ["autonomie"] }, tous, TODAY);
    expect(c[0].model.id).toBe("haut");
  });
  it("jamais au-dessus du budget, frais inclus", () => {
    for (const b of [400, 800, 1200]) for (const p of ["photo", "autonomie", "jeux", "prix"] as const)
      for (const x of topChoices({ ...base, budget: b, priorities: [p] }, tous, TODAY)) expect(x.total ?? x.shown).toBeLessThanOrEqual(b);
  });
  it("si la priorité est le prix, le moins cher reste en tête", () => {
    expect(topChoices({ ...base, budget: 800, priorities: ["prix"] }, tous, TODAY)[0].model.id).toBe("pas-cher");
  });
});
