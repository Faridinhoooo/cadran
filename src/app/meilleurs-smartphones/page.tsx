import type { Metadata } from "next";
import Link from "next/link";
import { budgetGuide, GUIDE_BUDGETS } from "@/lib/budget-guide";
import { candidates } from "@/lib/queries";
import { euros } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Meilleurs smartphones par budget",
  description: "Quel smartphone acheter à 150, 200, 300, 400, 500 € ou plus ? Sélections par usage d'après les prix relevés en France.",
  alternates: { canonical: "/meilleurs-smartphones" },
};

export default function Page() {
  const today = new Date();
  const models = candidates();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="display text-4xl sm:text-6xl">Meilleurs smartphones <span className="text-red">par budget</span></h1>
      <p className="text-muted mt-3 max-w-3xl">Pour chaque budget : le moins cher, le meilleur pour la photo, l&apos;autonomie, les jeux, la prise en main et le suivi logiciel, recalculés à partir des prix du jour.</p>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {GUIDE_BUDGETS.map((b) => {
          const g = budgetGuide(b, models, today);
          const cheapest = g.winners.find((w) => w.priority === "prix")?.item;
          return (
            <li key={b} className="relative bg-panel rounded-3xl hover:border-text/30 p-5 flex flex-col gap-2">
              <h2 className="display text-3xl">
                <Link href={`/meilleurs-smartphones/${b}`} className="after:absolute after:inset-0 hover:text-red">{euros(b)}</Link>
              </h2>
              <p className="text-sm text-muted">{g.offers.length ? `${g.models} modèles · ${g.offers.length} offres` : "Pas encore d'offre relevée"}</p>
              {cheapest && <p className="text-sm">Dès {euros(cheapest.total ?? cheapest.shown)} : {cheapest.entry.model.name}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
