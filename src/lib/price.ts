// Présentation du prix d'une offre, commune à toutes les pages (accueil, guides, catalogue, résultats, comparateur, fiche).
//  - frais obligatoires et livraison connus : coût total, « frais inclus » ;
//  - frais inconnus : prix affiché « hors frais · livraison à vérifier » (+ marge de frais tolérée sous un plafond) ;
//  - prix « à partir de » : jamais un coût total, capacité à vérifier.
import { offerTotal, shownPrice, type OfferLite } from "./engine";

export type PriceKind = "total" | "hors_frais" | "depart";

export interface PriceStatus {
  /** Montant à afficher : coût total si connu, sinon prix affiché + frais obligatoires connus. */
  amount: number;
  kind: PriceKind;
  /** Mention courte à côté du montant. */
  label: string;
  /** Le coût total est-il connu et sous le plafond ? null si inconnu ou sans plafond. */
  withinBudget: boolean | null;
  /** Frais encore inconnus que l'offre peut absorber en restant sous le plafond (null si sans objet). */
  headroom: number | null;
  /** Une phrase sur le budget, ou null. */
  budgetNote: string | null;
}

type PriceInput = Pick<OfferLite, "price" | "mandatory_fees" | "shipping"> & { capacity_status?: string };

export const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;

export function priceStatus(o: PriceInput, budget?: number | null): PriceStatus {
  const total = offerTotal(o);
  if (total !== null) {
    const within = budget ? total <= budget : null;
    return {
      amount: total, kind: "total", label: o.shipping === 0 ? "frais inclus · livraison gratuite" : "frais inclus",
      withinBudget: within, headroom: null,
      budgetNote: budget ? (within ? null : `Au-dessus de ton budget de ${eur(budget)}, frais inclus.`) : null,
    };
  }
  const amount = shownPrice(o);
  const start = o.capacity_status === "prix_de_depart";
  const headroom = budget ? Math.round((budget - amount) * 100) / 100 : null;
  return {
    amount, kind: start ? "depart" : "hors_frais",
    label: start ? "prix « à partir de » · capacité à vérifier" : "hors frais · livraison à vérifier",
    withinBudget: null, headroom,
    budgetNote: headroom === null ? null
      : headroom < 0 ? `Au-dessus de ton budget de ${eur(budget!)} avant même les frais.`
      : headroom === 0 ? "Cette offre respecte ton budget seulement si la livraison est gratuite."
      : `Cette offre respecte ton budget si les frais ne dépassent pas ${eur(headroom)}.`,
  };
}

/** « 399 € hors frais · livraison à vérifier » */
export function priceText(o: PriceInput, budget?: number | null): string {
  const p = priceStatus(o, budget);
  return `${eur(p.amount)} ${p.label}`;
}
