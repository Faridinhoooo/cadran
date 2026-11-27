import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { parseAnswers, toParams, withPatch } from "@/lib/answers";
import { CONDITION_LABELS, OFFER_MAX_AGE_DAYS, PRIORITY_LABELS, recommend, topChoices, type Answers, type Condition, type Funnel, type Priority, type Recommendation, type VerifyCard } from "@/lib/engine";
import { brands, candidates, catalogSummaries, marketFor, merchantSyncs, thumbnails } from "@/lib/queries";
import { dateTimeFr, euros, sourceLabel, storageLabel } from "@/lib/format";
import { GUIDE_BUDGETS } from "@/lib/budget-guide";
import { SecurityLine, Thumb, BudgetGauge } from "@/components/ui";
import { ShopLinks } from "@/components/ShopLinks";
import { ChoicesSection } from "@/components/Choices";
import { PriceTag } from "@/components/PriceTag";
import { scales } from "@/lib/scales";
import { shopLinks } from "@/lib/shop-links";
import { keepYearsVerdict } from "@/lib/support";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ton résultat", robots: { index: false, follow: true } };

const PRIO_SHORT: Record<Priority, string> = {
  photo: "Photos et vidéos", autonomie: "Autonomie", jeux: "Jeux exigeants", une_main: "Utilisation à une main", longevite: "Le garder longtemps", prix: "Dépenser le moins possible",
};

function EditRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <details className="bg-panel rounded-3xl group">
      <summary className="cursor-pointer list-none px-4 py-3 min-h-[52px] flex flex-wrap items-center gap-x-3">
        <span className="text-xs uppercase tracking-wider text-muted font-bold">{label}</span>
        <span className="font-semibold">{value}</span>
        <span className="ml-auto text-sm text-red underline">Modifier</span>
      </summary>
      <div className="px-4 pb-4 flex flex-wrap gap-2">{children}</div>
    </details>
  );
}

function Opt({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={`/resultats?${href}`} aria-current={on ? "true" : undefined} className={`px-4 py-2.5 border rounded-full text-sm font-semibold ${on ? "border-red bg-red-soft" : "border-line hover:border-text/30"}`}>
      {on && <span aria-hidden>✓ </span>}
      {children}
    </Link>
  );
}

function PickCard({ p, rank, today, answers }: { p: Recommendation; rank: number; today: Date; answers: Answers }) {
  const thumbs = thumbnails();
  const market = answers.conditions.includes("occasion") ? marketFor(p.config.id, today) : null;
  const first = rank === 0;
  return (
    <article className={`bg-panel border ${first ? "border-red" : "border-line"} cut p-5 sm:p-7`} aria-labelledby={`pick-${rank}`}>
      <p className="tag mb-4"><span className="text-ok">✓ Frais inclus</span></p>
      <div className="grid sm:grid-cols-[auto_1fr] gap-5 sm:gap-7">
        <Thumb media={thumbs.get(p.model.id) ?? null} alt={p.model.name} form={p.model.form_factor} size={first ? 168 : 120} />
        <div>
          <h2 id={`pick-${rank}`} className="display text-2xl sm:text-4xl">
            <Link href={`/telephone/${p.model.id}?go=${p.config.storage_gb}`} className="hover:text-red">{p.model.name}</Link>
          </h2>
          <p className="mt-2 text-[1.05rem]">{p.why}</p>
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-muted">Capacité</dt><dd className="font-bold">{storageLabel(p.config.storage_gb)}</dd></div>
            <div><dt className="text-muted">État</dt><dd className="font-bold">{CONDITION_LABELS[p.offer.condition]}</dd></div>
            <div><dt className="text-muted">Vendeur</dt><dd className="font-bold">{p.offer.seller}{p.offer.platform && <span className="font-normal text-muted"> · {p.offer.platform}</span>}</dd></div>
            <div><dt className="text-muted">Prix total</dt><dd className="font-extrabold text-2xl tabular-nums">{euros(p.total)}</dd></div>
            <div><dt className="text-muted">Marge sous ton budget</dt><dd className="font-extrabold text-2xl tabular-nums text-ok">{euros(p.margin)}</dd></div>
            <div><dt className="text-muted">Prix relevé le</dt><dd>{dateTimeFr(p.offer.checked_at)}</dd></div>
          </dl>
          <div className="max-w-md"><BudgetGauge price={p.total} budget={answers.budget} confirmed /></div>
          <p className="mt-3"><span className="tag border-ok text-ok">✓ Dans ton budget, frais inclus</span></p>
          <div className="mt-3"><SecurityLine d={p.security} /></div>
          {answers.keepYears && <p className="text-sm mt-1 text-muted">{keepYearsVerdict(answers.keepYears, p.security).text}</p>}
        </div>
      </div>

      <section className="mt-6" aria-label="Explication">
        <h3 className="display text-lg sm:text-xl text-red">{first ? "Pourquoi ce modèle pour toi ?" : "Ce qu'il apporte par rapport à l'offre précédente"}</h3>
        {!first && (
          <ul className="flex flex-wrap gap-2 mt-2">
            {p.advantages.map((a) => <li key={a} className="tag">+ {a}</li>)}
          </ul>
        )}
        <div className="prose-tight mt-2 text-[1.05rem] leading-relaxed">
          {p.explanation.map((s) => <p key={s}>{s}</p>)}
        </div>
        {p.offerComparison && <p className="mt-3 text-sm border-l-2 border-red pl-3">{p.offerComparison}</p>}
        {market && (
          <p className="mt-3 text-sm text-muted">
            Occasion entre particuliers (cote) :{" "}
            {market.ok ? `${euros(market.median)} médian (${euros(market.p25)}–${euros(market.p75)}), ${market.count} annonces, prix demandés` : `${market.message}.`}
          </p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={p.offer.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          Voir l&apos;offre chez {p.offer.seller}<span className="sr-only"> (nouvel onglet)</span>
        </a>
        <Link href={`/telephone/${p.model.id}?go=${p.config.storage_gb}`} className="btn btn-ghost">Fiche complète</Link>
      </div>
      <div className="mt-4"><ShopLinks compact brand={p.model.brand_name} name={p.model.name} storageGb={p.config.storage_gb} /></div>
    </article>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const answers = parseAnswers(sp);
  if (!answers) redirect("/trouver");
  const today = new Date();
  const models = candidates();
  const result = recommend(answers, models, today);
  const choices = topChoices(answers, models, today);
  const brandNames = new Map(brands().map((b) => [b.id, b.name]));
  const q = (patch: Partial<Answers>) => withPatch(answers, patch);

  const condValue = answers.conditions.length === 3 ? "Comparer les trois" : answers.conditions.map((c) => CONDITION_LABELS[c]).join(" + ");
  const refine = [
    answers.minStorage ? `${storageLabel(answers.minStorage)} minimum` : null,
    answers.esim ? "eSIM indispensable" : null,
    answers.includeBrands?.length ? `Marques : ${answers.includeBrands.map((b) => brandNames.get(b) ?? b).join(", ")}` : null,
    answers.excludeBrands?.length ? `Sauf : ${answers.excludeBrands.map((b) => brandNames.get(b) ?? b).join(", ")}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="display text-2xl sm:text-3xl">Ton résultat</h1>
        <a href="#reponses" className="btn btn-ghost min-h-[44px] text-sm">Modifier mes réponses</a>
      </div>
      {choices.length > 0 && <ChoicesSection choices={choices} answers={answers} scales={scales()} thumbs={thumbnails()} today={today} usedIphones={usedIphoneModels()} />}
    <div className="mt-12 grid lg:grid-cols-[340px_1fr] gap-8 items-start">
      <aside id="reponses" aria-label="Tes réponses" className="grid gap-2 lg:sticky lg:top-20 order-2 lg:order-none scroll-mt-24">
        <h2 className="display text-xl mb-2">Tes réponses</h2>
        <form action="/resultats" method="get" className="bg-panel rounded-3xl px-4 py-3 flex flex-wrap items-end gap-2">
          {[...toParams(answers).entries()].filter(([k]) => k !== "budget").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="grid gap-1 flex-1">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Budget maximum (€)</span>
            <input name="budget" type="number" min={50} defaultValue={answers.budget} className="bg-page border border-line rounded-xl px-3 py-2 font-bold tabular-nums w-full" />
          </label>
          <button className="btn btn-ghost min-h-[42px] px-4 text-sm">Mettre à jour</button>
        </form>
        <EditRow label="État" value={condValue}>
          {(["neuf", "reconditionne", "occasion"] as Condition[]).map((c) => (
            <Opt key={c} href={q({ conditions: [c] })} on={answers.conditions.length === 1 && answers.conditions[0] === c}>{CONDITION_LABELS[c]}</Opt>
          ))}
          <Opt href={q({ conditions: ["neuf", "reconditionne"] })} on={answers.conditions.join() === "neuf,reconditionne"}>Neuf + reconditionné</Opt>
          <Opt href={q({ conditions: ["neuf", "reconditionne", "occasion"] })} on={answers.conditions.length === 3}>Les trois</Opt>
        </EditRow>
        <EditRow label="Priorité principale" value={PRIO_SHORT[answers.priorities[0]]}>
          {(Object.keys(PRIO_SHORT) as Priority[]).map((p) => (
            <Opt key={p} href={q({ priorities: [p, ...answers.priorities.slice(1).filter((x) => x !== p)] })} on={answers.priorities[0] === p}>{PRIO_SHORT[p]}</Opt>
          ))}
        </EditRow>
        <EditRow label="Seconde priorité" value={answers.priorities[1] ? PRIO_SHORT[answers.priorities[1]] : "Aucune"}>
          <Opt href={q({ priorities: [answers.priorities[0]] })} on={!answers.priorities[1]}>Aucune</Opt>
          {(Object.keys(PRIO_SHORT) as Priority[]).filter((p) => p !== answers.priorities[0]).map((p) => (
            <Opt key={p} href={q({ priorities: [answers.priorities[0], p] })} on={answers.priorities[1] === p}>{PRIO_SHORT[p]}</Opt>
          ))}
        </EditRow>
        <EditRow label="Système" value={answers.os === "ios" ? "iPhone" : answers.os === "android" ? "Android" : "Les deux me vont"}>
          <Opt href={q({ os: "ios" })} on={answers.os === "ios"}>iPhone</Opt>
          <Opt href={q({ os: "android" })} on={answers.os === "android"}>Android</Opt>
          <Opt href={q({ os: "any" })} on={answers.os === "any"}>Les deux</Opt>
        </EditRow>
        <EditRow label="Usage" value={answers.usage === "leger" ? "Léger" : answers.usage === "moyen" ? "Moyen" : answers.usage === "intensif" ? "Intensif" : "Sans préférence"}>
          <Opt href={q({ usage: null })} on={!answers.usage}>Sans préférence</Opt>
          {(["leger", "moyen", "intensif"] as const).map((u) => <Opt key={u} href={q({ usage: u })} on={answers.usage === u}>{u === "leger" ? "Léger" : u === "moyen" ? "Moyen" : "Intensif"}</Opt>)}
        </EditRow>
        <EditRow label="Taille d'écran" value={answers.size === "compact" ? "Compact" : answers.size === "standard" ? "Standard" : answers.size === "grand" ? "Grand écran" : "Sans préférence"}>
          {([["compact", "Compact"], ["standard", "Standard"], ["grand", "Grand écran"]] as const).map(([z, l]) => <Opt key={z} href={q({ size: z })} on={answers.size === z}>{l}</Opt>)}
          <Opt href={q({ size: null })} on={!answers.size}>Sans préférence</Opt>
        </EditRow>
        <EditRow label="Le garder" value={answers.keepYears ? `${answers.keepYears} an${answers.keepYears > 1 ? "s" : ""}` : "Sans préférence"}>
          <Opt href={q({ keepYears: null })} on={!answers.keepYears}>Sans préférence</Opt>
          {[1, 2, 3, 4, 5, 6].map((y) => <Opt key={y} href={q({ keepYears: y })} on={answers.keepYears === y}>{y} an{y > 1 ? "s" : ""}</Opt>)}
        </EditRow>
        <EditRow label="Affiner" value={refine.length ? refine.join(" · ") : "Aucun critère"}>
          <span className="w-full text-sm text-muted">Stockage minimum</span>
          {[null, 128, 256, 512].map((g) => <Opt key={String(g)} href={q({ minStorage: g })} on={(answers.minStorage ?? null) === g}>{g ? storageLabel(g) : "Sans préférence"}</Opt>)}
          <span className="w-full text-sm text-muted mt-2">eSIM</span>
          <Opt href={q({ esim: true })} on={!!answers.esim}>Indispensable</Opt>
          <Opt href={q({ esim: false })} on={!answers.esim}>Peu importe</Opt>
          <Link href={`/trouver?${toParams(answers)}`} className="w-full text-sm underline mt-2">Choisir des marques…</Link>
        </EditRow>
      </aside>

      <div className="grid gap-8 min-w-0 order-1 lg:order-none">
        {result.status === "ok" ? (
          <details className="group bg-panel/40 border border-line" open={choices.length === 0}>
            <summary className="cursor-pointer px-5 py-4 font-bold min-h-[52px] flex items-center justify-between gap-3">
              <span>Voir le détail et toutes les offres ({result.funnel.confirmee + result.funnel.a_verifier})</span>
              <span aria-hidden className="text-red group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="grid gap-8 p-4 sm:p-5 pt-0">
            <p className="text-muted">
              {result.admissibleModels} modèle{result.admissibleModels > 1 ? "s" : ""} distinct{result.admissibleModels > 1 ? "s" : ""} pour tes critères ·{" "}
              {result.funnel.confirmee} offre{result.funnel.confirmee > 1 ? "s" : ""} frais inclus · {result.funnel.a_verifier} offre
              {result.funnel.a_verifier > 1 ? "s" : ""} à vérifier. Classement selon {PRIORITY_LABELS[answers.priorities[0]]}
              {answers.priorities[1] ? `, puis ${PRIORITY_LABELS[answers.priorities[1]]}` : ""}.
            </p>
            {result.picks.length > 0 && (
              <section aria-labelledby="confirmees" className="grid gap-6">
                <h2 id="confirmees" className="display text-2xl sm:text-3xl">
                  Dans ton budget, <span className="text-red">frais inclus</span>
                </h2>
                {result.picks.map((p, i) => (
                  <PickCard key={p.offer.id} p={p} rank={i} today={today} answers={answers} />
                ))}
                {result.picks.length > 1 && (
                  <Link href={`/comparer?ids=${result.picks.map((p) => `${p.model.id}:${p.config.storage_gb}`).join(",")}`} className="btn btn-secondary justify-self-start">
                    Comparer ces {result.picks.length} modèles
                  </Link>
                )}
              </section>
            )}
            {result.toVerify.length > 0 && (
              <section aria-labelledby="averifier" className="grid gap-4">
                <h2 id="averifier" className="display text-2xl sm:text-3xl">
                  {result.picks.length ? (
                    <>
                      Prix sous ton budget · <span className="text-red">frais à vérifier</span>
                    </>
                  ) : (
                    <>
                      Des offres à vérifier pour ton budget de <span className="text-red">{euros(answers.budget)}</span>
                    </>
                  )}
                </h2>
                <p className="text-muted max-w-3xl">
                  Leur prix affiché respecte ton plafond, mais le vendeur ne publie pas tous ses frais (livraison calculée au panier, par exemple). Vérifie le
                  total chez le vendeur avant d&apos;acheter.
                </p>
                <ul className="grid md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                  {result.toVerify.map((v) => (
                    <VerifyOfferCard key={v.offer.id} v={v} />
                  ))}
                </ul>
              </section>
            )}
            </div>
          </details>
        ) : result.reason === "donnees" ? (
          <section className="bg-panel border border-warn/60 cut p-6 sm:p-8" aria-labelledby="donnees">
            <h2 id="donnees" className="display text-2xl sm:text-3xl">
              Nous n&apos;avons pas assez de prix récents pour répondre à cette recherche
            </h2>
            <p className="text-muted mt-2">Les modèles restent consultables dans le catalogue, avec la mention « Prix à actualiser ».</p>
            <Link href="/catalogue" className="btn btn-ghost mt-6">
              Explorer le catalogue
            </Link>
          </section>
        ) : (
          <section className="bg-panel border border-red cut p-6 sm:p-8" aria-labelledby="aucun">
            <h2 id="aucun" className="display text-2xl sm:text-3xl">
              Aucune offre trouvée avec ces critères
            </h2>
            <p className="text-muted mt-2">Voici ce qui bloque. Ton budget n&apos;est jamais relevé automatiquement : c&apos;est toi qui décides.</p>
            <ul className="mt-6 grid gap-4">
              {result.blockers.map((b) => (
                <li key={b.criterion} className="border-l-4 border-red pl-4">
                  <p className="font-semibold">{b.message}</p>
                  {b.suggestion && b.criterion !== "budget" && (
                    <Link href={`/resultats?${q(b.suggestion.patch)}`} className="btn btn-ghost mt-2 min-h-[44px] text-sm">
                      {b.suggestion.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <Link href="/catalogue" className="inline-block mt-6 underline">
              Explorer le catalogue complet
            </Link>
          </section>
        )}
        {(() => {
          const g = [...GUIDE_BUDGETS].reverse().find((b) => b <= answers.budget) ?? GUIDE_BUDGETS[0];
          return (
            <p className="text-sm">
              Envie de voir le meilleur par usage ?{" "}
              <Link href={`/meilleurs-smartphones/${g}`} className="underline">Notre sélection des meilleurs smartphones à {euros(g)}</Link>
            </p>
          );
        })()}
        <ElsewhereSection answers={answers} />
        <FunnelDetails f={result.funnel} />
        <DataFreshness />
      </div>
    </div>
    </div>
  );
}

function VerifyOfferCard({ v }: { v: VerifyCard }) {
  const thumbs = thumbnails();
  const capacity = v.config.storage_gb === 0 ? "Capacité à choisir chez le vendeur (prix de départ affiché)" : storageLabel(v.config.storage_gb);
  return (
    <li className="bg-panel rounded-3xl hover:border-text/30 transition-colors flex flex-col">
      <div className="grid grid-cols-[104px_1fr] gap-4 p-4">
        <Thumb media={thumbs.get(v.model.id) ?? null} alt={v.model.name} form={v.model.form_factor} size={104} />
        <div className="min-w-0">
          <h3 className="font-extrabold text-xl leading-tight">
            <Link href={`/telephone/${v.model.id}${v.config.storage_gb ? `?go=${v.config.storage_gb}` : ""}`} className="hover:text-red">
              {v.model.name}
            </Link>
          </h3>
          <p className="text-sm text-muted mt-1">
            {capacity} · {CONDITION_LABELS[v.offer.condition]} · {v.offer.seller}
          </p>
          <div className="mt-2"><PriceTag offer={v.offer} budget={v.shownPrice + v.headroom} size="lg" /></div>
          <BudgetGauge price={v.shownPrice} budget={v.shownPrice + v.headroom} confirmed={false} />
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-2 text-sm flex-1">
        <p>{v.why}</p>
        {v.toCheck.includes("capacite") && (
          <p className="text-muted">Prix « à partir de » publié sans capacité : vérifie la capacité correspondant à ce prix chez le vendeur.</p>
        )}
        {v.offer.shipping_note && <p className="text-xs text-muted">{v.offer.shipping_note}.</p>}
        <p className="text-xs text-muted">
          Source : {sourceLabel((v.offer as { source?: string }).source)} · prix relevé le {dateTimeFr(v.offer.checked_at)}
          {v.offer.variant_check === "ok" ? " · prix et capacité retrouvés sur la page du vendeur" : ""}
        </p>
        <a href={v.offer.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-auto min-h-[48px] text-sm">
          Vérifier chez {v.offer.seller} ↗<span className="sr-only"> {v.offer.seller}, nouvel onglet</span>
        </a>
      </div>
    </li>
  );
}

const FUNNEL_LABELS: [keyof Funnel, string][] = [
  ["confirmee", "dans ton budget, frais inclus"],
  ["a_verifier", "sous ton budget, frais à vérifier"],
  ["hors_budget", "au-dessus de ton budget"],
  ["systeme", "écartées : système non choisi"],
  ["etat", "écartées : état non choisi"],
  ["stockage", "écartées : stockage insuffisant ou capacité non précisée"],
  ["esim", "écartées : eSIM non confirmée"],
  ["marques", "écartées : filtre de marques"],
  ["perime", `écartées : prix relevé il y a plus de ${OFFER_MAX_AGE_DAYS} jours`],
  ["indisponible", "écartées : indisponibles ou en rupture"],
  ["variante", "écartées : prix ou capacité absents de la page vendeur"],
  ["demo", "écartées : données de démonstration"],
];

function FunnelDetails({ f }: { f: Funnel }) {
  return (
    <details className="bg-panel rounded-3xl">
      <summary className="cursor-pointer px-4 py-3 min-h-[48px] font-semibold">Comment ces résultats ont été établis ({f.total} offres relevées)</summary>
      <ul className="px-4 pb-4 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {FUNNEL_LABELS.filter(([k]) => f[k] > 0).map(([k, l]) => (
          <li key={k} className="flex justify-between gap-3 border-b border-line py-1">
            <span className="text-muted">{l}</span>
            <strong className="tabular-nums">{f[k]}</strong>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DataFreshness() {
  const syncs = merchantSyncs();
  return (
    <div className="text-xs text-muted grid gap-1">
      <p>
        Offres retenues : en vente, relevées il y a moins de {OFFER_MAX_AGE_DAYS} jours, capacité exacte. « Frais inclus » seulement si tous les frais sont connus.
        Une cote d&apos;occasion n&apos;est jamais présentée comme une offre. Aucun vendeur ne paie pour son classement (<Link href="/classement" className="underline">critères de classement</Link>).{" "}
        <Link href="/couverture" className="underline">
          Sources et méthode
        </Link>
        .
      </p>
      <p>
        Derniers relevés réussis :{" "}
        {syncs.map((x, i) => (
          <span key={x.source}>
            {i > 0 && " · "}
            {x.source} {x.lastOk ? dateTimeFr(x.lastOk) : "jamais"}
            {x.lastFailed && <span className="text-warn"> (dernière tentative en échec, relevé précédent conservé)</span>}
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * Modèles du catalogue qui respectent les critères mais dont le prix n'est pas vérifié ici (rupture, prix « à partir de »,
 * prix ancien) : leur dernier prix connu passe sous le budget. Ils ne sont pas classés comme des offres ; on renvoie vers
 * les vendeurs pour vérifier. Plus un lien de recherche générale pour les marques sans aucun prix relevé.
 */
function ElsewhereSection({ answers }: { answers: Answers }) {
  const thumbs = thumbnails();
  const models = catalogSummaries()
    .filter((m) => m.minNew === null && m.minRefurb === null && m.priceNote && m.priceNote.price <= answers.budget)
    .filter((m) => answers.os === "any" || m.os === answers.os)
    .filter((m) => !answers.includeBrands?.length || answers.includeBrands.includes(m.brand_id))
    .filter((m) => !answers.excludeBrands?.includes(m.brand_id))
    .sort((a, b) => (b.priceNote!.price - a.priceNote!.price))
    .slice(0, 4);
  const os = answers.os === "ios" ? "iPhone" : answers.os === "android" ? "smartphone Android" : "smartphone";
  const general = shopLinks("", `${os} moins de ${answers.budget} €`)[0].url;
  return (
    <section aria-labelledby="ailleurs-res" className="grid gap-4">
      <h2 id="ailleurs-res" className="display text-2xl sm:text-3xl">À regarder aussi, <span className="text-red">prix à vérifier ailleurs</span></h2>
      <p className="text-muted max-w-3xl">
        Ces modèles correspondent à ton système, mais PickJust n&apos;a pas de prix vérifié aujourd&apos;hui (rupture, prix « à partir de »,
        prix ancien). Leur dernier prix connu passe sous ton budget : vérifie-le chez les vendeurs.
      </p>
      {models.length > 0 && (
        <ul className="grid md:grid-cols-2 gap-4">
          {models.map((m) => (
            <li key={m.id} className="bg-panel rounded-3xl p-4 grid grid-cols-[88px_1fr] gap-4">
              <Thumb media={thumbs.get(m.id) ?? null} alt={m.name} form={m.form_factor} size={88} />
              <div className="min-w-0">
                <h3 className="font-extrabold text-lg leading-tight"><Link href={`/telephone/${m.id}`} className="hover:text-red">{m.name}</Link></h3>
                <p className="text-sm text-warn font-semibold mt-1">
                  {m.priceNote!.kind === "rupture" ? `En rupture chez ${m.priceNote!.seller}` : m.priceNote!.kind === "depart" ? "Prix « à partir de » seulement" : "Prix à actualiser"}
                </p>
                <p className="text-xs text-muted">Dernier prix relevé : {euros(m.priceNote!.price)}</p>
                <div className="mt-2"><ShopLinks compact title="Voir les prix" brand={m.brand_name} name={m.name} /></div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        D&apos;autres marques (OPPO, vivo, HONOR, OnePlus…) n&apos;ont pas encore de prix sur PickJust :{" "}
        <a href={general} target="_blank" rel="noopener noreferrer nofollow" className="underline font-semibold hover:text-red">
          voir les {os === "iPhone" ? "iPhone" : "smartphones"} à moins de {euros(answers.budget)} sur Google Shopping ↗
        </a>
        <span className="text-muted"> (lien neutre, sans affiliation).</span>
      </p>
    </section>
  );
}

/** iPhone « classiques » récents (hors Pro, Plus, Air) du catalogue, du plus ancien au plus récent : les plus abordables en occasion. */
function usedIphoneModels(): string[] {
  return catalogSummaries()
    .filter((m) => m.brand_id === "apple" && /^iPhone \d+e?$/.test(m.name) && (m.release_date ?? "") >= "2023")
    .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""))
    .slice(0, 3)
    .map((m) => m.name);
}
