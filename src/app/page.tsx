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
    const under = all.filter((m) => lowest(m) <= b);
    const withTotal = under.filter((m) => [[m.minNew, m.newKind], [m.minRefurb, m.refurbKind]].some(([p, k]) => k === "total" && (p as number) <= b)).length;
    return { budget: b, floor, count: under.length, withTotal, inBand: band.length, picks: band.slice(0, 3) };
  });

  const count = new Map<string, number>();
  for (const m of all) count.set(m.brand_id, (count.get(m.brand_id) ?? 0) + 1);
  const brandTiles = allBrands
    .map((b) => ({ ...b, n: count.get(b.id) ?? 0, from: Math.min(...all.filter((m) => m.brand_id === b.id).map(lowest)) }))
    .filter((b) => b.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <div className="overflow-x-clip">
      {/* ——— Héros : grand titre, budget, et l'écran des 3 choix ——— */}
      <section className="relative bg-[linear-gradient(180deg,var(--page)_0%,var(--panel)_100%)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center pt-12 pb-16 sm:pt-20 lg:pb-24">
          <div className="rise">
            <p className="eyebrow">Neuf · Reconditionné · Occasion</p>
            <h1 className="display text-[2.9rem] sm:text-7xl xl:text-[5.5rem] mt-4">
              Le bon smartphone.
              <br />
              <span className="text-red">Au juste prix.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted mt-6 max-w-xl leading-relaxed">
              Donne ton budget, réponds à 3 questions rapides : PickJust te propose 3 téléphones, avec des prix relevés chez les vendeurs et la raison de chaque choix.
            </p>
            <div className="mt-9">
              <BudgetForm />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2" aria-label="Budgets fréquents">
              <span className="text-sm text-muted mr-1">Budgets fréquents :</span>
              {QUICK.map((b) => (
                <Link key={b} href={`/trouver?budget=${b}`} className="chip">{euros(b)}</Link>
              ))}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[22rem] rise rise-2 hidden sm:block">
            <div className="halo absolute -inset-24" aria-hidden />
            <PhoneIllustration className="relative w-[82%] mx-auto drop-shadow-[0_40px_60px_rgba(15,15,18,0.22)] float" />
          </div>
        </div>
      </section>

      {/* ——— Chiffres clés ——— */}
      <section aria-label="Le catalogue en chiffres" className="mx-auto max-w-7xl px-4 sm:px-6 pt-14 sm:pt-20">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6 text-center">
          {[
            [String(totals.published), "smartphones référencés"],
            [String(totals.priced), "modèles avec un prix récent (moins de 7 jours)"],
            [String(totals.recentOffers), "offres récentes relevées chez les vendeurs"],
            ["0 €", "payé par un vendeur pour être classé"],
          ].map(([v, l]) => (
            <div key={l} className="flex flex-col-reverse">
              <dt className="text-sm text-muted mt-2">{l}</dt>
              <dd className="display text-4xl sm:text-6xl tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {updated && (
          <p className="mt-8 text-sm text-muted flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="live" aria-hidden /> Prix actualisés le {dateTimeFr(updated)} ·{" "}
            <Link href="/couverture" className="underline underline-offset-2 hover:text-text">sources et lacunes</Link>
          </p>
        )}
      </section>

      {/* ——— Par budget ——— */}
      <section aria-labelledby="budgets" className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 sm:pt-32">
        <div className="text-center max-w-2xl mx-auto">
          <p className="eyebrow">Guides</p>
          <h2 id="budgets" className="display text-4xl sm:text-6xl mt-3">Les meilleurs par budget</h2>
          <p className="text-muted text-lg mt-4">Les modèles dont le prix relevé entre dans ton plafond : frais inclus quand le vendeur les publie, sinon signalés « hors frais ».</p>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-12">
          {showcase.map((s) => (
            <li key={s.budget}>
              <Link href={`/meilleurs-smartphones/${s.budget}`} className="card-link group flex flex-col h-full bg-panel rounded-[28px] overflow-hidden">
                <div className="px-6 pt-7 text-center">
                  <p className="display text-3xl sm:text-4xl">Jusqu&apos;à {euros(s.budget)}</p>
                  <p className="text-sm text-muted mt-2 tabular-nums">{s.count} modèle{s.count > 1 ? "s" : ""}{s.count > 0 && (s.withTotal === 0 ? " · frais à vérifier" : s.withTotal === s.count ? " · frais inclus" : `, dont ${s.withTotal} frais inclus`)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 px-5 mt-6">
                  {s.picks.length ? s.picks.map((m) => (
                    <PhotoFrame key={m.id} media={m.thumb} alt={m.name} form={m.form_factor} className="aspect-[3/4] rounded-2xl" />
                  )) : <p className="col-span-3 py-10 text-center text-sm text-muted">Aucune offre relevée</p>}
                </div>
                <div className="px-6 pt-5 pb-7 mt-auto flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-muted">{s.inBand ? <>{s.inBand} entre {s.floor ? euros(s.floor) : "0 €"} et {euros(s.budget)}</> : "Aucun dans cette tranche"}</p>
                  <span className="btn btn-ghost min-h-[40px] text-sm group-hover:bg-ink group-hover:text-white transition-colors" aria-hidden>Voir la sélection</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-center mt-8"><Link href="/meilleurs-smartphones" className="link-arrow">Tous les budgets</Link></p>
      </section>

      {/* ——— Comment ça marche : bandeau sombre pleine largeur ——— */}
      <section aria-labelledby="comment" className="mt-24 sm:mt-32 bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow !text-[#ff6b70]">Méthode</p>
            <h2 id="comment" className="display text-4xl sm:text-6xl mt-3">3 choix. Pas 300.</h2>
            <p className="text-white/70 text-lg mt-4 max-w-2xl">Au lieu d&apos;un catalogue infini, une courte sélection adaptée à toi, et la raison de chaque choix.</p>
          </div>
          <ol className="grid md:grid-cols-3 gap-10 md:gap-8 mt-14">
            {[
              ["01", "Ton budget", "Le plafond inclut la livraison et les frais obligatoires. Une offre à 395 € avec 10 € de frais dépasse un budget de 400 €."],
              ["02", "3 questions rapides", "L'état, ta priorité et iPhone ou Android. Tu peux ensuite affiner : taille d'écran, stockage, usage et durée de conservation."],
              ["03", "3 choix expliqués", "Processeur, mémoire, stockage et batterie, des jauges pour comparer, et pourquoi chaque téléphone est fait pour toi."],
            ].map(([n, t, d]) => (
              <li key={n} className="border-t border-white/15 pt-6">
                <p className="display text-5xl text-white/30 tabular-nums">{n}</p>
                <h3 className="display text-2xl mt-4">{t}</h3>
                <p className="text-white/70 mt-3 leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
          <Link href="/trouver" className="btn btn-red mt-14">Trouver mon smartphone</Link>
        </div>
      </section>

      {/* ——— Par marque ——— */}
      <section aria-labelledby="marques" className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 sm:pt-32">
        <div className="text-center max-w-2xl mx-auto">
          <p className="eyebrow">Catalogue</p>
          <h2 id="marques" className="display text-4xl sm:text-6xl mt-3">Par marque</h2>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-12">
          {brandTiles.map((b) => (
            <li key={b.id}>
              <Link href={`/catalogue?marque=${b.id}`} className="card-link group block bg-panel rounded-3xl px-5 py-7 h-full text-center">
                <p className="display text-2xl">{b.name}</p>
                <p className="text-sm text-muted mt-2 tabular-nums">
                  {b.n} modèle{b.n > 1 ? "s" : ""}{Number.isFinite(b.from) && <> · dès {euros(b.from)}</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ——— Appel final ——— */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-24 sm:mt-32">
        <div className="relative overflow-hidden rounded-[32px] bg-panel px-6 py-16 sm:py-24 text-center">
          <div className="halo absolute left-1/2 -translate-x-1/2 -top-48 w-[40rem] h-[40rem]" aria-hidden />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="display text-4xl sm:text-6xl">Une minute pour <span className="text-red">bien choisir</span>.</h2>
            <p className="text-muted mt-4 text-lg">Sans inscription, sans cookie publicitaire, sans vendeur qui paie pour passer devant.</p>
            <div className="flex flex-wrap justify-center gap-3 mt-9">
              <Link href="/trouver" className="btn btn-primary">Trouver mon smartphone</Link>
              <Link href="/comparer" className="btn btn-ghost">Comparer des modèles</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
