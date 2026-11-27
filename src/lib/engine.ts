// Moteur de recommandation — fonctions pures, testables sans base de données.
//
// 1. Contraintes obligatoires : offre achetable, récente, coût total connu ≤ budget, état accepté,
//    système imposé, stockage minimum, eSIM, marques. Une donnée inconnue ne valide jamais une exigence.
// 2. Classement selon une priorité principale (65 %) et éventuellement une seconde (35 %).
// 3. L'explication est générée à partir des mêmes métriques que le classement.

import { securityDeadline, keepYearsVerdict, type SupportRow, type Deadline } from "./support";

export const OFFER_MAX_AGE_DAYS = 7;

export type Condition = "neuf" | "reconditionne" | "occasion";
export type Priority = "photo" | "autonomie" | "jeux" | "une_main" | "longevite" | "prix";
export type OsChoice = "ios" | "android" | "any";

export const PRIORITY_LABELS: Record<Priority, string> = {
  photo: "les photos et vidéos",
  autonomie: "l'autonomie",
  jeux: "les jeux exigeants",
  une_main: "l'utilisation à une main",
  longevite: "la durée de suivi",
  prix: "le prix",
};

export const CONDITION_LABELS: Record<Condition, string> = {
  neuf: "Neuf",
  reconditionne: "Reconditionné",
  occasion: "Occasion",
};

export interface Answers {
  budget: number;
  conditions: Condition[];
  priorities: Priority[]; // 1 ou 2
  os: OsChoice;
  keepYears?: number | null;
  minStorage?: number | null;
  esim?: boolean;
  includeBrands?: string[];
  excludeBrands?: string[];
  /** Intensité d'utilisation au quotidien. */
  usage?: Usage | null;
  /** Taille d'écran préférée. */
  size?: SizePref | null;
}

export type Usage = "leger" | "moyen" | "intensif";
export type SizePref = "compact" | "standard" | "grand";

export interface OfferLite {
  id: string;
  condition: Condition;
  seller: string;
  platform: string | null;
  price: number;
  mandatory_fees: number | null;
  shipping: number | null;
  available: boolean;
  checked_at: string;
  url: string;
  grade: string | null;
  battery_note: string | null;
  warranty: string | null;
  returns_policy: string | null;
  /** Champs de traçabilité (facultatifs pour les données de test). */
  stock?: string;
  shipping_status?: string;
  shipping_note?: string | null;
  capacity_status?: string;
  variant_check?: string | null;
  is_demo?: number | boolean;
}

export interface ConfigLite {
  id: string;
  storage_gb: number;
  ram_gb: number | null;
  offers: OfferLite[];
}

export interface CandidateModel {
  id: string;
  name: string;
  brand_id: string;
  brand_name: string;
  os: "ios" | "android" | null;
  form_factor: string | null;
  image: string | null;
  specs: Record<string, unknown>;
  measured: Record<string, unknown>;
  support: SupportRow | null;
  configs: ConfigLite[];
}

export interface Entry {
  model: CandidateModel;
  config: ConfigLite;
  offer: OfferLite;
  total: number;
}

export interface Recommendation extends Entry {
  margin: number;
  score: number;
  norms: Partial<Record<Priority, number | null>>;
  security: Deadline;
  explanation: string[];
  /** Une phrase : pourquoi ce modèle ressort pour ces réponses. */
  why: string;
  advantages: string[];
  offerComparison: string | null;
}

export interface Blocker {
  criterion: "budget" | "stockage" | "systeme" | "etat" | "esim" | "marques" | "offres";
  message: string;
  suggestion: { label: string; patch: Partial<Answers> } | null;
}

/** Offre dont le prix affiché respecte le plafond mais dont certains frais sont inconnus. */
export interface VerifyCard {
  model: CandidateModel;
  config: ConfigLite;
  offer: OfferLite;
  /** Prix affiché + frais obligatoires connus (hors livraison inconnue). */
  shownPrice: number;
  /** Montant de frais supplémentaires que l'offre peut absorber en restant dans le budget (pas une estimation). */
  headroom: number;
  /** Ce qui reste à vérifier chez le vendeur. */
  toCheck: ("livraison" | "capacite")[];
  why: string;
}

export type Funnel = Record<
  "total" | "indisponible" | "perime" | "demo" | "variante" | "systeme" | "etat" | "stockage" | "esim" | "marques" | "hors_budget" | "a_verifier" | "confirmee",
  number
>;

export type Result =
  | { status: "ok"; picks: Recommendation[]; toVerify: VerifyCard[]; admissibleModels: number; funnel: Funnel }
  | { status: "aucun"; reason: "donnees" | "criteres"; blockers: Blocker[]; toVerify: VerifyCard[]; funnel: Funnel };

// ───────────── Offres ─────────────

/** Coût total : prix + frais obligatoires + livraison. Inconnu si l'un des deux frais est inconnu. */
export function offerTotal(o: Pick<OfferLite, "price" | "mandatory_fees" | "shipping"> & { capacity_status?: string }): number | null {
  // Un prix « à partir de » n'est le coût d'aucune variante précise : jamais un coût total confirmé.
  if (o.capacity_status === "prix_de_depart") return null;
  if (o.mandatory_fees === null || o.shipping === null) return null;
  return Math.round((o.price + o.mandatory_fees + o.shipping) * 100) / 100;
}

/** Offre active : disponible, en stock (ou stock non publié mais en vente), récente, réelle, variante cohérente. */
export function isFresh(o: Pick<OfferLite, "available" | "checked_at"> & Partial<OfferLite>, today: Date): boolean {
  if (!o.available || o.stock === "rupture" || o.is_demo || o.variant_check === "ecart") return false;
  const age = (today.getTime() - new Date(o.checked_at).getTime()) / 864e5;
  return age >= -1 && age <= OFFER_MAX_AGE_DAYS;
}

/** « Disponible dans ton budget » : offre réelle, disponible, récente, coût total connu ≤ budget. */
export function availableWithinBudget(o: OfferLite, budget: number, today: Date): boolean {
  const t = offerTotal(o);
  return isFresh(o, today) && t !== null && t <= budget;
}

// ───────────── Contraintes ─────────────

type Constraint = "budget" | "etat" | "systeme" | "stockage" | "esim" | "marques";

export function admissibleEntries(answers: Answers, models: CandidateModel[], today: Date, ignore: Constraint[] = []): Entry[] {
  const skip = new Set(ignore);
  const out: Entry[] = [];
  for (const model of models) {
    if (!skip.has("systeme") && answers.os !== "any" && model.os !== answers.os) continue;
    if (!skip.has("esim") && answers.esim && model.specs.esim !== true) continue;
    if (!skip.has("marques")) {
      if (answers.includeBrands?.length && !answers.includeBrands.includes(model.brand_id)) continue;
      if (answers.excludeBrands?.includes(model.brand_id)) continue;
    }
    for (const config of model.configs) {
      if (!skip.has("stockage") && answers.minStorage && config.storage_gb < answers.minStorage) continue;
      for (const offer of config.offers) {
        if (!isFresh(offer, today)) continue;
        if (!skip.has("etat") && !answers.conditions.includes(offer.condition)) continue;
        const total = offerTotal(offer);
        if (total === null) continue;
        if (!skip.has("budget") && total > answers.budget) continue;
        out.push({ model, config, offer, total });
      }
    }
  }
  return out;
}

// ───────────── Métriques ─────────────

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function rawMetric(p: Priority, e: Entry, answers: Answers, today: Date): number | null {
  const s = e.model.specs;
  switch (p) {
    case "photo": {
      const zoom = num(s.optical_zoom);
      const ois = s.ois;
      const cams = typeof s.cameras === "string" ? s.cameras : null;
      if (zoom === null && ois === undefined && cams === null) return null;
      const zoomScore = zoom === null ? 0 : zoom >= 5 ? 1 : zoom >= 3 ? 0.8 : zoom >= 2 ? 0.5 : 0;
      return zoomScore * 0.4 + (ois === true ? 0.25 : 0) + (cams && /ultra grand-angle/i.test(cams) ? 0.15 : 0) + ((num(s.chip_tier) ?? 0) / 5) * 0.2;
    }
    case "autonomie": {
      const measured = num(e.model.measured.autonomy_h);
      if (measured !== null) return 1000 + measured; // une mesure passe toujours devant une estimation
      const mah = num(s.battery_mah);
      const inch = num(s.screen_in);
      if (mah === null || inch === null) return null;
      return mah / (inch * inch);
    }
    case "jeux": {
      // Indice 0–100 si connu (plus fin), sinon niveau 1–5.
      const sc = num(s.chip_score);
      const tier = sc !== null ? sc / 20 : num(s.chip_tier);
      if (tier === null) return null;
      const hz = num(s.refresh_hz) ?? 60;
      const ram = e.config.ram_gb ?? num(s.ram_gb) ?? 0;
      return (tier / 5) * 0.75 + (hz >= 120 ? 0.15 : hz >= 90 ? 0.07 : 0) + (ram >= 12 ? 0.1 : ram >= 8 ? 0.06 : 0);
    }
    case "une_main": {
      const w = num(s.width_mm);
      const g = num(s.weight_g);
      if (w === null || g === null) return null;
      return clamp01((80 - w) / 12) * 0.6 + clamp01((240 - g) / 80) * 0.4;
    }
    case "longevite": {
      const d = securityDeadline(e.model.support, today);
      if (d.monthsLeft === null) return null;
      if (answers.keepYears) {
        const need = answers.keepYears * 12;
        return d.monthsLeft >= need ? 1 + d.monthsLeft / 1000 : (d.monthsLeft / need) * 0.8;
      }
      return d.monthsLeft;
    }
    case "prix":
      return -e.total;
  }
}

function normalizeAll(values: (number | null)[]): (number | null)[] {
  const known = values.filter((v): v is number => v !== null);
  if (!known.length) return values.map(() => null);
  const min = Math.min(...known);
  const max = Math.max(...known);
  return values.map((v) => (v === null ? null : max === min ? 1 : (v - min) / (max - min)));
}

// ───────────── Classement ─────────────

/**
 * Adéquation au profil (0 à 1) : taille d'écran, intensité d'usage, durée de conservation. Sert de critère
 * complémentaire aux priorités ; une donnée inconnue compte pour 0,5 (ni bonus ni pénalité).
 */
export function profileFit(e: Entry, answers: Answers, today: Date): { fit: number; parts: Partial<Record<"taille" | "usage" | "duree", number>> } {
  const s = e.model.specs;
  const parts: Partial<Record<"taille" | "usage" | "duree", number>> = {};
  const inch = num(s.screen_in);
  if (answers.size) {
    if (inch === null || e.model.form_factor === "pliable") parts.taille = 0.5;
    else if (answers.size === "compact") parts.taille = clamp01(1 - Math.max(0, inch - 6.3) / 0.5);
    else if (answers.size === "grand") parts.taille = clamp01(1 - Math.max(0, 6.7 - inch) / 0.5);
    else parts.taille = clamp01(1 - (inch < 6.3 ? 6.3 - inch : inch > 6.69 ? inch - 6.69 : 0) / 0.4);
  }
  if (answers.usage === "intensif") {
    const sc = num(s.chip_score) ?? (num(s.chip_tier) !== null ? num(s.chip_tier)! * 20 : null);
    const mah = num(s.battery_mah);
    const a = sc === null ? 0.5 : sc / 100;
    const b = mah === null ? 0.5 : clamp01((mah - 4000) / 3000);
    parts.usage = (a + b) / 2;
  } else if (answers.usage === "leger") {
    parts.usage = clamp01(1 - e.total / answers.budget);
  }
  if (answers.keepYears && !answers.priorities.includes("longevite")) {
    const d = securityDeadline(e.model.support, today);
    // Échéance connue : part couverte. Durée seule annoncée (sans date de départ) couvrant la durée souhaitée :
    // crédit modéré (0,75), jamais celui d'une échéance confirmée. Rien de publié : neutre (0,5).
    parts.duree = d.monthsLeft !== null ? clamp01(d.monthsLeft / (answers.keepYears * 12))
      : d.announcedYears && d.announcedYears >= answers.keepYears ? 0.75 : 0.5;
  }
  const vals = Object.values(parts);
  return { fit: vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0.5, parts };
}

/** Part du budget exploitée, ramenée entre 0 (≤ 45 % du budget) et 1 (≥ 95 %). */
export function budgetUse(total: number, budget: number): number {
  return clamp01((total / budget - 0.45) / 0.5);
}

/** Contributions au score, pour expliquer ce qui départage deux modèles. */
export interface ScoreParts {
  /** Priorités choisies (pondérées). */
  priorities: number;
  /** Bonus « exploite bien le budget ». */
  budget: number;
  /** Taille, intensité d'usage, durée de conservation. */
  profile: number;
}

export function rank(answers: Answers, entries: Entry[], today: Date) {
  const prios = answers.priorities.slice(0, 2);
  const weights = prios.length === 2 ? [0.65, 0.35] : [1];
  const raws = prios.map((p) => entries.map((e) => rawMetric(p, e, answers, today)));
  const norms = raws.map(normalizeAll);
  const minByModel = new Map<string, number>();
  for (const e of entries) minByModel.set(e.model.id, Math.min(minByModel.get(e.model.id) ?? Infinity, e.total));
  let scored = entries.map((e, i) => {
    const n: Partial<Record<Priority, number | null>> = {};
    const parts: ScoreParts = { priorities: 0, budget: 0, profile: 0 };
    let score = 0;
    prios.forEach((p, k) => {
      n[p] = norms[k][i];
      score += weights[k] * (norms[k][i] ?? 0);
    });
    parts.priorities = score;
    // Budget : sauf si la priorité est le prix, un budget plus élevé signale une attente de gamme supérieure.
    // Un modèle qui exploite bien le budget (≥ 85 %) passe devant un modèle bien moins cher et un peu meilleur
    // sur un seul critère. Un modèle à moins de 45 % du budget ne reçoit pas ce bonus.
    // Calculé sur le prix le plus bas du modèle : le bonus ne pousse jamais une capacité plus chère du même téléphone.
    if (prios[0] !== "prix") score += parts.budget = 0.45 * budgetUse(minByModel.get(e.model.id) ?? e.total, answers.budget);
    // Profil (taille, intensité d'usage, durée) : critère complémentaire, moins fort que les priorités.
    if (answers.size || answers.usage || answers.keepYears) score += parts.profile = 0.35 * profileFit(e, answers, today).fit;
    // Départage léger : à valeur égale, la moins chère passe devant.
    score += 0.02 * (1 - e.total / answers.budget);
    return { e, score, norms: n, parts };
  });

  if (prios[0] === "prix") {
    // Le plafond n'est pas un montant à dépenser : l'offre la moins chère qui satisfait le besoin secondaire.
    const second = prios[1];
    let pool = scored;
    if (second) {
      const ok = scored.filter((x) => (x.norms[second] ?? 0) >= 0.5);
      if (ok.length) pool = ok;
    }
    scored = [...pool].sort((a, b) => a.e.total - b.e.total || b.score - a.score);
  } else {
    scored.sort((a, b) => b.score - a.score || a.e.total - b.e.total);
  }

  // Une seule ligne par modèle : sa meilleure offre (déjà en tête après le tri).
  const seen = new Set<string>();
  return scored.filter((x) => (seen.has(x.e.model.id) ? false : (seen.add(x.e.model.id), true)));
}

// ───────────── Explications ─────────────

const euros = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;
const storageLabel = (gb: number) => (gb === 0 ? "capacité selon l'offre" : gb >= 1024 ? `${gb / 1024} To` : `${gb} Go`);

function photoFeatures(s: Record<string, unknown>): string[] {
  const f: string[] = [];
  const z = num(s.optical_zoom);
  if (z && z > 1) f.push(`un téléobjectif ${z}x`);
  if (s.ois === true) f.push("une stabilisation optique");
  if (typeof s.cameras === "string" && /ultra grand-angle/i.test(s.cameras)) f.push("un ultra grand-angle");
  return f;
}

function joinFr(parts: string[]) {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

export function decisiveSentence(p: Priority, e: Entry, answers: Answers, today: Date): string {
  const s = e.model.specs;
  switch (p) {
    case "photo": {
      const f = photoFeatures(s);
      return f.length
        ? `Pour tes photos et vidéos, il réunit ${joinFr(f)}. Ce sont des caractéristiques annoncées par le fabricant, pas un test indépendant.`
        : "Les caractéristiques photo de ce modèle ne sont pas renseignées : ce point n'a pas pu être comparé.";
    }
    case "autonomie": {
      const m = num(e.model.measured.autonomy_h);
      if (m !== null) return `Il obtient ${m} h d'autonomie lors d'un test indépendant, le meilleur résultat mesuré des modèles admissibles.`;
      const mah = num(s.battery_mah);
      const inch = num(s.screen_in);
      if (mah !== null && inch !== null)
        return `Sa batterie de ${mah} mAh pour un écran de ${String(inch).replace(".", ",")}″ est parmi les plus généreuses des modèles admissibles. Aucune mesure d'autonomie indépendante comparable n'est disponible : c'est une indication, pas une garantie.`;
      return "La capacité de sa batterie n'est pas publiée par le fabricant : son autonomie n'a pas pu être comparée.";
    }
    case "jeux": {
      const chip = typeof s.chip === "string" ? s.chip : null;
      const hz = num(s.refresh_hz);
      return chip
        ? `Pour les jeux exigeants, sa puce ${chip} est parmi les plus puissantes des modèles admissibles${hz && hz >= 120 ? `, avec un écran ${hz} Hz` : ""}.`
        : "La puce de ce modèle n'est pas renseignée : ses performances en jeu n'ont pas pu être comparées.";
    }
    case "une_main": {
      const w = num(s.width_mm);
      const g = num(s.weight_g);
      return w !== null && g !== null
        ? `Avec ${String(w).replace(".", ",")} mm de large et ${String(g).replace(".", ",")} g, c'est l'un des plus faciles à tenir à une main parmi les modèles admissibles.`
        : "Ses dimensions ne sont pas renseignées : la prise en main n'a pas pu être comparée.";
    }
    case "longevite": {
      const d = securityDeadline(e.model.support, today);
      if (answers.keepYears) return keepYearsVerdict(answers.keepYears, d).text;
      if (d.state === "inconnue") return "Aucune date de fin des correctifs de sécurité n'est publiée pour ce modèle.";
      if (d.state !== "en_cours" && d.state !== "dernier_jour") return "Sa période garantie de correctifs de sécurité est terminée.";
      return `Ses correctifs de sécurité sont annoncés ${d.precision === "mois" ? "jusqu'en" : "jusqu'au"} ${d.dateLabel}, soit encore ${d.remainingLabel} : le suivi le plus long des modèles admissibles.`;
    }
    case "prix":
      return `C'est l'offre admissible la moins chère qui répond à tes critères.`;
  }
}

function priceSentence(e: Entry, budget: number): string {
  const margin = Math.round((budget - e.total) * 100) / 100;
  const cond = e.offer.condition === "neuf" ? "Neuf" : e.offer.condition === "reconditionne" ? "Reconditionné" : "D'occasion";
  return `${cond} chez ${e.offer.seller}, en ${storageLabel(e.config.storage_gb)}, à ${euros(e.total)} tout compris : ${
    margin === 0 ? "pile à ton plafond." : `il te reste ${euros(margin)} sous ton plafond.`
  }`;
}

function compromiseSentence(e: Entry, norms: Partial<Record<Priority, number | null>>, answers: Answers, today: Date): string | null {
  const second = answers.priorities[1];
  if (second && norms[second] === null) return `Compromis : le critère « ${PRIORITY_LABELS[second]} » n'a pas pu être évalué faute de donnée publiée.`;
  if (second && (norms[second] ?? 1) < 0.5) return `Compromis : il est moins bien placé que d'autres pour ${PRIORITY_LABELS[second]}.`;
  const d = securityDeadline(e.model.support, today);
  if (d.state === "inconnue" && !answers.priorities.includes("longevite"))
    return "Compromis : le fabricant ne publie pas de date de fin des correctifs de sécurité.";
  const g = num(e.model.specs.weight_g);
  if (g !== null && g >= 215 && !answers.priorities.includes("une_main")) return `Compromis : avec ${g} g, il est plutôt lourd.`;
  return null;
}

export function explain(e: Entry, norms: Partial<Record<Priority, number | null>>, answers: Answers, today: Date): string[] {
  const out = [decisiveSentence(answers.priorities[0], e, answers, today), priceSentence(e, answers.budget)];
  const c = compromiseSentence(e, norms, answers, today);
  if (c) out.push(c);
  return out;
}

/** Ce que la différence de prix apporte entre deux offres du même modèle. */
export function compareOffers(a: Entry, b: Entry): string | null {
  if (a.model.id !== b.model.id) return null;
  const diff = Math.round((b.total - a.total) * 100) / 100;
  if (diff === 0) return null;
  const [cheap, dear] = diff > 0 ? [a, b] : [b, a];
  const gains: string[] = [];
  if (dear.config.storage_gb > cheap.config.storage_gb) gains.push(`${storageLabel(dear.config.storage_gb)} de stockage au lieu de ${storageLabel(cheap.config.storage_gb)}`);
  if (dear.offer.condition === "neuf" && cheap.offer.condition !== "neuf") gains.push("un appareil neuf avec la garantie constructeur");
  if (dear.offer.battery_note && !cheap.offer.battery_note) gains.push(`une batterie documentée (${dear.offer.battery_note})`);
  if (dear.offer.warranty && !cheap.offer.warranty) gains.push(`une garantie annoncée (${dear.offer.warranty})`);
  const what = gains.length ? joinFr(gains) : "aucun avantage documenté";
  return `Pour ${euros(Math.abs(diff))} de plus, l'offre ${dear.offer.condition === "neuf" ? "neuve" : "reconditionnée"} chez ${dear.offer.seller} apporte ${what}. Le suivi logiciel est identique : il dépend du modèle, pas de l'état d'achat.`;
}

function advantagesOver(alt: Entry, first: Entry, altNorms: Partial<Record<Priority, number | null>>, firstNorms: Partial<Record<Priority, number | null>>, answers: Answers, today: Date): string[] {
  const out: string[] = [];
  const diff = first.total - alt.total;
  if (diff >= 30) out.push(`${euros(Math.round(diff))} de moins`);
  const da = securityDeadline(alt.model.support, today);
  const df = securityDeadline(first.model.support, today);
  if (da.monthsLeft !== null && (df.monthsLeft === null || da.monthsLeft - df.monthsLeft >= 12))
    out.push(df.monthsLeft === null ? "date de fin des correctifs publiée" : `${da.monthsLeft - df.monthsLeft} mois de correctifs en plus`);
  if (alt.config.storage_gb > first.config.storage_gb) out.push(`${storageLabel(alt.config.storage_gb)} de stockage`);
  for (const p of answers.priorities) {
    if (p === "prix" || p === "longevite") continue;
    const a = altNorms[p];
    const f = firstNorms[p];
    if (a !== null && a !== undefined && (f === null || f === undefined || a - f > 0.15)) out.push(`mieux placé pour ${PRIORITY_LABELS[p]}`);
  }
  return out;
}

// ───────────── Offres à vérifier (frais inconnus) ─────────────

export function shownPrice(o: Pick<OfferLite, "price" | "mandatory_fees">): number {
  return Math.round((o.price + (o.mandatory_fees ?? 0)) * 100) / 100;
}

/** Comme admissibleEntries, mais sans exiger un coût total connu (le budget s'applique au coût total s'il est connu). */
function admissibleEntriesRaw(answers: Answers, models: CandidateModel[], today: Date, ignore: Constraint[]): Entry[] {
  const skip = new Set(ignore);
  const out: Entry[] = [];
  for (const model of models) {
    if (!skip.has("systeme") && answers.os !== "any" && model.os !== answers.os) continue;
    if (!skip.has("esim") && answers.esim && model.specs.esim !== true) continue;
    if (!skip.has("marques")) {
      if (answers.includeBrands?.length && !answers.includeBrands.includes(model.brand_id)) continue;
      if (answers.excludeBrands?.includes(model.brand_id)) continue;
    }
    for (const config of model.configs) {
      if (!skip.has("stockage") && answers.minStorage && config.storage_gb < answers.minStorage) continue;
      for (const offer of config.offers) {
        if (!isFresh(offer, today)) continue;
        if (!skip.has("etat") && !answers.conditions.includes(offer.condition)) continue;
        const total = offerTotal(offer);
        if (total !== null && !skip.has("budget") && total > answers.budget) continue;
        out.push({ model, config, offer, total: total ?? shownPrice(offer) });
      }
    }
  }
  return out;
}

/**
 * Offres actives qui respectent tous les critères et dont le PRIX AFFICHÉ (+ frais obligatoires connus)
 * respecte le plafond, mais dont le coût total est inconnu (livraison non publiée).
 */
export function verifyEntries(answers: Answers, models: CandidateModel[], today: Date, ignore: Constraint[] = []): Entry[] {
  return admissibleEntriesRaw(answers, models, today, ignore).filter(
    (e) => offerTotal(e.offer) === null && (ignore.includes("budget") || shownPrice(e.offer) <= answers.budget),
  );
}

/** Toute offre exploitable (confirmée ou à vérifier) pour ces critères. */
function anyEntries(answers: Answers, models: CandidateModel[], today: Date, ignore: Constraint[]): Entry[] {
  return [...admissibleEntries(answers, models, today, ignore), ...verifyEntries(answers, models, today, ignore)];
}

const COND_ADJ: Record<Condition, string> = { neuf: "neuf", reconditionne: "reconditionné", occasion: "d'occasion" };
const dec = (v: unknown) => String(v).replace(".", ",");

/** Une phrase : pourquoi ce modèle ressort pour les réponses données (mêmes métriques que le classement). */
export function whyOneLiner(e: Entry, answers: Answers, rankIndex: number, today: Date): string {
  const s = e.model.specs;
  const price = euros(shownPrice(e.offer));
  const fallback = `Ses données pour ce critère ne sont pas encore renseignées : il ressort ici surtout pour son prix (${price}).`;
  switch (answers.priorities[0]) {
    case "prix":
      return rankIndex === 0
        ? `C'est le prix le plus bas parmi les offres qui respectent tes critères : ${price}.`
        : `Il fait partie des prix les plus bas pour tes critères (${price}).`;
    case "une_main":
      return num(s.width_mm) !== null && num(s.weight_g) !== null
        ? `Il ressort pour l'usage à une main : ${dec(s.width_mm)} mm de large et ${dec(s.weight_g)} g (données annoncées).`
        : fallback;
    case "autonomie":
      return num(s.battery_mah) !== null ? `Il ressort pour l'autonomie avec une batterie annoncée de ${s.battery_mah} mAh (pas de mesure indépendante).` : fallback;
    case "jeux":
      return typeof s.chip === "string" ? `Il ressort pour les jeux grâce à sa puce ${s.chip}.` : fallback;
    case "photo": {
      const z = num(s.optical_zoom);
      const f = [z && z > 1 ? `un téléobjectif ${z}x` : null, s.ois === true ? "une stabilisation optique" : null].filter(Boolean);
      return f.length ? `Il ressort pour la photo avec ${f.join(" et ")} (caractéristiques annoncées).` : fallback;
    }
    case "longevite": {
      const d = securityDeadline(e.model.support, today);
      return d.state === "en_cours"
        ? `Il ressort pour la durée de suivi : correctifs annoncés ${d.precision === "mois" ? "jusqu'en" : "jusqu'au"} ${d.dateLabel}.`
        : `Aucune échéance de correctifs n'est confirmée pour ce modèle : il ressort ici surtout pour son prix (${price}).`;
    }
  }
}

function toVerifyCards(answers: Answers, models: CandidateModel[], today: Date): VerifyCard[] {
  // Une carte par offre ; les doublons de coloris (même modèle, capacité, état, vendeur) gardent le prix le plus bas.
  const best = new Map<string, Entry>();
  for (const e of verifyEntries(answers, models, today)) {
    const k = `${e.model.id}|${e.config.id}|${e.offer.condition}|${e.offer.seller}`;
    const prev = best.get(k);
    if (!prev || shownPrice(e.offer) < shownPrice(prev.offer)) best.set(k, e);
  }
  const list = [...best.values()];
  if (answers.priorities[0] === "prix") list.sort((a, b) => shownPrice(a.offer) - shownPrice(b.offer));
  else {
    const order = rank(answers, list, today);
    const pos = new Map(order.map((x, i) => [x.e.model.id, i]));
    list.sort((a, b) => (pos.get(a.model.id) ?? 99) - (pos.get(b.model.id) ?? 99) || shownPrice(a.offer) - shownPrice(b.offer));
  }
  return list.map((e, i) => ({
    model: e.model, config: e.config, offer: e.offer, shownPrice: shownPrice(e.offer),
    headroom: Math.round((answers.budget - shownPrice(e.offer)) * 100) / 100,
    toCheck: [
      ...(e.offer.shipping === null || e.offer.mandatory_fees === null ? (["livraison"] as const) : []),
      ...(e.offer.capacity_status === "prix_de_depart" ? (["capacite"] as const) : []),
    ],
    why: whyOneLiner(e, answers, i, today),
  }));
}

/** Comptage des offres éliminées, par raison (première raison rencontrée). */
export function offerFunnel(answers: Answers, models: CandidateModel[], today: Date): Funnel {
  const f: Funnel = { total: 0, indisponible: 0, perime: 0, demo: 0, variante: 0, systeme: 0, etat: 0, stockage: 0, esim: 0, marques: 0, hors_budget: 0, a_verifier: 0, confirmee: 0 };
  for (const m of models)
    for (const c of m.configs)
      for (const o of c.offers) {
        f.total++;
        if (o.is_demo) { f.demo++; continue; }
        if (!o.available || o.stock === "rupture") { f.indisponible++; continue; }
        if (o.variant_check === "ecart") { f.variante++; continue; }
        if (!isFresh(o, today)) { f.perime++; continue; }
        if (answers.os !== "any" && m.os !== answers.os) { f.systeme++; continue; }
        if (!answers.conditions.includes(o.condition)) { f.etat++; continue; }
        if (answers.minStorage && c.storage_gb < answers.minStorage) { f.stockage++; continue; }
        if (answers.esim && m.specs.esim !== true) { f.esim++; continue; }
        if ((answers.includeBrands?.length && !answers.includeBrands.includes(m.brand_id)) || answers.excludeBrands?.includes(m.brand_id)) { f.marques++; continue; }
        const t = offerTotal(o);
        if (t !== null) {
          if (t <= answers.budget) f.confirmee++;
          else f.hors_budget++;
        } else if (shownPrice(o) <= answers.budget) f.a_verifier++;
        else f.hors_budget++;
      }
  return f;
}

// ───────────── Point d'entrée ─────────────

export interface Choice {
  model: CandidateModel;
  config: ConfigLite;
  offer: OfferLite;
  /** Coût total si connu (frais inclus), sinon null : frais à vérifier. */
  total: number | null;
  shown: number;
  why: string;
  /** Choix ajouté pour proposer les deux systèmes quand la personne hésite (« les deux me vont »). */
  diversity?: "ios" | "android";
  /** L'offre est dans un état non coché (reconditionné ou occasion), proposée pour avoir un iPhone ou un Android. */
  otherCondition?: boolean;
  /** Détail du score de classement (mêmes critères que le tri). */
  parts?: ScoreParts;
  norms?: Partial<Record<Priority, number | null>>;
}

/**
 * Les 3 téléphones proposés : trois modèles différents, classés selon les priorités et le profil, parmi les offres
 * confirmées (frais inclus) et celles dont le prix affiché respecte le budget (frais à vérifier).
 */
export function topChoices(answers: Answers, models: CandidateModel[], today: Date, count = 3): Choice[] {
  const entries = [...admissibleEntries(answers, models, today), ...verifyEntries(answers, models, today)];
  if (!entries.length) return [];
  // Une offre confirmée passe devant une offre à vérifier du même modèle.
  const confirmedFirst = (list: Entry[]) => [...list].sort((a, b) => Number(offerTotal(a.offer) === null) - Number(offerTotal(b.offer) === null));
  const ranked = rank(answers, confirmedFirst(entries), today);
  const pick = (x: (typeof ranked)[number], i: number, extra: Partial<Choice> = {}): Choice => ({
    model: x.e.model, config: x.e.config, offer: x.e.offer,
    total: offerTotal(x.e.offer), shown: shownPrice(x.e.offer),
    why: whyOneLiner(x.e, answers, i, today), parts: x.parts, norms: x.norms, ...extra,
  });
  const out = ranked.slice(0, count).map((x, i) => pick(x, i));

  // « Les deux me vont » : au moins un iPhone et au moins un Android parmi les choix, si c'est possible dans le
  // budget. On cherche d'abord dans les états choisis, puis en reconditionné et en occasion.
  if (answers.os === "any" && count >= 2) {
    for (const sys of ["ios", "android"] as const) {
      if (out.some((c) => c.model.os === sys)) continue;
      let alt = ranked.find((x) => x.e.model.os === sys);
      let other = false;
      if (!alt) {
        const wide: Answers = { ...answers, conditions: ["neuf", "reconditionne", "occasion"] };
        const more = [...admissibleEntries(wide, models, today), ...verifyEntries(wide, models, today)].filter((e) => e.model.os === sys);
        alt = rank(wide, confirmedFirst(more), today)[0];
        other = !!alt && !answers.conditions.includes(alt.e.offer.condition);
      }
      if (!alt) continue;
      // Remplace le dernier choix de l'autre système (on garde le n°1 tel quel).
      const replaceAt = out.length < count ? out.length : [...out.keys()].reverse().find((i) => i > 0 && out.filter((c) => c.model.os === out[i].model.os).length > 1) ?? out.length - 1;
      out[replaceAt] = pick(alt, replaceAt, { diversity: sys, otherCondition: other });
    }
  }
  return out;
}

export function recommend(answers: Answers, models: CandidateModel[], today: Date): Result {
  const funnel = offerFunnel(answers, models, today);
  const entries = admissibleEntries(answers, models, today);
  const toVerify = toVerifyCards(answers, models, today);
  if (!entries.length) {
    if (toVerify.length) return { status: "ok", picks: [], toVerify, admissibleModels: new Set(toVerify.map((v) => v.model.id)).size, funnel };
    const active = funnel.total - funnel.indisponible - funnel.perime - funnel.demo - funnel.variante;
    return { status: "aucun", reason: active === 0 ? "donnees" : "criteres", blockers: active === 0 ? [] : diagnose(answers, models, today), toVerify: [], funnel };
  }

  const ranked = rank(answers, entries, today);
  const [top, ...rest] = ranked;
  const mk = (x: (typeof ranked)[number], advantages: string[], i: number): Recommendation => ({
    ...x.e,
    margin: Math.round((answers.budget - x.e.total) * 100) / 100,
    score: x.score,
    norms: x.norms,
    security: securityDeadline(x.e.model.support, today),
    explanation: explain(x.e, x.norms, answers, today),
    why: whyOneLiner(x.e, answers, i, today),
    advantages,
    offerComparison: null,
  });

  const first = mk(top, [], 0);
  // Autre offre admissible du même modèle (autre capacité ou autre état) : expliquer l'écart de prix.
  const sibling = entries
    .filter((e) => e.model.id === top.e.model.id && e.offer.id !== top.e.offer.id)
    .sort((a, b) => Math.abs(a.total - top.e.total) - Math.abs(b.total - top.e.total))[0];
  if (sibling) first.offerComparison = compareOffers(top.e, sibling);

  const alternatives: Recommendation[] = [];
  for (const x of rest) {
    if (alternatives.length >= 2) break;
    const adv = advantagesOver(x.e, top.e, x.norms, top.norms, answers, today);
    if (adv.length) alternatives.push(mk(x, adv, alternatives.length + 1));
  }
  const distinct = new Set([...ranked.map((x) => x.e.model.id), ...toVerify.map((v) => v.model.id)]);
  return { status: "ok", picks: [first, ...alternatives], toVerify, admissibleModels: distinct.size, funnel };
}

export function diagnose(answers: Answers, models: CandidateModel[], today: Date): Blocker[] {
  const blockers: Blocker[] = [];
  // Critères d'abord : ce sont des choix que la personne peut assouplir.
  if (answers.minStorage) {
    const r = anyEntries(answers, models, today, ["stockage"]).filter((e) => e.config.storage_gb > 0);
    if (r.length) {
      const best = Math.max(...r.map((e) => e.config.storage_gb));
      blockers.push({
        criterion: "stockage",
        message: `Des offres respectent ton plafond en ${storageLabel(best)}${best > 128 ? " ou moins" : ""}, mais aucune en ${storageLabel(answers.minStorage)} ou plus.`,
        suggestion: { label: `Passer à ${storageLabel(best)} minimum`, patch: { minStorage: best } },
      });
    }
  }
  if (answers.os !== "any" && anyEntries(answers, models, today, ["systeme"]).length) {
    blockers.push({
      criterion: "systeme",
      message: `Aucune offre ${answers.os === "ios" ? "iPhone" : "Android"} ne respecte ton plafond, mais il en existe sur l'autre système.`,
      suggestion: { label: "Accepter iPhone et Android", patch: { os: "any" } },
    });
  }
  if (answers.conditions.length < 3 && anyEntries(answers, models, today, ["etat"]).length) {
    const others = (["neuf", "reconditionne"] as Condition[]).filter((c) => !answers.conditions.includes(c));
    blockers.push({
      criterion: "etat",
      message:
        answers.conditions.length === 1 && answers.conditions[0] === "occasion"
          ? "Entre particuliers, on ne peut afficher qu'une cote estimée, jamais une offre vérifiée : aucune ne peut être annoncée « dans ton budget »."
          : `Aucune offre dans l'état choisi, mais il en existe en ${others.map((c) => COND_ADJ[c]).join(" ou ")}.`,
      suggestion: { label: "Comparer les états", patch: { conditions: ["neuf", "reconditionne", "occasion"] } },
    });
  }
  if (answers.esim && anyEntries(answers, models, today, ["esim"]).length) {
    blockers.push({
      criterion: "esim",
      message: "Des offres existent, mais la compatibilité eSIM n'est pas confirmée pour ces modèles (une donnée inconnue ne valide pas une exigence).",
      suggestion: { label: "Retirer l'exigence eSIM", patch: { esim: false } },
    });
  }
  if ((answers.includeBrands?.length || answers.excludeBrands?.length) && anyEntries(answers, models, today, ["marques"]).length) {
    blockers.push({
      criterion: "marques",
      message: "Des offres existent sous ton plafond, mais pas pour les marques choisies.",
      suggestion: { label: "Retirer le filtre de marques", patch: { includeBrands: [], excludeBrands: [] } },
    });
  }
  // Budget en dernier : jamais relevé automatiquement, seulement une information.
  const noBudget = anyEntries(answers, models, today, ["budget"]);
  if (noBudget.length) {
    const cheapest = noBudget.reduce((a, b) => (a.total <= b.total ? a : b));
    const known = offerTotal(cheapest.offer) !== null;
    blockers.push({
      criterion: "budget",
      message: `L'offre la moins chère qui respecte tes autres critères coûte ${euros(cheapest.total)}${known ? "" : " hors frais"} (${cheapest.model.name}${cheapest.config.storage_gb ? `, ${storageLabel(cheapest.config.storage_gb)}` : ""}, ${COND_ADJ[cheapest.offer.condition]}), au-dessus de ton plafond de ${euros(answers.budget)}.`,
      suggestion: { label: "Modifier mon budget", patch: {} },
    });
  }
  return blockers;
}
