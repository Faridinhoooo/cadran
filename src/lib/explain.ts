// Explications comparatives des 3 choix : pourquoi le N°1 passe devant, et pourquoi préférer chaque alternative.
//
// Règles :
//  - on s'appuie sur les critères réellement utilisés par le classement (engine.rank) et sur des données publiées ;
//  - un avantage partagé par tous les choix est dit une seule fois (`shared`), puis on explique ce qui les départage ;
//  - jamais de qualité photo déduite des mégapixels, jamais d'autonomie déduite des seuls mAh ;
//  - quand les données ne permettent pas de trancher, on le dit en une phrase.

import type { Answers, Choice, Priority } from "./engine";
import { keepYearsVerdict, securityDeadline, type Deadline } from "./support";

export interface ChoiceExplanation {
  /** Phrase affichée juste après le modèle et le prix : répond à la priorité du visiteur. */
  lead: string;
  /** Ce qui le départage du N°1 (pour le N°1 : du N°2), avec ce que coûte ou rapporte l'écart de prix. */
  versus: string | null;
  /** Limite des données, en une phrase. */
  limit: string | null;
  /** Compromis principal, s'il est documenté. */
  tradeoff: string | null;
}

export interface ChoicesExplanation {
  /** Avantage commun à tous les choix, dit une seule fois au-dessus des cartes. */
  shared: string | null;
  items: ChoiceExplanation[];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dec = (v: number) => String(v).replace(".", ",");
const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;
const storage = (gb: number) => (gb >= 1024 ? `${gb / 1024} To` : `${gb} Go`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** « le POCO X8 Pro », « l'iPhone 16e » */
export const le = (name: string) => (/^[aeiouyéèh]/i.test(name) ? `l'${name}` : `le ${name}`);

function joinFr(parts: string[]) {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

/** Fabricant qui publie l'engagement (REDMI et POCO sont des marques de Xiaomi). */
const maker = (c: Choice) => (c.model.brand_id === "redmi" || c.model.brand_id === "poco" ? "Xiaomi" : c.model.brand_name);

const amount = (c: Choice) => c.total ?? c.shown;
/** « frais inclus » seulement si les deux coûts totaux sont connus. */
const basis = (a: Choice, b: Choice) => (a.total !== null && b.total !== null ? "frais inclus" : "avant livraison");

// ───────── Photo : équipement annoncé (mêmes éléments que le score photo) ─────────

interface Feature { key: string; label: string }

export function photoFeatures(specs: Record<string, unknown>): Feature[] {
  const f: Feature[] = [];
  const z = num(specs.optical_zoom);
  if (z && z > 1) f.push({ key: `tele${z}`, label: `un téléobjectif ${dec(z)}x` });
  if (specs.ois === true) f.push({ key: "ois", label: "une stabilisation optique" });
  if (typeof specs.cameras === "string" && /ultra grand-angle/i.test(specs.cameras)) f.push({ key: "uw", label: "un ultra grand-angle" });
  if (video4k60(specs)) f.push({ key: "v60", label: "la vidéo 4K à 60 images par seconde" });
  return f;
}
/** Vidéo 4K à 60 i/s annoncée (même donnée que le score photo du moteur). */
export function video4k60(specs: Record<string, unknown>): boolean {
  return typeof specs.video === "string" && /4K[^;]*\b60\s*(fps|ips|i\/s|images)/i.test(specs.video);
}
const de = (label: string) => label.replace(/^une /, "d'une ").replace(/^un /, "d'un ").replace(/^la /, "de la ");
const hasKey = (list: Feature[], k: string) => list.some((f) => f.key === k);
const minus = (a: Feature[], b: Feature[]) => a.filter((f) => !hasKey(b, f.key));


const tier = (c: Choice) => num(c.model.specs.chip_tier);
const chipName = (c: Choice) => (typeof c.model.specs.chip === "string" ? c.model.specs.chip : "sa puce");

// ───────── Suivi de sécurité ─────────

const sec = (c: Choice, today: Date) => securityDeadline(c.model.support, today);

/** Formulation du suivi restant : échéance connue, durée seule annoncée, ou rien de publié. */
export function securityPhrase(d: Deadline, brand: string): string {
  if (d.state === "en_cours" || d.state === "dernier_jour")
    return `correctifs de sécurité annoncés ${d.precision === "mois" ? "jusqu'en" : "jusqu'au"} ${d.dateLabel} (encore ${d.remainingLabel})`;
  if (d.state === "inconnue" && d.announcedYears)
    return `${dec(d.announcedYears)} ans de correctifs de sécurité annoncés par ${brand}, sans date de départ publiée : temps restant à vérifier`;
  if (d.state === "inconnue") return "aucune durée de correctifs de sécurité publiée";
  return "période de correctifs de sécurité terminée";
}

/** Avantage de suivi de `a` sur `b`, si les données le démontrent. */
function securityEdge(a: Choice, b: Choice, today: Date): string | null {
  const da = sec(a, today);
  const db = sec(b, today);
  if (da.monthsLeft !== null && db.monthsLeft !== null) {
    const diff = da.monthsLeft - db.monthsLeft;
    return diff >= 12 ? `${diff} mois de correctifs de sécurité en plus` : null;
  }
  if (da.monthsLeft !== null && da.monthsLeft > 0 && db.monthsLeft === null && !db.announcedYears)
    return `des correctifs annoncés ${da.precision === "mois" ? "jusqu'en" : "jusqu'au"} ${da.dateLabel} (aucune durée publiée pour ${le(b.model.name)})`;
  if (da.announcedYears && db.monthsLeft === null && !db.announcedYears)
    return `${dec(da.announcedYears)} ans de correctifs de sécurité annoncés par ${maker(a)} (aucune durée publiée pour ${le(b.model.name)})`;
  if (da.announcedYears && db.announcedYears && da.announcedYears - db.announcedYears >= 1)
    return `${dec(da.announcedYears - db.announcedYears)} an${da.announcedYears - db.announcedYears >= 2 ? "s" : ""} de correctifs annoncés en plus`;
  return null;
}

// ───────── Avantages concrets d'un modèle sur un autre ─────────

function advantages(a: Choice, b: Choice, p0: Priority, today: Date): string[] {
  const out: string[] = [];
  const sa = a.model.specs;
  const sb = b.model.specs;
  if (p0 === "photo") {
    const extra = minus(photoFeatures(sa), photoFeatures(sb));
    if (extra.length) out.push(joinFr(extra.map((f) => f.label)));
  }
  const ta = tier(a), tb = tier(b);
  if ((p0 === "photo" || p0 === "jeux") && ta !== null && tb !== null && ta > tb)
    out.push(`une puce d'une gamme au-dessus (${chipName(a)}, niveau ${ta}/5 contre ${tb}/5)`);
  const s = securityEdge(a, b, today);
  if (p0 === "longevite" && s) out.unshift(s);
  else if (s) out.push(s);
  if (a.config.storage_gb > 0 && b.config.storage_gb > 0 && a.config.storage_gb > b.config.storage_gb)
    out.push(`${storage(a.config.storage_gb)} de stockage au lieu de ${storage(b.config.storage_gb)}`);
  if (p0 === "autonomie") {
    const ma = num(a.model.measured.autonomy_h), mb = num(b.model.measured.autonomy_h);
    if (ma !== null && (mb === null || ma > mb)) out.unshift(`${dec(ma)} h d'autonomie mesurée lors d'un test indépendant`);
  }
  if (p0 === "une_main") {
    const wa = num(sa.width_mm), wb = num(sb.width_mm), ga = num(sa.weight_g), gb = num(sb.weight_g);
    if (wa !== null && wb !== null && wb - wa >= 1.5) out.unshift(`${dec(Math.round((wb - wa) * 10) / 10)} mm plus étroit`);
    if (ga !== null && gb !== null && gb - ga >= 10) out.push(`${Math.round(gb - ga)} g plus léger`);
  }
  const ba = num(sa.battery_mah), bb = num(sb.battery_mah);
  if (p0 !== "autonomie" && ba !== null && bb !== null && ba >= bb * 1.15)
    out.push(`une batterie annoncée plus grande (${ba.toLocaleString("fr-FR")} mAh contre ${bb.toLocaleString("fr-FR")}, pas une mesure d'autonomie)`);
  const wa = num(sa.charge_w), wb = num(sb.charge_w);
  if (wa !== null && wb !== null && wa >= wb * 1.5) out.push(`une charge annoncée plus rapide (${wa} W contre ${wb} W)`);
  if (sa.esim === true && sb.esim !== true) out.push(sb.esim === false ? "l'eSIM" : `l'eSIM (non indiquée pour ${le(b.model.name)})`);
  const ipa = typeof sa.ip === "string" ? sa.ip : "", ipb = typeof sb.ip === "string" ? sb.ip : "";
  if (/IP68/.test(ipa) && !/IP68/.test(ipb)) out.push(ipb ? `une certification IP68 (${ipb} pour ${le(b.model.name)})` : "une certification IP68 annoncée");
  return out.slice(0, 3);
}

// ───────── Critère principal : la phrase qui répond à la priorité ─────────

function priorityFact(p0: Priority, c: Choice, today: Date): string | null {
  const s = c.model.specs;
  switch (p0) {
    case "photo": {
      const f = photoFeatures(s);
      return f.length ? `Pour la photo, il réunit ${joinFr(f.map((x) => x.label))} (caractéristiques annoncées).` : null;
    }
    case "longevite":
      return `${cap(securityPhrase(sec(c, today), maker(c)))}.`;
    case "autonomie": {
      const m = num(c.model.measured.autonomy_h);
      if (m !== null) return `Autonomie mesurée lors d'un test indépendant : ${dec(m)} h.`;
      const mah = num(s.battery_mah), inch = num(s.screen_in);
      return mah !== null && inch !== null ? `Batterie annoncée de ${mah.toLocaleString("fr-FR")} mAh pour un écran de ${dec(inch)}″.` : null;
    }
    case "jeux": {
      const sc = num(s.chip_score), hz = num(s.refresh_hz);
      return typeof s.chip === "string"
        ? `Pour les jeux, puce ${s.chip}${sc !== null ? ` (indice PickJust ${sc}/100)` : ""}${hz && hz >= 120 ? ` et écran ${hz} Hz` : ""}.`
        : null;
    }
    case "une_main": {
      const w = num(s.width_mm), g = num(s.weight_g);
      return w !== null && g !== null ? `Pour l'utiliser à une main : ${dec(w)} mm de large et ${dec(g)} g.` : null;
    }
    case "prix":
      return "C'est le prix le plus bas parmi les offres qui respectent tes critères.";
  }
}

const NO_DATA: Record<Priority, string> = {
  photo: "Ses caractéristiques photo ne sont pas publiées : ce critère n'a pas pu être comparé.",
  longevite: "Aucune durée de correctifs de sécurité n'est publiée pour ce modèle.",
  autonomie: "Sa batterie n'est pas renseignée : son autonomie n'a pas pu être comparée.",
  jeux: "Sa puce n'est pas renseignée : ses performances n'ont pas pu être comparées.",
  une_main: "Ses dimensions ne sont pas renseignées : la prise en main n'a pas pu être comparée.",
  prix: "",
};

/** Le N°1 et le N°2 sont-ils à égalité sur la priorité principale, selon nos données ? */
function tiedOnPriority(p0: Priority, a: Choice, b: Choice, today: Date): boolean {
  switch (p0) {
    case "photo": {
      const fa = photoFeatures(a.model.specs), fb = photoFeatures(b.model.specs);
      return !minus(fa, fb).length && !minus(fb, fa).length;
    }
    case "longevite": {
      const da = sec(a, today), db = sec(b, today);
      return da.monthsLeft === db.monthsLeft && (da.announcedYears ?? null) === (db.announcedYears ?? null);
    }
    default: {
      const na = a.norms?.[p0], nb = b.norms?.[p0];
      return na === null || nb === null || na === undefined || nb === undefined ? false : Math.abs(na - nb) < 0.02;
    }
  }
}

/** Pourquoi le N°1 passe devant le N°2 : critère principal, sinon critère de départage réellement décisif. */
/** Deux choix indiscernables pour le classement : même prix, même critère principal, même score. */
function equivalent(p0: Priority, a: Choice, b: Choice, today: Date): boolean {
  const score = (c: Choice) => (c.parts ? c.parts.priorities + c.parts.budget + c.parts.profile : NaN);
  return Math.abs(amount(a) - amount(b)) < 1 && tiedOnPriority(p0, a, b, today) && Math.abs(score(a) - score(b)) < 0.005;
}

function firstVersusOthers(p0: Priority, choices: Choice[], answers: Answers, today: Date): string {
  const a = choices[0];
  const twins = choices.slice(1).filter((c) => equivalent(p0, a, c, today));
  const other = choices.slice(1).find((c) => !twins.includes(c));
  const tie = twins.length
    ? `À égalité avec ${joinFr(twins.map((c) => le(c.model.name)))} pour notre classement (même prix, même résultat sur ta priorité) : l'ordre entre eux n'est pas significatif.`
    : null;
  if (!other) return [p0 === "photo" ? "Nos données ne permettent pas de départager leur qualité photo." : null, tie].filter(Boolean).join(" ");
  return [firstVersusSecond(p0, a, other, answers, today), tie].filter(Boolean).join(" ");
}

function firstVersusSecond(p0: Priority, a: Choice, b: Choice, answers: Answers, today: Date): string {
  const d = Math.round((amount(b) - amount(a)) * 100) / 100;
  const priceBit = d >= 1 ? `Il coûte ${eur(d)} de moins que ${le(b.model.name)} ${basis(a, b)}.` : d <= -1 ? `Il coûte ${eur(-d)} de plus que ${le(b.model.name)} ${basis(a, b)}.` : null;
  const bits: string[] = [];
  const tied = tiedOnPriority(p0, a, b, today);
  // Ce qui l'a réellement placé devant : la plus grande contribution au score (mêmes poids que le classement).
  const dPrio = (a.parts?.priorities ?? 0) - (b.parts?.priorities ?? 0);
  const dBudget = (a.parts?.budget ?? 0) - (b.parts?.budget ?? 0);
  const dProfile = (a.parts?.profile ?? 0) - (b.parts?.profile ?? 0);
  const decisive = dProfile > 0.02 && dProfile >= dBudget && dProfile >= dPrio ? "profil" : dBudget > 0.02 && dBudget > dPrio ? "budget" : "priorite";

  if (p0 === "photo") {
    const fa = photoFeatures(a.model.specs), fb = photoFeatures(b.model.specs);
    const extra = minus(fa, fb);
    if (extra.length) bits.push(`Contrairement ${le(b.model.name).replace(/^le /, "au ").replace(/^l'/, "à l'")}, il offre ${joinFr(extra.map((f) => f.label))}.`);
    else bits.push("Nos données ne permettent pas de départager leur qualité photo.");
    const ta = tier(a), tb = tier(b);
    if (!extra.length && ta !== null && tb !== null && ta > tb)
      bits.push(decisive === "priorite"
        ? `Il passe devant grâce à sa puce ${chipName(a)}, d'une gamme au-dessus (niveau ${ta}/5 contre ${tb}/5), que notre classement photo prend en compte pour le traitement des images.`
        : `Sa puce ${chipName(a)} est d'une gamme au-dessus (niveau ${ta}/5 contre ${tb}/5).`);
  } else if (p0 === "longevite") {
    const e = securityEdge(a, b, today);
    if (e) bits.push(`Face ${le(b.model.name).replace(/^le /, "au ").replace(/^l'/, "à l'")} : ${e}.`);
    else if (tied) bits.push("Nos données ne permettent pas de départager leur suivi de sécurité.");
  } else if (p0 !== "prix" && tied) {
    bits.push(`À égalité avec ${le(b.model.name)} sur ce critère selon nos données.`);
  }

  if (decisive === "profil") {
    const e = answers.keepYears ? securityEdge(a, b, today) : null;
    if (e) bits.push(`Pour le garder ${answers.keepYears} an${answers.keepYears! > 1 ? "s" : ""}, il passe devant ${le(b.model.name)} grâce à ${e}.`);
    else if (answers.size) bits.push("Il correspond mieux à la taille d'écran que tu as choisie.");
    else if (answers.usage) bits.push("Il correspond mieux à l'intensité d'usage que tu as indiquée.");
  }
  if (priceBit) bits.push(priceBit);
  // Un N°1 plus cher qu'un N°2 équivalent : c'est le bonus « proche du plafond » du classement qui l'a placé devant.
  if (decisive === "budget" && d <= -1) bits.push("C'est surtout ce prix plus proche de ton plafond qui le place devant : notre classement favorise un modèle proche du budget, en général d'une gamme supérieure.");
  return bits.join(" ");
}

/** Pourquoi préférer une alternative au N°1. */
function altVersusFirst(p0: Priority, alt: Choice, first: Choice, today: Date): string {
  const main = altReason(p0, alt, first, today);
  if (equivalent(p0, first, alt, today)) return main;
  const behind = advantages(first, alt, p0, today)[0];
  return behind ? `${main} Classé derrière : le N°1 a ${behind}.` : main;
}

function altReason(p0: Priority, alt: Choice, first: Choice, today: Date): string {
  const adv = advantages(alt, first, p0, today);
  const d = Math.round((amount(alt) - amount(first)) * 100) / 100;
  const b = basis(alt, first);
  if (d >= 1)
    return adv.length
      ? `Pour ${eur(d)} de plus ${b}, il apporte ${joinFr(adv)}.`
      : `Il coûte ${eur(d)} de plus ${b} sans avantage démontré par nos données pour ton profil.`;
  if (d <= -1) return `À préférer pour payer ${eur(-d)} de moins ${b}${adv.length ? `, avec ${joinFr(adv)}` : ""}.`;
  return adv.length ? `Au même prix, il apporte ${joinFr(adv)}.` : "Au même prix, nos données ne montrent pas d'avantage concret sur le N°1.";
}

/**
 * Alternative suivante : si elle partage les atouts de l'alternative précédente face au N°1, on le dit une fois
 * (« mêmes atouts que le N°2 »), puis on explique ce qui la sépare du N°2.
 */
function laterAlt(p0: Priority, c: Choice, first: Choice, prev: Choice, i: number, today: Date): string {
  const key = (x: string) => x.replace(/\s*\(.*\)/, "");
  const theirs = new Set(advantages(prev, first, p0, today).map(key));
  const common = advantages(c, first, p0, today).filter((x) => theirs.has(key(x)));
  if (!common.length) return altVersusFirst(p0, c, first, today);
  const dFirst = Math.round((amount(c) - amount(first)) * 100) / 100;
  const dPrevFirst = Math.round((amount(prev) - amount(first)) * 100) / 100;
  const dPrev = Math.round((amount(c) - amount(prev)) * 100) / 100;
  const bits = [dFirst === dPrevFirst ? `Même prix et mêmes atouts que le N°${i} face au N°1.` : `Mêmes atouts que le N°${i} face au N°1.`];
  const overPrev = advantages(c, prev, p0, today);
  const behind = advantages(prev, c, p0, today);
  const vsPrev = le(prev.model.name).replace(/^le /, "au ").replace(/^l'/, "à l'");
  if (overPrev.length)
    bits.push(`Face ${vsPrev}, il apporte ${joinFr(overPrev)}${dPrev >= 1 ? `, pour ${eur(dPrev)} de plus` : dPrev <= -1 ? ` et coûte ${eur(-dPrev)} de moins` : ""}.`);
  else if (dPrev <= -1) bits.push(`Il coûte ${eur(-dPrev)} de moins que ${le(prev.model.name)}.`);
  if (behind.length) bits.push(`Il est classé derrière car ${le(prev.model.name)} a ${joinFr(behind)}.`);
  if (!overPrev.length && dPrev > -1) bits.push(`Nos données ne montrent pas de raison de le préférer ${vsPrev}.`);
  return bits.join(" ");
}

/** Compromis principal documenté (jamais une donnée inconnue présentée comme un défaut technique). */
function tradeoff(p0: Priority, c: Choice, answers: Answers, today: Date): string | null {
  const s = c.model.specs;
  const second = answers.priorities[1];
  if (second && c.norms && c.norms[second] === null) return `le critère « ${PRIORITY_LABELS_SHORT[second]} » n'a pas pu être évalué faute de donnée publiée.`;
  if (second && c.norms && (c.norms[second] ?? 1) < 0.5) return `moins bien placé que d'autres pour ${PRIORITY_LABELS_SHORT[second]}.`;
  const d = sec(c, today);
  if (p0 !== "longevite" && d.state === "inconnue" && !d.announcedYears) return "aucune durée de correctifs de sécurité publiée par le fabricant.";
  if (p0 !== "longevite" && (d.state === "periode_terminee" || d.state === "support_termine")) return "sa période de correctifs de sécurité est terminée.";
  const g = num(s.weight_g);
  if (p0 !== "une_main" && g !== null && g >= 215) return `plutôt lourd (${dec(g)} g).`;
  const w = num(s.width_mm);
  if (p0 !== "une_main" && w !== null && w >= 77.5) return `large en main (${dec(w)} mm).`;
  const ram = c.config.ram_gb ?? num(s.ram_gb);
  if ((p0 === "jeux" || answers.usage === "intensif") && ram !== null && ram < 8) return `${dec(ram)} Go de mémoire vive seulement.`;
  return null;
}

const PRIORITY_LABELS_SHORT: Record<Priority, string> = {
  photo: "la photo", autonomie: "l'autonomie", jeux: "les jeux", une_main: "l'usage à une main", longevite: "la durée de suivi", prix: "le prix",
};

// ───────── Point d'entrée ─────────

export function explainChoices(choices: Choice[], answers: Answers, today: Date): ChoicesExplanation {
  const p0 = answers.priorities[0];
  const n = choices.length;
  let shared: string | null = null;
  let sharedKeys: string[] = [];

  let sharedIds: string[] = [];
  if (n >= 2 && p0 === "photo") {
    const withData = choices.filter((c) => photoFeatures(c.model.specs).length);
    const lists = withData.map((c) => photoFeatures(c.model.specs));
    const common = withData.length >= 2 ? lists[0].filter((f) => lists.every((l) => hasKey(l, f.key))) : [];
    if (common.length) {
      const who = withData.length === n ? (n === 2 ? "Les deux" : `Les ${n}`) : cap(joinFr(withData.map((c) => le(c.model.name))));
      shared = `${who} disposent ${joinFr(common.map((f) => de(f.label)))} (caractéristiques annoncées).`;
      sharedKeys = common.map((f) => f.key);
      sharedIds = withData.map((c) => c.model.id);
    }
  }
  if (n >= 2 && p0 === "longevite") {
    const ds = choices.map((c) => sec(c, today));
    if (ds.every((d) => d.monthsLeft === null && !d.announcedYears)) shared = `Aucun des ${n} ne publie de durée de correctifs de sécurité.`;
    else if (ds.every((d) => d.monthsLeft === null && d.announcedYears && d.announcedYears === ds[0].announcedYears))
      shared = `${n === 2 ? "Les deux" : `Les ${n}`} ont ${dec(ds[0].announcedYears!)} ans de correctifs annoncés, sans date de départ publiée : le temps restant reste à vérifier.`;
  }

  const items = choices.map((c, i): ChoiceExplanation => {
    const fact = priorityFact(p0, c, today);
    // Donnée absente : la phrase principale le dit déjà, pas de répétition en « limite ».
    let limit: string | null = null;
    if (p0 === "autonomie" && fact && num(c.model.measured.autonomy_h) === null)
      limit = "Aucune mesure d'autonomie indépendante : une grande batterie ne garantit pas une meilleure tenue.";
    if (p0 === "longevite" && answers.keepYears) limit = keepYearsVerdict(answers.keepYears, sec(c, today)).text;

    // Phrase principale : on n'y répète pas ce qui est déjà dit une fois pour tous.
    let lead = fact ?? NO_DATA[p0];
    if (p0 === "photo" && fact && sharedKeys.length && sharedIds.includes(c.model.id)) {
      const own = photoFeatures(c.model.specs).filter((f) => !sharedKeys.includes(f.key));
      // Le N°1 : ce qui le distingue est dit dans la comparaison au N°2, pas deux fois.
      lead = i === 0 && n >= 2 ? ""
        : own.length
        ? `En plus, il offre ${joinFr(own.map((f) => f.label))} (caractéristiques annoncées).`
        : i > 0 && tiedOnPriority("photo", c, choices[0], today) ? "Pour la photo, même équipement annoncé que le N°1." : "";
    }
    if (p0 === "longevite" && shared) lead = "";

    if (p0 === "prix" && i > 0) lead = "";
    let versus: string | null = null;
    if (i === 0 && n >= 2) versus = firstVersusOthers(p0, choices, answers, today);
    else if (i === 1) versus = altVersusFirst(p0, c, choices[0], today);
    else if (i > 1) versus = laterAlt(p0, c, choices[0], choices[i - 1], i, today);
    if (!lead) {
      // Première phrase en tête (mise en avant), la suite en détail.
      const m = (versus ?? "").match(/^([^]+?\.)\s+([^]+)$/);
      lead = m ? m[1] : versus ?? "";
      versus = m ? m[2] : null;
    }
    return { lead, versus, limit, tradeoff: tradeoff(p0, c, answers, today) };
  });
  return { shared, items };
}
