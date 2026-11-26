import { shopLinks } from "@/lib/shop-links";

/** Bloc « Comparer les prix ailleurs » : liens de recherche neutres, ouverts dans un nouvel onglet. */
export function ShopLinks({ brand, name, storageGb, title = "Comparer les prix ailleurs", compact = false }: {
  brand: string; name: string; storageGb?: number | null; title?: string; compact?: boolean;
}) {
  const links = shopLinks(brand, name, storageGb);
  if (compact) {
    return (
      <p className="text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-muted">{title} :</span>
        {links.map((l) => (
          <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline underline-offset-2 hover:text-red">
            {l.label}<span aria-hidden> ↗</span><span className="sr-only"> (nouvel onglet)</span>
          </a>
        ))}
      </p>
    );
  }
  return (
    <section aria-labelledby="ailleurs-titre" id="ailleurs" className="bg-panel border border-line cut-sm p-5 scroll-mt-24">
      <h3 id="ailleurs-titre" className="display text-xl">{title}</h3>
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
        {links.map((l) => (
          <li key={l.id}>
            <a href={l.url} target="_blank" rel="noopener noreferrer nofollow"
              className="card-link group flex flex-col justify-between h-full min-h-[72px] border border-line bg-panel-2 px-4 py-3">
              <span className="font-bold group-hover:text-red transition-colors">{l.label} <span aria-hidden>↗</span></span>
              <span className="text-xs text-muted mt-1">{l.hint}</span>
              <span className="sr-only"> (nouvel onglet)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted mt-3">
        Liens de recherche neutres, sans affiliation : PickJust ne touche aucune commission. Les prix affichés sur ces sites
        n&apos;ont pas été vérifiés par PickJust ; compare le coût total, livraison comprise.
      </p>
    </section>
  );
}
