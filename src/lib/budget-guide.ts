// Guides « Meilleurs smartphones à X € » : calculés à partir des mêmes offres et du même moteur que les
// recommandations. Un gagnant n'est désigné que si la donnée qui le départage est connue.
import {
  admissibleEntries, offerTotal, rank, rawMetric, shownPrice, verifyEntries, whyOneLiner,
  type Answers, type CandidateModel, type Entry, type Priority,
} from "./engine";

export const GUIDE_BUDGETS = [150, 200, 250, 300, 400, 500, 700, 1000] as const;

export const GUIDE_CATEGORIES: { priority: Priority; title: string; blurb: string }[] = [
  { priority: "prix", title: "Le moins cher", blurb: "Le prix le plus bas parmi les offres relevées sous ce budget." },
  { priority: "photo", title: "Pour la photo", blurb: "Téléobjectif, stabilisation optique et ultra grand-angle annoncés par le fabricant." },
  { priority: "autonomie", title: "Pour l'autonomie", blurb: "La plus grande batterie annoncée rapportée à la taille de l'écran (pas de mesure indépendante)." },
  { priority: "jeux", title: "Pour jouer", blurb: "La puce la plus performante et l'écran le plus fluide." },
  { priority: "une_main", title: "Le plus maniable", blurb: "Le plus étroit et le plus léger, pour l'utiliser à une main." },
  { priority: "longevite", title: "Le suivi le plus long", blurb: "Les correctifs de sécurité annoncés le plus longtemps." },
];

export interface GuideItem {
  entry: Entry;
  /** Coût total connu (frais inclus) ou null si des frais restent à vérifier. */
  total: number | null;
  shown: number;
  why: string;
}

export interface BudgetGuide {
  budget: number;
  winners: { priority: Priority; title: string; blurb: string; item: GuideItem | null }[];
  offers: GuideItem[];
  models: number;
  confirmed: number;
  toVerify: number;
}

export function isGuideBudget(n: number): boolean {
  return (GUIDE_BUDGETS as readonly number[]).includes(n);
}

export function budgetGuide(budget: number, models: CandidateModel[], today: Date): BudgetGuide {
  const base: Answers = { budget, conditions: ["neuf", "reconditionne"], priorities: ["prix"], os: "any" };
  const entries = [...admissibleEntries(base, models, today), ...verifyEntries(base, models, today)];
  const item = (e: Entry, answers: Answers): GuideItem => ({
    entry: e,
    total: offerTotal(e.offer),
    shown: shownPrice(e.offer),
    why: whyOneLiner(e, answers, 0, today).replace("qui respectent tes critères", "sous ce budget").replace("pour tes critères", "sous ce budget"),
  });

  const winners = GUIDE_CATEGORIES.map((c) => {
    const answers: Answers = { ...base, priorities: [c.priority] };
    const ranked = rank(answers, entries, today);
    const known = ranked.filter((x) => c.priority === "prix" || rawMetric(c.priority, x.e, answers, today) !== null);
    // Un « meilleur » n'a de sens que s'il départage au moins deux modèles dont la donnée est connue.
    const contenders = new Set(known.map((x) => x.e.model.id)).size;
    const best = c.priority === "prix" || contenders >= 2 ? known[0] : undefined;
    return { ...c, item: best ? item(best.e, answers) : null };
  });

  // Toutes les offres sous le budget, une par modèle/capacité/état/vendeur (la moins chère), par prix croissant.
  const byKey = new Map<string, Entry>();
  for (const e of entries) {
    const k = `${e.model.id}|${e.config.id}|${e.offer.condition}|${e.offer.seller}`;
    const prev = byKey.get(k);
    if (!prev || shownPrice(e.offer) < shownPrice(prev.offer)) byKey.set(k, e);
  }
  const offers = [...byKey.values()].sort((a, b) => shownPrice(a.offer) - shownPrice(b.offer)).map((e) => item(e, base));
  return {
    budget,
    winners,
    offers,
    models: new Set(offers.map((o) => o.entry.model.id)).size,
    confirmed: offers.filter((o) => o.total !== null).length,
    toVerify: offers.filter((o) => o.total === null).length,
  };
}
