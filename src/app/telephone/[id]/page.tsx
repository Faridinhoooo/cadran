import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { configsFor, getBrand, getModel, marketFor, mediaFor, specsFor, specMap, supportFor, type OfferRow, type SpecRow } from "@/lib/queries";
import { isFresh, offerTotal } from "@/lib/engine";
import { NR, dateFr, dateTimeFr, euros, releaseLabel, sourceLabel, specText, storageLabel } from "@/lib/format";
import { securityDeadline, securityHeadline, supportStatus, upgradesDeadline } from "@/lib/support";
import { Gallery } from "@/components/Gallery";
import { Crumbs, SecurityLine, SourceBadge, SourceLegend } from "@/components/ui";
import { CompareToggle, CompareTray } from "@/components/CompareTray";
import { MARKET_WINDOW_DAYS } from "@/lib/market";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ go?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const id = (await params).id;
  const m = getModel(id);
  if (!m) return { title: "Téléphone introuvable", robots: { index: false } };
  const sp = specMap(specsFor(id));
  const facts = [
    typeof sp.screen_in === "number" ? `écran ${String(sp.screen_in).replace(".", ",")}″` : null,
    typeof sp.battery_mah === "number" ? `batterie ${sp.battery_mah} mAh` : null,
    typeof sp.chip === "string" ? sp.chip : null,
  ].filter(Boolean);
  return {
    title: m.name,
    description: `${m.name} : prix neuf et reconditionné en France, ${facts.length ? facts.join(", ") + ", " : ""}suivi des mises à jour et sources.`,
    alternates: { canonical: `/telephone/${id}` },
  };
}

/** Données structurées schema.org : uniquement des offres réelles, récentes et en vente. */
function productJsonLd(m: { id: string; name: string; brand_name: string }, image: string | null, offers: { price: number; seller: string; url: string; condition: string }[], base: string) {
  const prices = offers.map((o) => o.price);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: m.name,
    brand: { "@type": "Brand", name: m.brand_name },
    url: `${base}/telephone/${m.id}`,
    ...(image ? { image } : {}),
    ...(offers.length
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "EUR",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: offers.length,
            offers: offers.map((o) => ({
              "@type": "Offer",
              price: o.price,
              priceCurrency: "EUR",
              url: o.url,
              availability: "https://schema.org/InStock",
              itemCondition: o.condition === "neuf" ? "https://schema.org/NewCondition" : "https://schema.org/RefurbishedCondition",
              seller: { "@type": "Organization", name: o.seller },
            })),
          },
        }
      : {}),
  };
}

const GROUPS: { title: string; keys: [string, string][] }[] = [
  { title: "Écran", keys: [["screen_in", "Diagonale"], ["screen_tech", "Technologie"], ["resolution", "Résolution"], ["refresh_hz", "Fréquence"]] },
  { title: "Format", keys: [["height_mm", "Hauteur"], ["width_mm", "Largeur"], ["thickness_mm", "Épaisseur"], ["weight_g", "Poids"]] },
  { title: "Performances", keys: [["chip", "Processeur"], ["ram_gb", "Mémoire vive (RAM)"], ["storage", "Stockage"], ["expandable", "Extension microSD"]] },
  { title: "Photo et vidéo", keys: [["cameras", "Appareils photo arrière"], ["ois", "Stabilisation optique"], ["optical_zoom", "Zoom optique"], ["video", "Principaux modes vidéo"]] },
  { title: "Batterie", keys: [["battery_mah", "Capacité"], ["charge_w", "Puissance de charge filaire"], ["wireless", "Recharge sans fil"], ["autonomy_h", "Autonomie mesurée"]] },
  { title: "Connectivité et durabilité", keys: [["five_g", "5G"], ["esim", "eSIM"], ["nfc", "NFC"], ["ip", "Indice de protection"], ["policy", "Politique de mises à jour"]] },
];

function bestBy(offers: OfferRow[], cond: string, today: Date) {
  const fresh = offers.filter((o) => o.condition === cond && isFresh(o, today));
  const withTotal = fresh.filter((o) => offerTotal(o) !== null).sort((a, b) => offerTotal(a)! - offerTotal(b)!);
  return { best: withTotal[0] ?? null, unknownTotal: fresh.filter((o) => offerTotal(o) === null), stale: offers.filter((o) => o.condition === cond && !isFresh(o, today)) };
}

function OfferBlock({ title, offers, cond, today }: { title: string; offers: OfferRow[]; cond: "neuf" | "reconditionne"; today: Date }) {
  const { best, unknownTotal, stale } = bestBy(offers, cond, today);
  const others = offers.filter((o) => o.condition === cond && isFresh(o, today) && o.id !== best?.id);
  return (
    <section className="bg-panel border border-line p-5 cut-sm flex flex-col gap-2" aria-labelledby={`b-${cond}`}>
      <h3 id={`b-${cond}`} className="display text-xl">{title}</h3>
      {best ? (
        <>
          <p className="tag border-ok text-ok self-start">Offre achetable vérifiée</p>
          <p className="text-3xl font-extrabold tabular-nums">{euros(offerTotal(best)!)}</p>
          <p className="text-sm">
            Prix {euros(best.price)} + frais obligatoires {euros(best.mandatory_fees ?? 0)} + livraison {best.shipping === 0 ? "gratuite" : euros(best.shipping ?? 0)}
          </p>
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">Vendeur</dt><dd>{best.seller}</dd>
            {best.platform && (<><dt className="text-muted">Plateforme</dt><dd>{best.platform}</dd></>)}
            {cond === "reconditionne" && (<>
              <dt className="text-muted">Grade</dt><dd>{best.grade ?? NR}</dd>
              <dt className="text-muted">Batterie</dt><dd>{best.battery_note ?? "Non documentée sur l'offre relevée"}</dd>
              <dt className="text-muted">Garantie</dt><dd>{best.warranty ?? "Non indiquée sur la page relevée (garantie légale de conformité applicable)"}</dd>
              <dt className="text-muted">Retours</dt><dd>{best.returns_policy ?? NR}</dd>
            </>)}
            {best.color && (<><dt className="text-muted">Coloris</dt><dd>{best.color}</dd></>)}
            <dt className="text-muted">Vérifié le</dt><dd>{dateTimeFr(best.checked_at)}</dd>
            <dt className="text-muted">Source</dt><dd>{sourceLabel(best.source)}</dd>
          </dl>
          <a href={best.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-[44px] text-sm mt-2 self-start">
            Voir l&apos;offre<span className="sr-only"> chez {best.seller} (nouvel onglet)</span>
          </a>
          {others.length > 0 && <p className="text-xs text-muted">{others.length} autre{others.length > 1 ? "s" : ""} offre{others.length > 1 ? "s" : ""} vérifiée{others.length > 1 ? "s" : ""} pour cette capacité.</p>}
          {cond === "reconditionne" && <p className="text-xs text-muted">Un même grade peut recouvrir des critères différents selon le vendeur. Vérifie les conditions avant d&apos;acheter.</p>}
        </>
      ) : unknownTotal.length ? (
        <>
          <p className="tag border-warn/60 text-warn self-start">Prix relevé · frais à vérifier</p>
          <p className="text-2xl font-extrabold tabular-nums">{euros(unknownTotal[0].price)} <span className="text-sm font-semibold">hors frais · <span className="text-warn">livraison à vérifier</span></span></p>
          <p className="text-sm text-muted">{unknownTotal[0].shipping_note ?? `Les frais de livraison de ${unknownTotal[0].seller} ne sont pas publiés.`}</p>
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">Vendeur</dt><dd>{unknownTotal[0].seller}{unknownTotal[0].platform ? ` · ${unknownTotal[0].platform}` : ""}</dd>
            <dt className="text-muted">Relevé le</dt><dd>{dateTimeFr(unknownTotal[0].checked_at)}</dd>
            <dt className="text-muted">Source</dt><dd>{sourceLabel(unknownTotal[0].source)}</dd>
          </dl>
          <a href={unknownTotal[0].url} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-[44px] text-sm mt-2 self-start">
            Vérifier chez le vendeur<span className="sr-only"> {unknownTotal[0].seller}, nouvel onglet</span>
          </a>
        </>
      ) : (
        stale.length ? (
        (() => {
          const out = stale.filter((o) => o.stock === "rupture").sort((x, y) => y.checked_at.localeCompare(x.checked_at))[0];
          return out ? (
            <div>
              <p className="text-warn font-semibold">En rupture chez {out.seller}</p>
              <p className="text-sm text-muted">Dernier prix affiché {euros(out.price)} pour cette capacité, relevé le {dateTimeFr(out.checked_at)}. Non utilisé pour les recommandations.</p>
              <a href={out.url} className="text-sm underline" target="_blank" rel="noopener noreferrer">Voir la page du vendeur</a>
            </div>
          ) : (
            <p className="text-warn font-semibold">Prix à actualiser <span className="block text-sm text-muted font-normal">Le dernier prix relevé date de plus de 7 jours ou l&apos;offre n&apos;est plus en vente.</span></p>
          );
        })()
      ) : (
        <p className="text-muted">Aucune offre relevée pour cette capacité.</p>
      )
      )}
    </section>
  );
}

export default async function Page({ params, searchParams }: Params) {
  const { id } = await params;
  const { go } = await searchParams;
  const m = getModel(id);
  if (!m) notFound();
  const today = new Date();
  const brand = getBrand(m.brand_id)!;
  const parent = brand.parent_id ? getBrand(brand.parent_id) : null;
  const specRows = specsFor(id);
  const specs = specMap(specRows);
  const measured = specMap(specRows, "mesure");
  const support = supportFor(id);
  const configs = configsFor(id);
  const media = mediaFor(id);
  const sel = configs.find((c) => String(c.storage_gb) === go) ?? configs.find((c) => c.offers.some((o) => isFresh(o, today))) ?? configs[0];
  const offers = sel?.offers ?? [];
  const market = sel ? marketFor(sel.id, today) : null;
  const sec = securityDeadline(support, today);
  const upg = upgradesDeadline(support, today);
  const rel = releaseLabel(m);
  const officialSources = [...new Map(specRows.filter((r) => r.level === "officiel" && r.source_url).map((r) => [r.source_url!, { url: r.source_url!, name: r.source_name, checked: r.checked_at ?? "" }])).values()];
  // Tuile de prix : coût total confirmé, sinon prix affiché hors frais, sinon « Prix à actualiser ».
  const tile = (cond: "neuf" | "reconditionne"): [string | null, string | null] => {
    const b = bestBy(offers, cond, today);
    if (b.best) return [euros(offerTotal(b.best)!), `${b.best.seller} · frais inclus`];
    const u = [...b.unknownTotal].sort((x, y) => x.price - y.price)[0];
    if (u) return [`${euros(u.price)}`, `${u.seller} · hors frais, livraison à vérifier`];
    if (b.stale.length) return [null, "Prix à actualiser"];
    return [null, null];
  };

  const specRow = (key: string, kind: SpecRow["kind"]) => specRows.find((r) => r.key === key && r.kind === kind) ?? null;
  type Row = { value: string; kind: SpecRow["kind"] | null; level: string | null; url: string | null; checked: string | null };
  const row = (key: string): Row => {
    const none: Row = { value: NR, kind: null, level: null, url: null, checked: null };
    if (key === "storage") {
      if (!configs.length) return none;
      const off = specRow("height_mm", "annonce");
      return { value: configs.map((c) => storageLabel(c.storage_gb)).join(" / "), kind: "annonce", level: off?.level ?? "editorial", url: off?.source_url ?? null, checked: off?.checked_at ?? null };
    }
    if (key === "policy")
      return support?.upgrade_commitment ? { value: support.upgrade_commitment, kind: "annonce", level: support.level ?? "communautaire", url: support.policy_url, checked: support.checked_at } : none;
    if (key in measured) {
      const r = specRow(key, "mesure")!;
      return { value: specText(key, measured[key]), kind: "mesure", level: r.level, url: r.source_url, checked: r.checked_at };
    }
    if (key === "ram_gb" && sel?.ram_gb && !(key in specs)) return { value: specText("ram_gb", sel.ram_gb), kind: "annonce", level: "editorial", url: null, checked: null };
    const r = specRow(key, "annonce");
    return r ? { value: specText(key, specs[key]), kind: "annonce", level: r.level, url: r.source_url, checked: r.checked_at } : none;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-28">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            productJsonLd(
              m,
              media.find((x) => x.quality === "detoure")?.url ?? null,
              configs.flatMap((c) => c.offers).filter((o) => isFresh(o, today) && o.capacity_status !== "prix_de_depart"),
              siteConfig().url.replace(/\/$/, ""),
            ),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <Crumbs items={[{ href: "/catalogue", label: "Catalogue" }, { href: `/catalogue?marque=${m.brand_id}`, label: m.brand_name }, ...(m.series_id ? [{ href: `/catalogue?marque=${m.brand_id}&gamme=${m.series_id}`, label: m.series_name ?? "" }] : []), { label: m.name }]} />

      <div className="grid lg:grid-cols-[minmax(0,460px)_1fr] gap-8 items-start">
        <Gallery name={m.name} media={media} form={m.form_factor} />
        <div>
          <p className="text-sm text-muted uppercase tracking-wider">{m.brand_name}{m.series_name ? ` · ${m.series_name}` : ""}</p>
          <h1 className="display text-4xl sm:text-6xl mt-1">{m.name}</h1>

          {configs.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold mb-2" id="cap">Capacité</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="cap">
                {configs.map((c) => (
                  <Link key={c.id} href={`/telephone/${id}?go=${c.storage_gb}`} scroll={false} aria-current={c.id === sel?.id ? "true" : undefined}
                    className={`px-4 py-2.5 min-h-[44px] border-2 font-bold ${c.id === sel?.id ? "border-red bg-[#1d1213]" : "border-line hover:border-white/40"}`}>
                    {c.id === sel?.id && <span aria-hidden>✓ </span>}{storageLabel(c.storage_gb)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Prix par état : l'information qui aide à décider, avant les caractéristiques */}
          <div className="mt-6 grid grid-cols-3 gap-px bg-line border border-line" role="group" aria-label={`Prix ${sel ? `en ${storageLabel(sel.storage_gb)}` : ""}`}>
            {([
              ["Neuf", ...tile("neuf")],
              ["Reconditionné", ...tile("reconditionne")],
              ["Occasion (cote)", market?.ok ? euros(market.median) : null, market?.ok ? "médiane des annonces" : null],
            ] as const).map(([label, price, sub]) => (
              <div key={label} className="bg-panel p-3 sm:p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted font-bold">{label}</p>
                <p className={`mt-1 tabular-nums ${price ? "text-xl sm:text-2xl font-extrabold" : "text-sm text-muted"}`}>{price ?? "Pas d'offre vérifiée"}</p>
                {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-1.5">Coût total livraison comprise{sel ? `, pour ${storageLabel(sel.storage_gb)}` : ""}. <a href="#prix" className="underline">Détail des offres</a></p>

          <dl className="mt-5 grid sm:grid-cols-3 gap-3">
            <div className="bg-panel border border-line p-4">
              <dt className="text-[11px] uppercase tracking-wider text-muted font-bold">Correctifs de sécurité</dt>
              <dd className="font-bold mt-1 text-sm"><SecurityLine d={sec} /></dd>
              <dd className="mt-2"><SupportPill s={supportStatus(support)} /></dd>
            </div>
            <div className="bg-panel border border-line p-4">
              <dt className="text-[11px] uppercase tracking-wider text-muted font-bold">Sortie</dt>
              <dd className="font-bold mt-1">{m.release_date ? rel.date : "Date de lancement en France inconnue"}</dd>
              {!m.release_date && m.release_source?.match(/https?:\/\/\S+/) && (
                <dd className="text-xs text-muted mt-0.5">
                  Non publiée sur la <a href={m.release_source.match(/https?:\/\/\S+/)![0]} className="underline" target="_blank" rel="noopener noreferrer">page consultée</a>
                </dd>
              )}
              {rel.note && <dd className="text-xs text-muted mt-0.5">{m.release_level === "officiel" && m.brand_id === "google" ? "Première vente aux États-Unis ; date française à vérifier" : "Date mondiale ; date française à vérifier"}</dd>}
              <dd className="text-xs mt-1">{m.fr_status === "confirme" ? <span className="text-ok">✓ Vendu en France</span> : <span className="text-muted">Vente en France à vérifier</span>}</dd>
              {m.release_date && <dd className="mt-2"><SourceBadge level={m.release_level} compact /></dd>}
            </div>
            <div className="bg-panel border border-line p-4">
              <dt className="text-[11px] uppercase tracking-wider text-muted font-bold">Origine de la marque</dt>
              <dd className="font-bold mt-1">{brand.origin_country ?? NR}</dd>
              <dd className="text-xs text-muted mt-0.5">
                Pays de fondation · {brand.owner_group}{parent ? ` (groupe ${parent.name})` : ""}
                {brand.source_url && <> · <a href={brand.source_url} className="underline" target="_blank" rel="noopener noreferrer">Wikipédia</a></>}
              </dd>
            </div>
          </dl>
          <div className="mt-5"><CompareToggle id={id} name={m.name} /></div>
        </div>
      </div>

      <section className="mt-12" aria-labelledby="prix">
        <h2 id="prix" className="display text-3xl">Neuf, reconditionné ou d&apos;occasion {sel && <span className="text-red">· {storageLabel(sel.storage_gb)}</span>}</h2>
        <p className="text-sm text-muted mt-1">Prix pour la capacité sélectionnée uniquement. Une offre est utilisée si elle a été vérifiée il y a moins de 7 jours et que son coût total est connu.</p>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <OfferBlock title="Neuf" offers={offers} cond="neuf" today={today} />
          <OfferBlock title="Reconditionné professionnel" offers={offers} cond="reconditionne" today={today} />
          <section className="bg-panel border border-line p-5 cut-sm" aria-labelledby="b-occ">
            <h3 id="b-occ" className="display text-xl">Occasion entre particuliers</h3>
            <p className="tag mt-2">Estimation de marché, pas une offre</p>
            {market?.ok ? (
              <>
                <p className="text-3xl font-extrabold tabular-nums mt-2">{euros(market.median)}</p>
                <p className="text-sm">Fourchette centrale : {euros(market.p25)} – {euros(market.p75)} · {market.count} annonces du {dateFr(market.from)} au {dateFr(market.to)}</p>
                <p className="text-xs text-muted mt-2">Prix demandés par les vendeurs, hors frais de livraison et de protection acheteur.</p>
              </>
            ) : (
              <>
                <p className="mt-3 font-semibold">Trop peu d&apos;annonces comparables pour estimer le prix</p>
                <p className="text-xs text-muted mt-2">
                  Fenêtre de {MARKET_WINDOW_DAYS} jours, minimum 5 annonces du même modèle, même capacité et état comparable.
                  Aucune source d&apos;annonces dont la réutilisation est autorisée n&apos;est encore connectée.
                </p>
              </>
            )}
          </section>
        </div>
      </section>

      <section className="mt-12 bg-panel border border-line cut p-6 sm:p-8" aria-labelledby="maj">
        <h2 id="maj" className="display text-2xl sm:text-3xl">Jusqu&apos;à quand ce téléphone sera-t-il mis à jour&nbsp;?</h2>
        <div className="mt-3"><SupportPill s={supportStatus(support)} big /></div>
        <p className="text-sm text-muted mt-2">Calculé aujourd&apos;hui, {dateFr(today.toISOString().slice(0, 10))}. Acheter neuf, reconditionné ou d&apos;occasion ne remet pas ce suivi à zéro.</p>
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <div>
            <h3 className="font-extrabold text-xl">Mises à niveau du système</h3>
            <p className="text-sm text-muted mt-1">Ce sont les nouvelles versions d&apos;Android ou d&apos;iOS. Elles peuvent apporter des fonctions et faire évoluer l&apos;interface.</p>
            <dl className="mt-3 text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-muted">Au lancement</dt><dd>{support?.os_launch ?? NR}</dd>
              <dt className="text-muted">Dernière version vérifiée</dt><dd>{support?.os_latest_verified ?? NR}</dd>
              <dt className="text-muted">Engagement</dt><dd>{support?.upgrade_commitment ?? "Aucun engagement chiffré trouvé"}</dd>
              <dt className="text-muted">Échéance</dt>
              <dd className="font-bold">
                {upg.state === "inconnue" ? "Date de fin non annoncée"
                  : upg.state === "periode_terminee" ? "Période garantie terminée"
                  : `${upg.precision === "mois" ? "Jusqu'en" : "Jusqu'au"} ${upg.dateLabel} · encore ${upg.remainingLabel}`}
              </dd>
            </dl>
          </div>
          <div>
            <h3 className="font-extrabold text-xl">Correctifs de sécurité</h3>
            <p className="text-sm text-muted mt-1">Ils corrigent des failles qui pourraient exposer ton téléphone ou tes données. Ils peuvent continuer après la dernière grande mise à niveau du système.</p>
            <p className="mt-3 text-lg font-extrabold">{securityHeadline(sec)}</p>
            <dl className="mt-2 text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-muted">Durée annoncée</dt><dd>{support?.security_years ? `${support.security_years} ans` : NR}</dd>
              <dt className="text-muted">Fréquence</dt><dd>{support?.security_frequency ?? "Non publiée"}</dd>
              <dt className="text-muted">Précision</dt><dd>{sec.precision === "mois" ? "Mois connu (aucun jour précis publié)" : sec.precision === "jour" ? "Date au jour près" : "—"}</dd>
            </dl>
            {sec.state === "inconnue" && <p className="text-sm text-muted mt-2">Une estimation fondée sur l&apos;historique ne constitue pas une garantie : aucune date n&apos;est affichée.</p>}
          </div>
        </div>
        <p className="text-xs text-muted mt-6 flex flex-wrap items-center gap-2">
          Source des échéances : {support?.source_url ? <a href={support.source_url} className="underline" target="_blank" rel="noopener noreferrer">{support.source_name}</a> : "aucune"}
          {support?.policy_url && <> · politique officielle : <a href={support.policy_url} className="underline" target="_blank" rel="noopener noreferrer">{new URL(support.policy_url).hostname}</a></>}
          {support?.checked_at && <> · vérifié le {dateFr(support.checked_at)}</>}
        </p>
      </section>

      <section className="mt-12" aria-labelledby="carac">
        <h2 id="carac" className="display text-3xl">Caractéristiques principales</h2>
        <p className="text-sm text-muted mt-1">
          Valeurs annoncées par le fabricant, sauf mention « Mesuré » (test indépendant). Chaque ligne indique la fiabilité de sa source.
        </p>
        <div className="mt-3"><SourceLegend /></div>
        {officialSources.length > 0 && (
          <p className="text-xs text-muted mt-2">
            Pages officielles relevées :{" "}
            {officialSources.map((o, i) => (
              <span key={o.url}>{i > 0 && " · "}<a href={o.url} className="underline" target="_blank" rel="noopener noreferrer">{o.name}</a> le {dateFr(o.checked)}</span>
            ))}
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="bg-panel border border-line">
              <h3 className="font-extrabold px-3 pt-3">{g.title}</h3>
              <table className="specs w-full text-sm">
                <tbody>
                  {g.keys.map(([k, label]) => {
                    const r = row(k);
                    return (
                      <tr key={k}>
                        <th scope="row" className="text-muted font-normal w-[38%]">{label}</th>
                        <td className={r.kind ? "" : "text-muted"}>
                          {r.value}
                          {r.kind === "mesure" && <span className="tag ml-2">Mesuré</span>}
                        </td>
                        <td className="text-right w-[1%]">
                          {r.kind && (r.url ? (
                            <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Source de « ${label} »`}><SourceBadge level={r.level} compact iconOnMobile /></a>
                          ) : <SourceBadge level={r.level} compact iconOnMobile />)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">Pays d&apos;assemblage : non affiché, faute de source propre à ce modèle. Il ne se déduit pas de la nationalité de la marque.</p>
      </section>
      <CompareTray />
    </div>
  );
}

function SupportPill({ s, big = false }: { s: ReturnType<typeof supportStatus>; big?: boolean }) {
  const cls = s.kind === "officiel" ? "text-ok border-ok/50" : s.kind === "absence_verifiee" ? "text-text border-white/40" : "text-warn border-warn/50";
  const icon = s.kind === "officiel" ? "✓" : s.kind === "absence_verifiee" ? "○" : "?";
  return (
    <span title={s.help} className={`inline-flex items-center gap-1.5 border px-2 py-1 font-bold ${big ? "text-sm" : "text-[11px] uppercase tracking-wider"} ${cls}`}>
      <span aria-hidden>{icon}</span>
      {s.label}
      {big && <span className="font-normal text-muted normal-case tracking-normal">— {s.help}</span>}
    </span>
  );
}
