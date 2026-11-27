import type { GuideItem } from "@/lib/budget-guide";
import { PriceTag } from "@/components/PriceTag";

/** Prix d'une offre du guide : même présentation que partout ailleurs (jamais un « frais inclus » non vérifié). */
export function GuidePrice({ item, big = false, budget }: { item: GuideItem; big?: boolean; budget?: number }) {
  return <PriceTag offer={item.entry.offer} budget={budget} size={big ? "xl" : "md"} />;
}
