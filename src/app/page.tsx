import Link from "next/link";
import { BudgetForm } from "@/components/BudgetForm";
import { PhoneIllustration } from "@/components/ui";
import { coverage, lastUpdate } from "@/lib/queries";
import { dateTimeFr, euros } from "@/lib/format";
import { GUIDE_BUDGETS } from "@/lib/budget-guide";

export const dynamic = "force-dynamic";

export default function Home() {
  const { totals } = coverage();
  const updated = lastUpdate();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center pt-8 pb-16 lg:pt-16 overflow-x-clip">
        <div>
          <p className="tag text-red mb-5">Neuf · Reconditionné · Occasion</p>
          <h1 className="display text-[2.7rem] leading-[0.92] sm:text-7xl xl:text-8xl">
            Quel smartphone pour <span className="text-red">ton budget</span>&nbsp;?
          </h1>
          <div className="mt-8">
            <BudgetForm />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/catalogue" className="btn btn-ghost">
              Explorer le catalogue
            </Link>
            <span className="text-sm text-muted">Trois questions, environ une minute, sans inscription.</span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
          <div className="halo absolute -inset-16" aria-hidden />
          <PhoneIllustration className="relative w-[70%] mx-auto drop-shadow-[0_30px_60px_rgba(255,52,52,0.25)]" />
        </div>
      </section>

      <section aria-labelledby="comment" className="grid md:grid-cols-3 gap-4 pb-12">
        <h2 id="comment" className="sr-only">Comment ça marche</h2>
        {[
          ["01", "Ton budget", "Le plafond inclut la livraison et les frais obligatoires. Une offre à 395 € avec 10 € de frais dépasse un budget de 400 €."],
          ["02", "Trois questions", "L'état d'achat, ce qui compte le plus pour toi, et iPhone ou Android. Tu peux revenir en arrière sans rien perdre."],
          ["03", "Un choix expliqué", "Un premier choix, jusqu'à deux alternatives et la raison en clair, à partir d'offres vérifiées et datées."],
        ].map(([n, t, d]) => (
          <div key={n} className="bg-panel border border-line p-6 cut">
            <p className="display text-red text-4xl">{n}</p>
            <h3 className="display text-xl mt-3">{t}</h3>
            <p className="text-muted mt-2">{d}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="budgets" className="pb-12">
        <h2 id="budgets" className="display text-2xl sm:text-3xl">Les meilleurs par budget</h2>
        <ul className="flex flex-wrap gap-2 mt-4">
          {GUIDE_BUDGETS.map((b) => (
            <li key={b}>
              <Link href={`/meilleurs-smartphones/${b}`} className="btn btn-ghost min-h-[48px] text-sm">À {euros(b)}</Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted pb-4">
        {totals.models} modèles référencés depuis 2023 · {totals.offers} offres vérifiées en cours
        {updated && <> · actualisé le {dateTimeFr(updated)}</>} ·{" "}
        <Link href="/couverture" className="underline">voir la couverture et les lacunes</Link>
      </p>
    </div>
  );
}
