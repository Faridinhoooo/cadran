import { shopLinks, usedLinks } from "@/lib/shop-links";

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
    <section aria-labelledby="ailleurs-titre" id="ailleurs" className="bg-panel rounded-3xl p-5 scroll-mt-24">
      <h3 id="ailleurs-titre" className="display text-xl">{title}</h3>
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
        {links.map((l) => (
          <li key={l.id}>
            <a href={l.url} target="_blank" rel="noopener noreferrer nofollow"
              className="card-link group flex flex-col justify-between h-full min-h-[72px] bg-panel-2 rounded-2xl px-4 py-3">
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

/** Bloc « Le trouver d'occasion ou reconditionné » : mis en avant quand le modèle n'a pas de prix neuf vérifié. */
export function UsedLinks({ brand, name, storageGb, emphasis = false }: { brand: string; name: string; storageGb?: number | null; emphasis?: boolean }) {
  const links = usedLinks(brand, name, storageGb);
  return (
    <section aria-labelledby="occasion-liens-titre" id="occasion-liens" className={`border cut-sm p-5 scroll-mt-24 ${emphasis ? "border-ok/60 bg-[linear-gradient(160deg,rgba(74,222,128,0.08),transparent_60%)]" : "border-line bg-panel"}`}>
      <h3 id="occasion-liens-titre" className="display text-xl">{emphasis ? "Le trouver d'occasion ou reconditionné" : "Aussi en occasion et reconditionné"}</h3>
      {emphasis && <p className="text-sm text-muted mt-1">Plus vendu neuf chez les vendeurs suivis par PickJust : voici où il se trouve encore, souvent moins cher.</p>}
      <ul className="grid sm:grid-cols-3 gap-2 mt-4">
        {links.map((l) => (
          <li key={l.id}>
            <a href={l.url} target="_blank" rel="noopener noreferrer nofollow"
              className="card-link group flex flex-col justify-between h-full min-h-[72px] bg-panel-2 rounded-2xl px-4 py-3">
              <span className="font-bold group-hover:text-red transition-colors">{l.label} <span aria-hidden>↗</span></span>
              <span className="text-xs text-muted mt-1">{l.hint}</span>
              <span className="sr-only"> (nouvel onglet)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted mt-3">Liens neutres, sans commission. Vérifie l&apos;état, la batterie et la garantie avant d&apos;acheter ; entre particuliers, privilégie la remise en main propre ou le paiement sécurisé du site.</p>
    </section>
  );
}
