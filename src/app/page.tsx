import Link from "next/link";
import { BudgetForm } from "@/components/BudgetForm";
import { PhoneIllustration, PhotoFrame } from "@/components/ui";
import { brands, catalogSummaries, coverage, lastUpdate, type ModelSummary } from "@/lib/queries";
import { dateTimeFr, euros } from "@/lib/format";

export const dynamic = "force-dynamic";

const QUICK = [200, 300, 400, 600, 800];
const SHOWCASE = [200, 400, 700, 1000];

const lowest = (m: ModelSummary) => Math.min(m.minNew ?? Infinity, m.minRefurb ?? Infinity);

export default function Home() {
  const { totals } = coverage();
  const updated = lastUpdate();
  const all = catalogSummaries();
  const allBrands = brands();

  // Vitrine par budget : modèles dont un prix affiché passe sous le plafond (frais éventuels à vérifier sur le guide).
  const showcase = SHOWCASE.map((b, i) => {
    const floor = i ? SHOWCASE[i - 1] : 0;
    const band = all.filter((m) => lowest(m) <= b && lowest(m) > floor).sort((x, y) => lowest(y) - lowest(x));
    return { budget: b, floor, count: all.filter((m) => lowest(m) <= b).length, inBand: band.length, picks: band.slice(0, 3) };
  });

  const count = new Map<string, number>();
  for (const m of all) count.set(m.brand_id, (count.get(m.brand_id) ?? 0) + 1);
  const brandTiles = allBrands
    .map((b) => ({ ...b, n: count.get(b.id) ?? 0, from: Math.min(...all.filter((m) => m.brand_id === b.id).map(lowest)) }))
    .filter((b) => b.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <div className="overflow-x-clip">
      {/* ——— Héros ——— */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center pt-8 pb-14 lg:pt-16">
        <div className="rise">
          <p className="tag text-red mb-5">Neuf · Reconditionné · Occasion</p>
          <h1 className="display text-[2.7rem] leading-[0.92] sm:text-7xl xl:text-8xl">
            Quel smartphone pour <span className="text-red">ton budget</span>&nbsp;?
          </h1>
          <p className="text-lg text-muted mt-5 max-w-xl">
            Des prix relevés chez les vendeurs, frais compris, et une recommandation expliquée en trois questions.
          </p>
          <div className="mt-8">
            <BudgetForm />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Budgets fréquents">
            <span className="text-xs uppercase tracking-wider font-bold text-muted mr-1">Ou directement :</span>
            {QUICK.map((b) => (
              <Link key={b} href={`/trouver?budget=${b}`} className="chip">{euros(b)}</Link>
            ))}
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:max-w-md rise rise-2 hidden sm:block">
          <div className="halo absolute -inset-16" aria-hidden />
          <PhoneIllustration className="relative w-[70%] mx-auto drop-shadow-[0_30px_60px_rgba(255,52,52,0.25)] float" />
        </div>
      </section>

      {/* ——— Chiffres clés ——— */}
      <section aria-label="Le catalogue en chiffres" className="border-y border-line bg-panel/60 backdrop-blur-sm">
        <dl className="mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4">
          {[
            [String(totals.published), "smartphones au prix vérifié"],
            [String(totals.offers), "offres relevées chez les vendeurs"],
            ["7 jours", "âge maximum d'un prix affiché"],
            ["0 €", "payé par un vendeur pour être classé"],
          ].map(([v, l], i) => (
            <div key={l} className={`flex flex-col-reverse py-6 ${i % 2 ? "pl-5 border-l border-line" : "pr-5"} ${i === 2 ? "lg:pl-5 lg:border-l" : ""} ${i > 1 ? "border-t lg:border-t-0" : ""} border-line`}>
              <dt className="text-sm text-muted mt-1">{l}</dt>
              <dd className="display text-3xl sm:text-4xl tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {updated && (
          <p className="mx-auto max-w-7xl px-4 sm:px-6 pb-4 -mt-1 text-xs text-muted flex items-center gap-2">
            <span className="live" aria-hidden /> Prix actualisés le {dateTimeFr(updated)} ·{" "}
            <Link href="/couverture" className="underline hover:text-text">sources et lacunes</Link>
          </p>
        )}
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ——— Par budget ——— */}
        <section aria-labelledby="budgets" className="pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="tag text-red">Guides</p>
              <h2 id="budgets" className="display text-3xl sm:text-5xl mt-3">Les meilleurs par budget</h2>
            </div>
            <Link href="/meilleurs-smartphones" className="link-arrow">Tous les budgets</Link>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {showcase.map((s) => (
              <li key={s.budget}>
                <Link href={`/meilleurs-smartphones/${s.budget}`} className="card-link group block h-full bg-panel border border-line cut">
                  <div className="p-5 pb-3 flex items-baseline justify-between gap-3">
                    <p className="display text-3xl">
                      <span className="text-muted text-lg mr-1">À</span>
                      {euros(s.budget)}
                    </p>
                    <span className="text-xs text-muted tabular-nums">{s.count} modèle{s.count > 1 ? "s" : ""} au total</span>
                  </div>
                  <div className="grid grid-cols-3 gap-px bg-line mx-5">
                    {s.picks.length ? s.picks.map((m) => (
                      <PhotoFrame key={m.id} media={m.thumb} alt={m.name} form={m.form_factor} className="aspect-[3/4]" />
                    )) : <p className="col-span-3 bg-panel py-10 text-center text-sm text-muted">Aucune offre relevée</p>}
                  </div>
                  <div className="p-5 pt-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-muted">{s.inBand ? <>{s.inBand} entre {s.floor ? euros(s.floor) : "0 €"} et {euros(s.budget)}</> : "Aucun dans cette tranche"}</p>
                    <span className="text-sm font-bold text-red group-hover:translate-x-1 transition-transform" aria-hidden>Voir →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ——— Comment ça marche ——— */}
        <section aria-labelledby="comment" className="pt-20">
          <p className="tag text-red">Méthode</p>
          <h2 id="comment" className="display text-3xl sm:text-5xl mt-3">Comment ça marche</h2>
          <ol className="grid md:grid-cols-3 gap-4 mt-8">
            {[
              ["01", "Ton budget", "Le plafond inclut la livraison et les frais obligatoires. Une offre à 395 € avec 10 € de frais dépasse un budget de 400 €."],
              ["02", "Trois questions", "L'état d'achat, ce qui compte le plus pour toi, et iPhone ou Android. Tu peux revenir en arrière sans rien perdre."],
              ["03", "Un choix expliqué", "Un premier choix, jusqu'à deux alternatives et la raison en clair, à partir d'offres vérifiées et datées."],
            ].map(([n, t, d]) => (
              <li key={n} className="relative bg-panel border border-line p-6 cut overflow-hidden">
                <p className="display text-red text-4xl">{n}</p>
                <h3 className="display text-xl mt-3">{t}</h3>
                <p className="text-muted mt-2">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ——— Par marque ——— */}
        <section aria-labelledby="marques" className="pt-20">
          <p className="tag text-red">Catalogue</p>
          <h2 id="marques" className="display text-3xl sm:text-5xl mt-3">Par marque</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-8">
            {brandTiles.map((b) => (
              <li key={b.id}>
                <Link href={`/catalogue?marque=${b.id}`} className="card-link group block bg-panel border border-line cut-sm p-5 h-full">
                  <p className="display text-2xl group-hover:text-red transition-colors">{b.name}</p>
                  <p className="text-sm text-muted mt-2 tabular-nums">
                    {b.n} modèle{b.n > 1 ? "s" : ""}{Number.isFinite(b.from) && <> · dès {euros(b.from)}</>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ——— Appel final ——— */}
        <section className="mt-20 relative overflow-hidden border border-red cut bg-[linear-gradient(120deg,#1d1213,#0f0f11_60%)] p-8 sm:p-12">
          <div className="halo absolute -right-40 -top-40 w-[28rem] h-[28rem]" aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="display text-3xl sm:text-5xl">Une minute pour <span className="text-red">bien choisir</span></h2>
            <p className="text-muted mt-3 text-lg">Sans inscription, sans cookie publicitaire, sans vendeur qui paie pour passer devant.</p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/trouver" className="btn btn-primary">Trouver mon smartphone</Link>
              <Link href="/comparer" className="btn btn-secondary">Comparer des modèles</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
