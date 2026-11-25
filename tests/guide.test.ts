import { describe, expect, it } from "vitest";
import { budgetGuide, isGuideBudget } from "../src/lib/budget-guide";
import { model, offer, support, TODAY } from "./fixtures";

const cfg = (id: string, gb: number, offers: ReturnType<typeof offer>[]) => ({ id, storage_gb: gb, ram_gb: null, offers });

const cheapNoData = model({ id: "cheap", name: "Cheap", configs: [cfg("cheap-64", 64, [offer({ id: "c", price: 120, shipping: null })])] });
const photo = model({
  id: "photo", name: "Photo", specs: { optical_zoom: 3, ois: true, cameras: "50 Mpx principal, 12 Mpx ultra grand-angle", chip_tier: 3, width_mm: 74, weight_g: 190, battery_mah: 5000, screen_in: 6.6 },
  support: support({ security_end: "2031-01-01", security_end_precision: "jour" }),
  configs: [cfg("photo-128", 128, [offer({ id: "p", price: 280, shipping: 0 })])],
});
const tooExpensive = model({ id: "big", name: "Big", specs: { optical_zoom: 5, ois: true }, configs: [cfg("big-256", 256, [offer({ id: "b", price: 410, shipping: 0 })])] });
const start = model({ id: "start", name: "Start", configs: [cfg("start-0", 0, [offer({ id: "s", price: 199, shipping: 0, capacity_status: "prix_de_depart" })])] });

describe("Guides « meilleurs à X € »", () => {
  const g = budgetGuide(300, [cheapNoData, photo, tooExpensive, start], TODAY);

  it("ne retient que les offres sous le plafond, triées par prix, avec leur statut de frais", () => {
    expect(g.offers.map((o) => [o.entry.model.id, o.shown, o.total])).toEqual([
      ["cheap", 120, null],
      ["start", 199, null], // prix « à partir de » : jamais un coût total confirmé
      ["photo", 280, 280],
    ]);
    expect(g).toMatchObject({ models: 3, confirmed: 1, toVerify: 2 });
  });

  it("le moins cher gagne en prix ; un gagnant par usage seulement si sa donnée est connue", () => {
    const w = Object.fromEntries(g.winners.map((x) => [x.priority, x.item?.entry.model.id ?? null]));
    // « photo » est le seul modèle renseigné : il ne départage personne, donc pas de gagnant par usage.
    expect(w).toEqual({ prix: "cheap", photo: null, autonomie: null, jeux: null, une_main: null, longevite: null });
    expect(g.winners.find((x) => x.priority === "prix")!.item!.why).toContain("sous ce budget");
  });

  it("aucun gagnant inventé quand rien n'est renseigné ou qu'un seul modèle est en lice", () => {
    const only = budgetGuide(150, [cheapNoData], TODAY);
    expect(only.winners.filter((x) => x.item).map((x) => x.priority)).toEqual(["prix"]);
    const single = budgetGuide(300, [photo], TODAY);
    expect(single.winners.filter((x) => x.item).map((x) => x.priority)).toEqual(["prix"]);
  });

  it("avec deux modèles renseignés, le meilleur de chaque usage est désigné", () => {
    const basic = model({
      id: "basic", name: "Basic", specs: { optical_zoom: 1, ois: false, cameras: "50 Mpx principal", chip_tier: 1, width_mm: 78, weight_g: 215, battery_mah: 4000, screen_in: 6.7 },
      support: support({ security_end: "2028-01-01", security_end_precision: "jour" }),
      configs: [cfg("basic-128", 128, [offer({ id: "bb", price: 200, shipping: null })])],
    });
    const w = Object.fromEntries(budgetGuide(300, [basic, photo], TODAY).winners.map((x) => [x.priority, x.item?.entry.model.id ?? null]));
    expect(w).toEqual({ prix: "basic", photo: "photo", autonomie: "photo", jeux: "photo", une_main: "photo", longevite: "photo" });
  });

  it("budgets publiés uniquement", () => {
    expect(isGuideBudget(400)).toBe(true);
    expect(isGuideBudget(401)).toBe(false);
  });
});
