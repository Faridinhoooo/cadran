// Calcul du temps de suivi logiciel restant, recalculé à chaque affichage à la date du jour.

export interface SupportRow {
  os_launch: string | null;
  os_latest_verified: string | null;
  upgrade_commitment: string | null;
  upgrade_count: number | null;
  upgrades_delivered: number | null;
  upgrade_end: string | null;
  upgrade_end_precision: string | null;
  security_years: number | null;
  security_end: string | null;
  security_end_precision: string | null;
  security_end_confirmed: number;
  security_frequency: string | null;
  source_name: string | null;
  source_url: string | null;
  policy_url: string | null;
  checked_at: string | null;
  level?: string;
}

export type DeadlineState = "en_cours" | "dernier_jour" | "periode_terminee" | "support_termine" | "inconnue";

export interface Deadline {
  state: DeadlineState;
  /** Dernier jour couvert (inclus), au format ISO. */
  end: string | null;
  precision: "jour" | "mois" | null;
  /** Mois entiers restants (pour le moteur), null si inconnu. */
  monthsLeft: number | null;
  /** Libellé de la date : « 12 mars 2031 » ou « août 2033 ». */
  dateLabel: string | null;
  /** « 4 ans et 3 mois », « 12 jours », « environ 6 ans et 9 mois ». */
  remainingLabel: string | null;
  /**
   * Durée annoncée par le fabricant (« 6 ans de mises à jour de sécurité ») quand ni la date de départ ni l'échéance
   * ne sont publiées : on affiche « 6 ans annoncés », jamais un temps restant calculé.
   */
  announcedYears?: number | null;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function parseISODate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m || 1, d: d || 1 };
}

const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Différence calendaire en années / mois / jours entre deux dates (a ≤ b). */
export function diffYMD(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }) {
  let years = b.y - a.y;
  let months = b.m - a.m;
  let days = b.d - a.d;
  if (days < 0) {
    months -= 1;
    const pm = b.m === 1 ? 12 : b.m - 1;
    const py = b.m === 1 ? b.y - 1 : b.y;
    days += daysInMonth(py, pm);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

export function formatYM(years: number, months: number): string {
  const parts = [];
  if (years > 0) parts.push(plural(years, "an", "ans"));
  if (months > 0) parts.push(`${months} mois`);
  return parts.length ? parts.join(" et ") : "moins d'un mois";
}

export function frenchDate(iso: string): string {
  const { y, m, d } = parseISODate(iso);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

export function frenchMonth(iso: string): string {
  const { y, m } = parseISODate(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/**
 * Échéance d'une garantie de suivi.
 *  - précision « jour » : date exacte → reste en années/mois, ou en jours sous un mois.
 *  - précision « mois » : on ne connaît que le mois → durée approximative, sans inventer de jour.
 *  - pas d'échéance : « inconnue ».
 */
export function deadline(end: string | null, precision: string | null, confirmedEnd: boolean, today: Date): Deadline {
  if (!end) return { state: "inconnue", end: null, precision: null, monthsLeft: null, dateLabel: null, remainingLabel: null };
  const t = { y: today.getUTCFullYear(), m: today.getUTCMonth() + 1, d: today.getUTCDate() };
  const p = parseISODate(end);
  const isMonth = precision === "mois";
  // Dernier jour couvert : pour un mois connu, on considère la fin du mois (aucun jour n'est affiché).
  const last = isMonth ? { y: p.y, m: p.m, d: daysInMonth(p.y, p.m) } : p;
  const lastIso = `${last.y}-${String(last.m).padStart(2, "0")}-${String(last.d).padStart(2, "0")}`;
  const dateLabel = isMonth ? frenchMonth(end) : frenchDate(end);
  const cmp = utc(last.y, last.m, last.d) - utc(t.y, t.m, t.d);
  if (cmp < 0) {
    return {
      state: confirmedEnd ? "support_termine" : "periode_terminee",
      end: lastIso, precision: isMonth ? "mois" : "jour", monthsLeft: 0, dateLabel, remainingLabel: null,
    };
  }
  if (cmp === 0 && !isMonth) {
    return { state: "dernier_jour", end: lastIso, precision: "jour", monthsLeft: 0, dateLabel, remainingLabel: "dernier jour de la période garantie" };
  }
  if (isMonth) {
    // Mois entiers restants jusqu'au mois annoncé
    const months = (p.y - t.y) * 12 + (p.m - t.m);
    const label = months <= 0 ? "jusqu'à la fin du mois" : `environ ${formatYM(Math.floor(months / 12), months % 12)}`;
    return { state: "en_cours", end: lastIso, precision: "mois", monthsLeft: Math.max(0, months), dateLabel, remainingLabel: label };
  }
  const dd = diffYMD(t, p);
  const totalMonths = dd.years * 12 + dd.months;
  const remainingLabel = totalMonths === 0 ? plural(Math.round(cmp / 864e5), "jour", "jours") : formatYM(dd.years, dd.months);
  return { state: "en_cours", end: lastIso, precision: "jour", monthsLeft: totalMonths, dateLabel, remainingLabel };
}

export function securityDeadline(s: SupportRow | null, today: Date): Deadline {
  const d = deadline(s?.security_end ?? null, s?.security_end_precision ?? null, !!s?.security_end_confirmed, today);
  return d.state === "inconnue" && s?.security_years ? { ...d, announcedYears: s.security_years } : d;
}

const yearsLabel = (y: number) => `${String(y).replace(".", ",")} an${y >= 2 ? "s" : ""}`;

/** « 6 ans annoncés » : durée seule, sans date de départ ni échéance publiées. */
export function announcedLabel(d: Deadline): string | null {
  return d.state === "inconnue" && d.announcedYears ? `${yearsLabel(d.announcedYears)} annoncés` : null;
}

export function upgradesDeadline(s: SupportRow | null, today: Date): Deadline {
  return deadline(s?.upgrade_end ?? null, s?.upgrade_end_precision ?? null, false, today);
}

/** Phrase courte pour la sécurité (cartes, comparateur, résultats). */
export function securityHeadline(d: Deadline): string {
  switch (d.state) {
    case "inconnue":
      return d.announcedYears ? `${yearsLabel(d.announcedYears)} annoncés · temps restant à vérifier` : "Date de fin non annoncée";
    case "periode_terminee":
      return "Période garantie terminée";
    case "support_termine":
      return "Support terminé";
    case "dernier_jour":
      return `Correctifs garantis jusqu'au ${d.dateLabel} · dernier jour`;
    default:
      return d.precision === "mois"
        ? `Correctifs garantis jusqu'en ${d.dateLabel} · Encore ${d.remainingLabel}`
        : `Correctifs garantis jusqu'au ${d.dateLabel} · Encore ${d.remainingLabel}`;
  }
}

/** Compare la durée de conservation souhaitée à la garantie restante. */
export function keepYearsVerdict(years: number, d: Deadline): { ok: boolean | null; text: string } {
  if (d.state === "inconnue" && d.announcedYears)
    return {
      ok: null,
      text: `${yearsLabel(d.announcedYears)} de correctifs de sécurité annoncés, mais sans date de départ publiée : le temps restant pour tes ${years} ans reste à vérifier.`,
    };
  if (d.state === "inconnue" || d.monthsLeft === null)
    return { ok: null, text: `Garder ce téléphone ${years} ans avec des correctifs de sécurité ne peut pas être confirmé : aucune date de fin n'est publiée.` };
  const need = years * 12;
  if (d.monthsLeft >= need)
    return { ok: true, text: `Les correctifs de sécurité sont annoncés pour encore ${d.remainingLabel ?? "—"} : tes ${years} ans sont couverts.` };
  return {
    ok: false,
    text: d.monthsLeft === 0
      ? `La période garantie de correctifs est terminée : tes ${years} ans ne sont pas couverts.`
      : `Les correctifs de sécurité sont annoncés pour encore ${d.remainingLabel} seulement, moins que les ${years} ans souhaités.`,
  };
}

export type SupportKind = "officiel" | "absence_verifiee" | "non_verifie";

/** Trois situations distinctes, jamais confondues à l'affichage. */
export function supportStatus(s: SupportRow | null): { kind: SupportKind; label: string; help: string } {
  if (s?.level === "officiel" && !s.security_end && s.security_years)
    return { kind: "officiel", label: `${yearsLabel(s.security_years)} annoncés par le fabricant`, help: "Durée publiée sur la page officielle, sans date de départ ni échéance : le temps restant reste à vérifier." };
  if (s?.level === "officiel")
    return { kind: "officiel", label: "Engagement officiel vérifié", help: "Échéance calculée à partir d'une page officielle du constructeur, relevée à la date indiquée." };
  if (s?.level === "autorise")
    return { kind: "officiel", label: "Engagement publié par le fabricant (Icecat)", help: "Échéance fournie par le fabricant au catalogue Open Icecat pour cette référence exacte." };
  if (s?.level === "consulte")
    return { kind: "non_verifie", label: "Durée de suivi inconnue", help: "La page officielle consultée ne publie aucune durée ni échéance de mises à jour ; le lien vers cette page est conservé ci-dessous." };
  if (s?.level === "absence_verifiee")
    return { kind: "absence_verifiee", label: "Aucune échéance annoncée (vérifié)", help: "Le constructeur ne publie ni durée ni date de fin : vérifié sur sa page officielle." };
  return { kind: "non_verifie", label: "Politique pas encore vérifiée par le site", help: "Les dates affichées viennent d'une base communautaire (endoflife.date) ; elles ne sont pas confirmées sur une page officielle." };
}
