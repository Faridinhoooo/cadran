import type { Metadata } from "next";
import Link from "next/link";
import { brandAliases, brands, catalogSummaries, seriesList } from "@/lib/queries";
import { searchModels } from "@/lib/search";
import { euros } from "@/lib/format";
import { shopLinks } from "@/lib/shop-links";
import { SEGMENT_LABELS, segmentOf } from "@/lib/chips";
import { deadline, type Deadline } from "@/lib/support";
import { Crumbs, PhotoFrame } from "@/components/ui";
import { CompareToggle, CompareTray } from "@/components/CompareTray";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catalogue des smartphones", description: "Les smartphones vendus en France depuis 2023 : caractéristiques, durée des mises à jour et prix relevés chez le vendeur quand ils sont fiables. Filtres par marque, budget, système, format et année.", alternates: { canonical: "/catalogue" } };

const PAGE = 48;
type SP = Record<string, string | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = new Date();
  const all = catalogSummaries();
  const allBrands = brands();
  const series = seriesList();
  const q = sp.q ?? "";

  let list = searchModels(all, q, brandAliases());
  if (sp.marque) {
    const ids = new Set([sp.marque, ...allBrands.filter((b) => b.parent_id === sp.marque).map((b) => b.id)]);
    list = list.filter((m) => ids.has(m.brand_id));
  }
  if (sp.gamme) list = list.filter((m) => m.series_id === sp.gamme);
  if (sp.os === "ios" || sp.os === "android") list = list.filter((m) => m.os === sp.os);
  if (sp.forme) list = list.filter((m) => m.form_factor === sp.forme);
  if (sp.segment === "entree" || sp.segment === "milieu" || sp.segment === "haut") list = list.filter((m) => segmentOf(m.specs) === sp.segment);
  if (sp.annee) list = list.filter((m) => m.release_date?.startsWith(sp.annee!));
  if (sp.offre === "1") list = list.filter((m) => m.minNew !== null || m.minRefurb !== null);
  if (sp.fr === "1") list = list.filter((m) => m.fr_status === "confirme");
  const max = Number(sp.max);
  if (max > 0) list = list.filter((m) => [m.minNew, m.minRefurb].some((p) => p !== null && p <= max));
  if (sp.tri === "prix") list = [...list].sort((a, b) => (Math.min(a.minNew ?? 1e9, a.minRefurb ?? 1e9) - Math.min(b.minNew ?? 1e9, b.minRefurb ?? 1e9)));
  // Tri par défaut : les téléphones avec un prix vérifié d'abord (tri stable : l'ordre par date est conservé dans chaque groupe).
  if (!sp.tri) list = [...list].sort((a, b) => Number(a.minNew === null && a.minRefurb === null) - Number(b.minNew === null && b.minRefurb === null));
  if (sp.tri === "nom") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const page = Math.max(1, Number(sp.page) || 1);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice((page - 1) * PAGE, page * PAGE);
  const href = (patch: SP) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    if (!("page" in patch)) p.delete("page");
    return `/catalogue?${p}`;
  };

  const brandCount = new Map<string, number>();
  for (const m of all) brandCount.set(m.brand_id, (brandCount.get(m.brand_id) ?? 0) + 1);
  const brand = allBrands.find((b) => b.id === sp.marque);
  const brandSeries = series.filter((s) => s.brand_id === sp.marque);
  const serie = series.find((s) => s.id === sp.gamme);
  const parentOf = (id: string) => allBrands.find((b) => b.id === id)?.parent_id;
  // Sous-marques rangées sous leur marque mère (Xiaomi → Redmi, POCO ; Nothing → CMF)
  // Marques sans téléphone publié masquées (une marque mère reste si une sous-marque en a).
  const has = (id: string) => (brandCount.get(id) ?? 0) > 0;
  const navBrands = allBrands
    .filter((b) => !b.parent_id)
    .flatMap((b) => [b, ...allBrands.filter((c) => c.parent_id === b.id && has(c.id))])
    .filter((b) => has(b.id) || allBrands.some((c) => c.parent_id === b.id && has(c.id)));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-28">
      <Crumbs items={[{ href: "/catalogue", label: "Catalogue" }, ...(brand ? [{ href: href({ gamme: undefined }), label: brand.name }] : []), ...(serie ? [{ label: serie.name }] : [])]} />
      <h1 className="display text-4xl sm:text-6xl">Catalogue</h1>
      <p className="text-muted mt-2 max-w-3xl">Les smartphones vendus en France depuis 2023, avec leurs caractéristiques et la durée de leurs mises à jour. Un prix n&apos;est affiché que s&apos;il est fiable : en vente, en stock, relevé il y a moins de 7 jours, pour une capacité précise. Coche « Avec une offre vérifiée » pour ne voir que ceux-là.</p>

      <form action="/catalogue" method="get" className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto] items-end bg-panel border border-line p-4" role="search">
        {sp.marque && <input type="hidden" name="marque" value={sp.marque} />}
        {sp.gamme && <input type="hidden" name="gamme" value={sp.gamme} />}
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Rechercher un modèle, une marque ou une gamme</span>
          <input name="q" defaultValue={q} placeholder="ex. Galaxy A, Redmi Note, One Plus 12" className="bg-panel-2 border border-line px-3 py-3" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Système</span>
          <select name="os" defaultValue={sp.os ?? ""} className="bg-panel-2 border border-line px-3 py-3">
            <option value="">Tous</option><option value="ios">iPhone (iOS)</option><option value="android">Android</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Format</span>
          <select name="forme" defaultValue={sp.forme ?? ""} className="bg-panel-2 border border-line px-3 py-3">
            <option value="">Tous</option><option value="classique">Classique</option><option value="pliable">Pliable</option><option value="clapet">À clapet</option><option value="durci">Durci</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Gamme</span>
          <select name="segment" defaultValue={sp.segment ?? ""} className="bg-panel-2 border border-line px-3 py-3">
            <option value="">Toutes</option><option value="entree">Entrée de gamme</option><option value="milieu">Milieu de gamme</option><option value="haut">Haut de gamme</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Prix max (€)</span>
          <input name="max" type="number" min={0} defaultValue={sp.max} className="bg-panel-2 border border-line px-3 py-3 w-32" />
        </label>
        <button className="btn btn-primary">Filtrer</button>
        <div className="md:col-span-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2 min-h-[40px]"><input type="checkbox" name="offre" value="1" defaultChecked={sp.offre === "1"} className="w-5 h-5 accent-[var(--red)]" /> Avec une offre vérifiée</label>
          <label className="flex items-center gap-2 min-h-[40px]"><input type="checkbox" name="fr" value="1" defaultChecked={sp.fr === "1"} className="w-5 h-5 accent-[var(--red)]" /> Vente en France confirmée</label>
          <label className="flex items-center gap-2">Année
            <select name="annee" defaultValue={sp.annee ?? ""} className="bg-panel-2 border border-line px-2 py-2">
              <option value="">Toutes</option>{["2026", "2025", "2024", "2023"].map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">Tri
            <select name="tri" defaultValue={sp.tri ?? ""} className="bg-panel-2 border border-line px-2 py-2">
              <option value="">Prix vérifiés d&apos;abord</option><option value="recent">Plus récents</option><option value="prix">Prix croissant</option><option value="nom">Nom</option>
            </select>
          </label>
        </div>
      </form>

      <div className="mt-6 grid lg:grid-cols-[230px_1fr] gap-8 items-start">
        <nav aria-label="Marques et gammes" className="text-sm">
          <h2 className="font-bold uppercase tracking-wider text-muted text-xs mb-2">Marques</h2>
          <ul className="grid grid-cols-2 lg:grid-cols-1 gap-x-4">
            <li><Link href={href({ marque: undefined, gamme: undefined })} className={`block py-1.5 ${!sp.marque ? "text-red font-bold" : "hover:text-red"}`}>Toutes ({all.length})</Link></li>
            {navBrands.map((b) => (
              <li key={b.id}>
                <Link href={href({ marque: b.id, gamme: undefined })} aria-current={sp.marque === b.id ? "true" : undefined} className={`block py-1.5 ${parentOf(b.id) ? "pl-3" : ""} ${sp.marque === b.id ? "text-red font-bold" : "hover:text-red"}`}>
                  {parentOf(b.id) ? "↳ " : ""}{b.name} <span className="text-muted">({brandCount.get(b.id) ?? 0})</span>
                </Link>
                {sp.marque === b.id && brandSeries.length > 0 && (
                  <ul className="pl-4 border-l border-line my-1">
                    {brandSeries.map((s) => (
                      <li key={s.id}>
                        <Link href={href({ gamme: s.id })} aria-current={sp.gamme === s.id ? "true" : undefined} className={`block py-1 ${sp.gamme === s.id ? "text-red font-bold" : "text-muted hover:text-text"}`}>
                          {s.name} ({s.n})
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <section aria-label="Résultats">
          <p className="text-sm text-muted mb-4" aria-live="polite">{list.length} modèle{list.length > 1 ? "s" : ""}{q && <> pour « {q} »</>}</p>
          <ul className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3 gap-4">
            {shown.map((m) => {
              const sec = deadline(m.security_end, m.security_end_precision, !!m.security_end_confirmed, today);
              const best = [m.minNew !== null ? { l: "Neuf", p: m.minNew } : null, m.minRefurb !== null ? { l: "Reconditionné", p: m.minRefurb } : null].filter(Boolean) as { l: string; p: number }[];
              return (
                <li key={m.id} className="card-link group relative bg-panel border border-line flex flex-col">
                  <PhotoFrame media={m.thumb} alt={m.name} form={m.form_factor} className="aspect-[4/3]" />
                  {m.form_factor && m.form_factor !== "classique" && (
                    <span className="absolute top-2 left-2 tag bg-ink/80 text-text">{m.form_factor === "pliable" ? "Pliable" : m.form_factor === "clapet" ? "À clapet" : "Durci"}</span>
                  )}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div>
                      <p className="text-[11px] text-muted uppercase tracking-wider font-semibold">{m.brand_name}{m.series_name ? ` · ${m.series_name}` : ""}</p>
                      <h3 className="font-extrabold text-xl leading-tight mt-0.5">
                        <Link href={`/telephone/${m.id}`} className="after:absolute after:inset-0 group-hover:text-red focus-visible:outline-none">{m.name}</Link>
                      </h3>
                      <p className="text-xs text-muted mt-1">{shortRelease(m.release_date)}</p>
                      {(() => {
                        const seg = segmentOf(m.specs);
                        return seg ? (
                          <p className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 border ${seg === "haut" ? "border-red text-red" : seg === "milieu" ? "border-warn/70 text-warn" : "border-white/25 text-muted"}`}>
                            <span aria-hidden>{seg === "haut" ? "▲▲▲" : seg === "milieu" ? "▲▲" : "▲"}</span>{SEGMENT_LABELS[seg]}
                          </p>
                        ) : null;
                      })()}
                    </div>
                    <div className="min-h-[52px]">
                      {best.length ? (
                        best.map((b) => (
                          <p key={b.l} className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-muted">{b.l} dès</span>
                            <span className="text-lg font-extrabold tabular-nums">{euros(b.p)}</span>
                          </p>
                        ))
                      ) : m.priceNote ? (
                        <div className="text-sm">
                          <p className="text-warn font-semibold">
                            {m.priceNote.kind === "rupture" ? `En rupture chez ${m.priceNote.seller}` : m.priceNote.kind === "depart" ? "Prix « à partir de » seulement" : "Prix à actualiser"}
                          </p>
                          <p className="text-xs text-muted mt-0.5 tabular-nums">
                            {m.priceNote.kind === "depart" ? `Dès ${euros(m.priceNote.price)}, capacité non précisée` : `Dernier prix relevé : ${euros(m.priceNote.price)}`}
                          </p>
                          <a href={shopLinks(m.brand_name, m.name)[0].url} target="_blank" rel="noopener noreferrer nofollow"
                            className="relative z-10 text-xs font-semibold underline underline-offset-2 hover:text-red">
                            Voir les prix ailleurs ↗<span className="sr-only"> (nouvel onglet)</span>
                          </a>
                        </div>
                      ) : (
                        <div className="text-sm">
                          <p className="text-muted font-semibold">Prix non relevé ici</p>
                          <a href={shopLinks(m.brand_name, m.name)[0].url} target="_blank" rel="noopener noreferrer nofollow"
                            className="relative z-10 text-xs font-semibold underline underline-offset-2 hover:text-red">
                            Voir les prix sur Google Shopping ↗<span className="sr-only"> (nouvel onglet)</span>
                          </a>
                        </div>
                      )}
                    </div>
                    {(() => {
                      const keys = keyFacts(m.reliable, m.storages);
                      return keys.length ? (
                        <ul className="flex flex-wrap gap-1.5 text-xs">
                          {keys.map((k) => <li key={k} className="px-2 py-1 bg-panel-2 border border-line">{k}</li>)}
                        </ul>
                      ) : null;
                    })()}
                    <p className="mt-auto pt-3 border-t border-line text-xs text-muted">
                      {(m.supportLevel === "officiel" || m.supportLevel === "autorise") && (sec.state === "en_cours" || sec.state === "dernier_jour")
                        ? <>Correctifs {securityShort(sec)}</>
                        : "Caractéristiques, suivi et sources détaillés sur la fiche"}
                    </p>
                    <div className="relative z-10"><CompareToggle id={m.id} name={m.name} /></div>
                  </div>
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex flex-wrap gap-2 mt-6">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link key={n} href={href({ page: String(n) })} aria-current={n === page ? "page" : undefined} className={`min-w-[44px] min-h-[44px] grid place-items-center border ${n === page ? "border-red text-red font-bold" : "border-line"}`}>{n}</Link>
              ))}
            </nav>
          )}
        </section>
      </div>
      <CompareTray />
    </div>
  );
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function shortRelease(d: string | null) {
  if (!d) return "Date de sortie non renseignée";
  return `Sortie ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)} (mondiale)`;
}
function securityShort(d: Deadline) {
  if (d.state === "inconnue") return "Fin non annoncée";
  if (d.state === "periode_terminee") return "Période terminée";
  if (d.state === "support_termine") return "Support terminé";
  return `${d.precision === "mois" ? "jusqu'en" : "jusqu'au"} ${d.dateLabel}`;
}

/** Deux ou trois caractéristiques issues d'une source officielle, sinon rien (le détail est sur la fiche). */
function keyFacts(r: Record<string, unknown>, storages: number[]): string[] {
  const out: string[] = [];
  if (typeof r.screen_in === "number") out.push(`Écran ${String(r.screen_in).replace(".", ",")}″`);
  if (typeof r.battery_mah === "number") out.push(`${r.battery_mah} mAh`);
  else if (typeof r.chip === "string") out.push(r.chip);
  if (typeof r.weight_g === "number") out.push(`${String(r.weight_g).replace(".", ",")} g`);
  const st = storages.filter((g) => g > 0);
  if (out.length < 3 && st.length) out.push(st.map((g) => (g >= 1024 ? `${g / 1024} To` : `${g} Go`)).join(" / "));
  return out.slice(0, 3);
}
