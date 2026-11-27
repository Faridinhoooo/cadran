// Montants : saisie française, calculs en centimes entiers (aucune erreur d'arrondi sur un plafond au centime près).

/** Limites du champ budget, communes à l'accueil, au questionnaire et aux résultats. */
export const BUDGET_MIN = 50;
export const BUDGET_MAX = 5000;

/** Valeur d'un champ budget : « 400 », « 327,50 ». */
export const budgetInput = (n: number) => (!n ? "" : Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : n.toFixed(2).replace(".", ","));

/** Euros → centimes entiers. */
export const cents = (euros: number): number => Math.round(euros * 100);

/** Somme exacte de montants en euros (calculée en centimes). */
export function addEuros(...values: number[]): number {
  return values.reduce((sum, v) => sum + cents(v), 0) / 100;
}

/** a ≤ b au centime près. */
export const withinCents = (amount: number, budget: number): boolean => cents(amount) <= cents(budget);

export type BudgetParse = { ok: true; value: number } | { ok: false; error: string };

/**
 * Lit une saisie libre : « 327,50 », « 327.50 », « 1 200 », « 1 200,5 € ». Jamais arrondie à un palier.
 * Au plus deux décimales ; hors limites ou illisible → erreur explicite.
 */
export function parseBudget(input: unknown): BudgetParse {
  const raw = String(input ?? "").trim().replace(/[\s  ]/g, "").replace(/€$/, "");
  if (!raw) return { ok: false, error: "Indique ton budget maximum." };
  if (!/^\d+([.,]\d{1,2})?$/.test(raw)) return { ok: false, error: "Montant illisible : écris par exemple 327,50." };
  const value = cents(Number(raw.replace(",", "."))) / 100;
  if (value < BUDGET_MIN || value > BUDGET_MAX)
    return { ok: false, error: `Indique un budget entre ${BUDGET_MIN} € et ${BUDGET_MAX.toLocaleString("fr-FR")} €.` };
  return { ok: true, value };
}
