import { euros } from "@/lib/format";
import type { GuideItem } from "@/lib/budget-guide";

/** Prix d'une offre du guide, toujours avec son statut de frais (jamais un « frais inclus » non vérifié). */
export function GuidePrice({ item, big = false }: { item: GuideItem; big?: boolean }) {
  const start = item.entry.offer.capacity_status === "prix_de_depart";
  return (
    <p className="leading-tight">
      <span className={`font-extrabold tabular-nums ${big ? "text-3xl" : "text-xl"}`}>{euros(item.total ?? item.shown)}</span>
      <span className="block text-sm font-semibold mt-0.5">
        {item.total !== null ? (
          <span className="text-ok">✓ frais inclus</span>
        ) : start ? (
          <>à partir de · <span className="text-warn">capacité à vérifier</span></>
        ) : (
          <>hors frais · <span className="text-warn">Livraison à vérifier</span></>
        )}
      </span>
    </p>
  );
}
