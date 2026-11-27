import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { budgetGuide, GUIDE_BUDGETS, isGuideBudget } from "@/lib/budget-guide";
import { candidates, merchantSyncs, thumbnails } from "@/lib/queries";
import { CONDITION_LABELS } from "@/lib/engine";
import { dateTimeFr, euros, sourceLabel, storageLabel } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";
import { Crumbs, Thumb } from "@/components/ui";
import { GuidePrice } from "@/components/GuidePrice";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ budget: string }> };
const MONTH = () => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date());

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const b = Number((await params).budget);
  if (!isGuideBudget(b)) return { title: "Guide introuvable", robots: { index: false } };
  return {
    title: `Meilleurs smartphones à ${b} € (${MONTH()})`,
    description: `Quel smartphone acheter avec ${b} € ? Le moins cher, le meilleur pour la photo, l'autonomie, les jeux et le suivi logiciel, d'après les prix relevés aujourd'hui en France.`,
    alternates: { canonical: `/meilleurs-smartphones/${b}` },
  };
}

export default async function Page({ params }: Params) {
  const budget = Number((await params).budget);
  if (!isGuideBudget(budget)) notFound();
  const today = new Date();
  const g = budgetGuide(budget, candidates(), today);
  const thumbs = thumbnails();
  const base = siteConfig().url.replace(/\/$/, "");
  const lastSync = merchantSyncs().map((s) => s.lastOk).filter((x): x is string => !!x).sort().pop();
  const shown = g.winners.filter((w) => w.item);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Meilleurs smartphones à ${budget} €`,
    itemListElement: shown.map((w, i) => ({ "@type": "ListItem", position: i + 1, name: `${w.title} : ${w.item!.entry.model.name}`, url: `${base}/telephone/${w.item!.entry.model.id}` })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Crumbs items={[{ href: "/meilleurs-smartphones", label: "Guides par budget" }, { label: `${budget} €` }]} />
      <h1 className="display text-4xl sm:text-6xl">
        Meilleurs smartphones à <span className="text-red">{euros(budget)}</span>
      </h1>
      <p className="text-muted mt-3 max-w-3xl">
        {g.offers.length
          ? <>{g.models} modèles et {g.offers.length} offres neuves ou reconditionnées sous {euros(budget)}, dont {g.confirmed} frais inclus et {g.toVerify} dont la livraison reste à vérifier.</>
          : <>Aucune offre récente n&apos;est relevée sous {euros(budget)} pour le moment.</>}{" "}
        Classement calculé à partir des prix relevés {lastSync ? `le ${dateTimeFr(lastSync)}` : "récemment"} ; aucun vendeur ne paie pour y figurer (
        <Link href="/classement" className="underline">méthode</Link>).
      </p>

      <nav aria-label="Autres budgets" className="flex flex-wrap gap-2 mt-5">
        {GUIDE_BUDGETS.map((b) => (
          <Link key={b} href={`/meilleurs-smartphones/${b}`} aria-current={b === budget ? "page" : undefined}
            className={`px-4 py-2 min-h-[44px] grid place-items-center border rounded-full text-sm font-semibold ${b === budget ? "border-red text-red" : "border-line hover:border-text/30"}`}>
            {euros(b)}
          </Link>
        ))}
      </nav>

      {g.offers.length > 0 && (
        <section aria-labelledby="gagnants" className="mt-10">
          <h2 id="gagnants" className="display text-2xl sm:text-3xl">Notre sélection par usage</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {g.winners.map((w) => (
              <li key={w.priority} className="bg-panel rounded-3xl flex flex-col">
                <div className="px-4 pt-4">
                  <p className="eyebrow">{w.title}</p>
                  <p className="text-xs text-muted mt-2">{w.blurb}</p>
                </div>
                {w.item ? (
                  <>
                    <div className="grid grid-cols-[104px_1fr] gap-4 p-4">
                      <Thumb media={thumbs.get(w.item.entry.model.id) ?? null} alt={w.item.entry.model.name} form={w.item.entry.model.form_factor} size={104} />
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-lg leading-tight">
                          <Link href={`/telephone/${w.item.entry.model.id}${w.item.entry.config.storage_gb ? `?go=${w.item.entry.config.storage_gb}` : ""}`} className="hover:text-red">
                            {w.item.entry.model.name}
                          </Link>
                        </h3>
                        <p className="text-xs text-muted mt-1">
                          {w.item.entry.config.storage_gb ? storageLabel(w.item.entry.config.storage_gb) : "Capacité à choisir"} · {CONDITION_LABELS[w.item.entry.offer.condition]} · {w.item.entry.offer.seller}
                        </p>
                        <div className="mt-2"><GuidePrice item={w.item} /></div>
                      </div>
                    </div>
                    <p className="px-4 text-sm">{w.item.why}</p>
                    <div className="p-4 mt-auto flex flex-wrap gap-2">
                      <a href={w.item.entry.offer.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-[44px] text-sm">
                        {w.item.total !== null ? "Voir l'offre" : "Vérifier chez le vendeur"}<span className="sr-only"> {w.item.entry.offer.seller}, nouvel onglet</span>
                      </a>
                      <Link href={`/telephone/${w.item.entry.model.id}`} className="btn btn-ghost min-h-[44px] text-sm">Fiche</Link>
                    </div>
                  </>
                ) : (
                  <p className="p-4 text-sm text-muted">Pas de comparaison possible à ce budget : il faut au moins deux modèles dont cette donnée est connue.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="toutes" className="mt-12">
        <h2 id="toutes" className="display text-2xl sm:text-3xl">Toutes les offres sous {euros(budget)}</h2>
        {g.offers.length ? (
          <div className="overflow-x-auto mt-4 bg-panel rounded-3xl">
            <table className="specs w-full text-sm min-w-[640px]">
              <thead>
                <tr><th>Modèle</th><th>Capacité</th><th>État</th><th>Vendeur</th><th>Prix</th><th>Source</th></tr>
              </thead>
              <tbody>
                {g.offers.map((o) => (
                  <tr key={o.entry.offer.id}>
                    <th scope="row" className="font-semibold"><Link href={`/telephone/${o.entry.model.id}`} className="hover:text-red underline-offset-2 hover:underline">{o.entry.model.name}</Link></th>
                    <td>{o.entry.config.storage_gb ? storageLabel(o.entry.config.storage_gb) : "À choisir"}</td>
                    <td>{CONDITION_LABELS[o.entry.offer.condition]}</td>
                    <td><a href={o.entry.offer.url} target="_blank" rel="noopener noreferrer" className="underline">{o.entry.offer.seller}</a></td>
                    <td><GuidePrice item={o} /></td>
                    <td className="text-xs text-muted">{sourceLabel((o.entry.offer as { source?: string }).source)}<br />{dateTimeFr(o.entry.offer.checked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted mt-3">Essaie un budget plus élevé ou consulte le <Link href="/catalogue" className="underline">catalogue</Link>.</p>
        )}
      </section>

      <section className="mt-12 bg-panel border border-red cut p-6 sm:p-8">
        <h2 className="display text-2xl">Un choix fait pour toi</h2>
        <p className="text-muted mt-2">Sept questions rapides suffisent pour classer ces offres selon tes priorités et ton système préféré.</p>
        <Link href={`/trouver?budget=${budget}`} className="btn btn-primary mt-4">Trouver mon smartphone à {euros(budget)}</Link>
      </section>
    </div>
  );
}
