import type { Metadata } from "next";
import Link from "next/link";
import { configsFor, getBrand, getModel, mediaFor, specsFor, specMap, supportFor } from "@/lib/queries";
import { CONDITION_LABELS, PRIORITY_LABELS, isFresh, offerTotal, type Priority } from "@/lib/engine";
import { parseAnswers, toParams } from "@/lib/answers";
import { priceStatus, priceText } from "@/lib/price";
import { NR, euros, releaseLabel, specText, storageLabel } from "@/lib/format";
import { securityDeadline, securityHeadline, upgradesDeadline } from "@/lib/support";
import { Thumb } from "@/components/ui";
import { DiffTable, type DiffRow } from "@/components/DiffTable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comparer des smartphones", description: "Compare jusqu'à quatre smartphones côte à côte : prix relevés, écran, puce, photo, autonomie et durée des mises à jour, avec la source de chaque valeur.", alternates: { canonical: "/comparer" } };

const KEYS: [string, string, string][] = [
  ["Écran", "screen_in", "Diagonale"], ["Écran", "screen_tech", "Technologie"], ["Écran", "resolution", "Résolution"], ["Écran", "refresh_hz", "Fréquence"],
  ["Format", "height_mm", "Hauteur"], ["Format", "width_mm", "Largeur"], ["Format", "thickness_mm", "Épaisseur"], ["Format", "weight_g", "Poids"],
  ["Performances", "chip", "Processeur"], ["Performances", "ram_gb", "RAM"], ["Performances", "expandable", "Extension microSD"],
  ["Photo et vidéo", "cameras", "Appareils photo"], ["Photo et vidéo", "ois", "Stabilisation optique"], ["Photo et vidéo", "optical_zoom", "Zoom optique"], ["Photo et vidéo", "video", "Vidéo"],
  ["Batterie", "battery_mah", "Capacité"], ["Batterie", "charge_w", "Charge filaire"], ["Batterie", "wireless", "Sans fil"],
  ["Connectivité", "five_g", "5G"], ["Connectivité", "esim", "eSIM"], ["Connectivité", "nfc", "NFC"], ["Connectivité", "ip", "Indice de protection"],
];

/** Groupe de lignes affiché juste après le prix, selon la priorité principale. */
const PRIORITY_GROUP: Partial<Record<Priority, string>> = {
  photo: "Photo et vidéo", longevite: "Suivi logiciel", jeux: "Performances", une_main: "Format", autonomie: "Batterie",
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ids = (Array.isArray(sp.ids) ? sp.ids[0] : sp.ids) ?? "";
  const today = new Date();
  // Contexte des résultats (budget, priorité, état…) : transmis par « Comparer mes choix », absent depuis le catalogue.
  const answers = sp.budget ? parseAnswers(sp) : null;
  const wanted = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3).map((s) => {
    const [id, go, cond] = s.split(":");
    return { id, go: go ? Number(go) : null, cond: cond === "neuf" || cond === "reconditionne" ? cond : null };
  });
  const items = wanted.map(({ id, go, cond }) => {
    const m = getModel(id);
    if (!m) return null;
    const configs = configsFor(id);
    const sel = configs.find((c) => c.storage_gb === go) ?? configs.find((c) => c.offers.some((o) => isFresh(o, today))) ?? configs[0] ?? null;
    // Meilleure offre récente : une offre frais inclus passe devant une offre hors frais, puis la moins chère.
    const best = (c: string) => sel?.offers.filter((o) => o.condition === c && isFresh(o, today))
      .sort((a, b) => Number(offerTotal(a) === null) - Number(offerTotal(b) === null) || priceStatus(a).amount - priceStatus(b).amount)[0] ?? null;
    const neuf = best("neuf"), reco = best("reconditionne");
    // Offre de référence : celle de l'état recommandé, sinon la moins chère des deux.
    const ref = cond === "neuf" ? neuf : cond === "reconditionne" ? reco
      : [neuf, reco].filter((o): o is NonNullable<typeof o> => !!o).sort((x, y) => priceStatus(x).amount - priceStatus(y).amount)[0] ?? null;
    return { m, configs, sel, cond, specs: specMap(specsFor(id)), support: supportFor(id), thumb: mediaFor(id)[0] ?? null, brand: getBrand(m.brand_id), neuf, reco, ref };
  }).filter((x): x is NonNullable<typeof x> => !!x);

  const context = answers ? toParams(answers).toString() : "";
  const backToResults = answers ? `/resultats?${context}` : null;

  if (items.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <h1 className="display text-4xl sm:text-6xl">Comparer</h1>
        <p className="text-muted mt-4">Choisis deux ou trois téléphones dans le catalogue avec le bouton « + Comparer », puis reviens ici.</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href="/catalogue" className="btn btn-primary">Ouvrir le catalogue</Link>
          {backToResults && <Link href={backToResults} className="btn btn-ghost">← Retour à mes résultats</Link>}
        </div>
      </div>
    );
  }

  const key = (it: (typeof items)[number], go?: number) => [it.m.id, go ?? it.sel?.storage_gb, it.cond].filter((x) => x !== undefined && x !== null).join(":");
  const param = (override: { id: string; go: number }) =>
    items.map((it) => (it.m.id === override.id ? key(it, override.go) : key(it))).join(",");
  const href = (q: string) => `/comparer?ids=${q}${context ? `&${context}` : ""}`;
  const ficheHref = (it: (typeof items)[number]) =>
    `/telephone/${it.m.id}?${new URLSearchParams({ ...(it.sel ? { go: String(it.sel.storage_gb) } : {}), ...(it.cond ? { etat: it.cond } : {}) })}`;
  const budget = answers?.budget ?? null;

  const priceRows: DiffRow[] = [
    { group: "Prix", label: "Capacité", values: items.map((i) => (i.sel ? storageLabel(i.sel.storage_gb) : NR)) },
    ...(answers ? [{ group: "Prix", label: `Offre recommandée (budget ${euros(answers.budget)})`, values: items.map((i) => (i.ref ? `${priceText(i.ref, budget)} · ${CONDITION_LABELS[i.ref.condition]} · ${i.ref.seller}` : "Aucune offre récente")) }] : []),
    { group: "Prix", label: "Neuf", values: items.map((i) => (i.neuf ? `${priceText(i.neuf)} · ${i.neuf.seller}` : "Aucune offre récente")) },
    { group: "Prix", label: "Reconditionné", values: items.map((i) => (i.reco ? `${priceText(i.reco)} · ${i.reco.seller}` : "Aucune offre récente")) },
  ];
  const followRows: DiffRow[] = [
    { group: "Suivi logiciel", label: "Correctifs de sécurité", values: items.map((i) => securityHeadline(securityDeadline(i.support, today))) },
    { group: "Suivi logiciel", label: "Nouvelles versions du système", values: items.map((i) => {
      const u = upgradesDeadline(i.support, today);
      return u.state === "en_cours" ? `Jusqu'${u.precision === "mois" ? "en" : "au"} ${u.dateLabel}` : u.state === "inconnue" ? "Fin non annoncée" : "Terminées";
    }) },
    { group: "Suivi logiciel", label: "Sortie", values: items.map((i) => { const r = releaseLabel(i.m); return r.note ? `${r.date} (mondiale)` : r.date; }) },
    { group: "Suivi logiciel", label: "Origine de la marque", values: items.map((i) => i.brand?.origin_country ?? NR) },
  ];
  const specRows: DiffRow[] = KEYS.map(([group, k, label]) => ({
    group, label,
    values: items.map((i) => (k === "ram_gb" && i.sel?.ram_gb ? specText(k, i.sel.ram_gb) : specText(k, i.specs[k]))),
  }));
  // Prix d'abord, puis les lignes liées à la priorité (photo avant processeur, suivi en tête pour la longévité…).
  const focus = answers ? PRIORITY_GROUP[answers.priorities[0]] : undefined;
  const all = [...priceRows, ...followRows, ...specRows];
  const rows = focus ? [...priceRows, ...all.filter((r) => r.group === focus), ...all.filter((r) => r.group !== "Prix" && r.group !== focus)] : all;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-4xl sm:text-6xl">Comparer</h1>
        {backToResults && <Link href={backToResults} className="btn btn-ghost min-h-[44px] text-sm">← Retour à mes résultats</Link>}
      </div>
      {answers && (
        <p className="text-sm text-muted mt-2">
          Tes {items.length} choix dans l&apos;ordre du classement · budget {euros(answers.budget)} · priorité : {PRIORITY_LABELS[answers.priorities[0]]}.
        </p>
      )}
      <ol className={`grid gap-4 mt-6 ${items.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
        {items.map((i, n) => (
          <li key={i.m.id} className="bg-panel rounded-3xl p-4 flex gap-4 sm:flex-col">
            <Thumb media={i.thumb} alt={i.m.name} form={i.m.form_factor} size={96} />
            <div className="min-w-0">
              {answers && <p className="text-xs font-bold text-red">N°{n + 1}</p>}
              <h2 className="font-extrabold text-lg leading-tight"><Link href={ficheHref(i)} className="hover:text-red">{i.m.name}</Link></h2>
              {i.ref && <p className="text-sm mt-1">{priceText(i.ref, budget)}</p>}
              {i.configs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label={`Capacité du ${i.m.name}`}>
                  {i.configs.map((c) => (
                    <Link key={c.id} href={href(param({ id: i.m.id, go: c.storage_gb }))} aria-current={c.id === i.sel?.id ? "true" : undefined}
                      className={`px-3.5 py-1.5 min-h-[40px] grid place-items-center text-sm border-2 rounded-full font-semibold ${c.id === i.sel?.id ? "border-red" : "border-line"}`}>
                      {storageLabel(c.storage_gb)}
                    </Link>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href={ficheHref(i)} className="btn btn-ghost min-h-[40px] text-sm">Voir la fiche</Link>
                {i.ref && (
                  <a href={i.ref.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost min-h-[40px] text-sm">
                    Chez {i.ref.seller} ↗<span className="sr-only"> (nouvel onglet)</span>
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        <DiffTable names={items.map((i) => i.m.name)} rows={rows} />
      </div>
      <p className="text-xs text-muted mt-3">
        Caractéristiques annoncées par les fabricants. Prix pour la capacité choisie, offres relevées il y a moins de 7 jours.
        Une valeur « Non renseigné » n&apos;est jamais comptée comme un avantage.
      </p>
    </div>
  );
}
