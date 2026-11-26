import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { coverage, redmiInventoryStatus } from "@/lib/queries";
import { dateTimeFr } from "@/lib/format";
import { OFFER_MAX_AGE_DAYS } from "@/lib/engine";
import { SourceLegend } from "@/components/ui";
import { MARKET_MIN_OBSERVATIONS, MARKET_WINDOW_DAYS } from "@/lib/market";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sources, couverture et méthode", description: "D'où viennent les prix, les fiches et les dates de mises à jour affichés sur PickJust, à quelle fréquence ils sont relevés et ce qui n'est pas encore couvert.", alternates: { canonical: "/couverture" } };

const SOURCES = [
  { name: "Xiaomi Store France", what: "Liste des Xiaomi, Redmi et POCO depuis les données structurées de la page « Smartphones », puis prix et stock de chaque capacité depuis le point d'accès qui alimente la page d'achat (utilisé sur autorisation du propriétaire du site PickJust). Frais de livraison non publiés : offres « à vérifier ». Caractéristiques relevées sur les pages « Caractéristiques » officielles.", url: "https://www.mi.com/fr/product-list/phone/", status: "Connectée — frais à vérifier" },
  { name: "Samsung France — fiches produit (officiel)", what: "Caractéristiques et date « Mise à jour de sécurité jusqu'au » relevées sur les fiches samsung.com/fr des modèles en vente.", url: "https://www.samsung.com/fr/smartphones/", status: "Connectée — officielle" },
  { name: "Google — aide Pixel (officiel)", what: "Date de première mise en vente de chaque Pixel et règle des 5 ou 7 ans de mises à jour : les échéances Pixel sont calculées à partir de ces deux pages officielles.", url: "https://support.google.com/pixelphone/answer/15738422?hl=fr", status: "Connectée — officielle" },
  { name: "Apple — caractéristiques techniques (officiel)", what: "Dimensions, poids, écran, puce, indice de protection et capacités, relevés sur les pages apple.com/fr des iPhone en vente.", url: "https://www.apple.com/fr/iphone/", status: "Connectée — officielle" },
  { name: "Google Store — caractéristiques techniques (officiel)", what: "Dimensions, poids, batterie et, pour les pages d'un seul modèle, écran, puce, RAM, eSIM et indice de protection.", url: "https://store.google.com/fr/", status: "Connectée — officielle" },
  { name: "endoflife.date (communautaire)", what: "Liste des modèles Apple, Samsung, Google, OnePlus, Motorola, Fairphone et Nokia, dates de sortie mondiales, échéances de mises à jour et de correctifs.", url: "https://endoflife.date", status: "Connectée (API publique)" },
  { name: "Apple Store France", what: "Prix neufs des iPhone vendus par Apple, par capacité. Livraison gratuite constatée sur la page.", url: "https://www.apple.com/fr/shop/buy-iphone", status: "Connectée" },
  { name: "Apple — produits reconditionnés", what: "Offres reconditionnées officielles d'Apple, par capacité et coloris.", url: "https://www.apple.com/fr/shop/refurbished/iphone", status: "Connectée" },
  { name: "Samsung Shop France", what: "Prix neufs et « Reconditionné Premium par Samsung » lorsque la capacité figure dans l'adresse de l'offre. Selon les conditions générales de vente de Samsung, les prix sont « hors participation aux frais de port », calculés au panier : le coût total reste inconnu, ces offres ne sont donc jamais annoncées « dans ton budget ». La variable SAMSUNG_FR_SHIPPING_EUR permet de renseigner un montant vérifié.", url: "https://www.samsung.com/fr/estore/static/link_terms_and_conditions_of_sale/", status: "Connectée — coût total inconnu" },
  { name: "Wikimedia Commons", what: "Photos sous licence libre (CC0, CC BY, CC BY-SA, domaine public) avec auteur et lien vers la source.", url: "https://commons.wikimedia.org", status: "Connectée (API publique)" },
  { name: "Saisie éditoriale", what: "Caractéristiques des modèles sans page officielle exploitable (data/sources/specs.json) et liste des modèles hors endoflife.date. Affichées « À vérifier » ; toute valeur officielle relevée ensuite la remplace et l'écart est journalisé.", url: null, status: "À vérifier" },
  { name: "Back Market, Fnac, Darty, Recommerce, CertiDeal", what: "Accès automatisé refusé ou non autorisé sans accord. Un import via flux partenaire nécessiterait une clé (non fournie).", url: null, status: "Non connectée" },
  { name: "Leboncoin et annonces entre particuliers", what: "Les conditions d'utilisation n'autorisent pas la collecte automatisée. Le calcul de cote est prêt (médiane, 25e–75e percentiles) mais n'a aucune donnée.", url: null, status: "Non connectée" },
  { name: "Tests d'autonomie et de photo indépendants", what: "Aucune source de mesures comparables dont la réutilisation est autorisée n'est connectée : les classements autonomie et photo s'appuient sur des caractéristiques annoncées, signalées comme telles.", url: null, status: "Non connectée" },
];

export default function Page() {
  const c = coverage();
  const redmi = redmiInventoryStatus();
  const ed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sources", "editorial-models.json"), "utf8"));
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <h1 className="display text-4xl sm:text-6xl">Sources, couverture et méthode</h1>
      <p className="mt-4 text-lg">
        <strong>{c.totals.published}</strong> smartphones affichés, dont <strong>{c.totals.priced}</strong> avec un prix actuel fiable · <strong>{c.totals.offers}</strong> offres actives · <strong>{c.totals.media}</strong> modèles illustrés.
        {c.runs[0]?.finished_at && <> Dernière actualisation : {dateTimeFr(c.runs[0].finished_at)}.</>}
      </p>
      <p className="text-muted mt-2">Une marque présente avec quelques fiches ne signifie pas que toute sa gamme est couverte.</p>
      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        <div className="bg-panel border border-line p-4"><p className="display text-3xl text-ok">{c.totals.officialSpecs}</p><p className="text-sm text-muted">fiches techniques relevées sur une page officielle</p></div>
        <div className="bg-panel border border-line p-4"><p className="display text-3xl text-ok">{c.totals.officialSupport}</p><p className="text-sm text-muted">échéances de suivi calculées depuis une page officielle</p></div>
        <div className="bg-panel border border-line p-4"><p className="display text-3xl">{c.totals.editorialSpecs}</p><p className="text-sm text-muted">fiches encore en saisie « À vérifier »</p></div>
      </div>
      <div className="mt-4"><SourceLegend /></div>

      <section className="mt-10" aria-labelledby="regles">
        <h2 id="regles" className="display text-2xl">Règles appliquées</h2>
        <ul className="mt-3 grid gap-2 list-disc pl-5">
          <li>Une offre est « disponible dans ton budget » seulement si elle est réelle, disponible, vérifiée il y a moins de {OFFER_MAX_AGE_DAYS} jours, pour la bonne capacité, avec un coût total connu (prix + frais obligatoires + livraison) inférieur ou égal au budget.</li>
          <li>Une offre qui n&apos;est plus vue lors d&apos;un import est marquée indisponible ; la fiche du modèle reste consultable.</li>
          <li>Cote d&apos;occasion : fenêtre de {MARKET_WINDOW_DAYS} jours, au moins {MARKET_MIN_OBSERVATIONS} annonces comparables, médiane et fourchette 25e–75e percentile arrondies à 5 €. Une cote ne déclenche jamais « disponible dans ton budget ».</li>
          <li>Dates de sortie : la plupart sont mondiales ; elles sont signalées « date française à vérifier ». Un modèle vu dans une boutique française est marqué « vente en France confirmée ».</li>
          <li>Suivi logiciel : recalculé à chaque affichage. Une échéance connue au mois près n&apos;est jamais affichée au jour près. Sans échéance publiée : « Date de fin non annoncée ». « Support terminé » est réservé aux fins confirmées.</li>
          <li>Origine : pays de fondation de la marque. Le pays d&apos;assemblage n&apos;est affiché qu&apos;avec une source propre au modèle (aucune pour l&apos;instant).</li>
          <li>Exclusions : séries Samsung M, F, C et W et modèles Motorola destinés à d&apos;autres marchés (non distribués en France), tablettes.</li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="sources">
        <h2 id="sources" className="display text-2xl">Sources</h2>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          {SOURCES.map((s) => (
            <div key={s.name} className="bg-panel border border-line p-4">
              <p className="font-extrabold">{s.url ? <a href={s.url} className="underline" target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}</p>
              <p className="tag mt-1">{s.status}</p>
              <p className="text-sm text-muted mt-2">{s.what}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="marques">
        <h2 id="marques" className="display text-2xl">Couverture par marque</h2>
        <div className="overflow-x-auto mt-3 border border-line bg-panel">
          <table className="specs w-full text-sm min-w-[620px]">
            <thead><tr><th>Marque</th><th>Modèles</th><th>Vente FR confirmée</th><th>Fiche officielle</th><th>Fiche à vérifier</th><th>Avec photo</th><th>Avec offre active</th></tr></thead>
            <tbody>
              {c.byBrand.map((b) => (
                <tr key={b.brand_id}><th scope="row">{b.brand}</th><td>{b.n}</td><td>{b.confirmed}</td><td>{b.with_official}</td><td>{b.with_specs - b.with_official}</td><td>{b.with_media}</td><td>{b.with_offers}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="display text-2xl">Par année de sortie</h2>
          <ul className="mt-3 grid gap-1">{c.byYear.map((y) => <li key={y.year} className="flex justify-between border-b border-line py-1.5"><span>{y.year}</span><strong>{y.n}</strong></li>)}</ul>
        </div>
        <div>
          <h2 className="display text-2xl">Lacunes connues</h2>
          <ul className="mt-3 grid gap-2 list-disc pl-5 text-sm">
            {(ed.known_gaps as string[]).map((g) => <li key={g}>{g}</li>)}
            <li>Modèles sortis après mi-2026 : seuls ceux d&apos;endoflife.date et des boutiques connectées sont présents, souvent sans caractéristiques.</li>
            <li>Caractéristiques renseignées pour une partie des modèles seulement ; les autres affichent « Non renseigné ».</li>
            <li>Aucun modèle 3D autorisé n&apos;a été trouvé : le bouton « Voir en 3D » n&apos;apparaît donc sur aucune fiche.</li>
          </ul>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="redmi">
        <h2 id="redmi" className="display text-2xl">Inventaire REDMI France</h2>
        <p className="text-sm text-muted mt-2">
          {redmi.inventory.length} smartphones REDMI confirmés par une page produit mi.com/fr (vérifiée à chaque import), dont {redmi.inCatalog} présents
          dans le catalogue. Sources de départ :{" "}
          {redmi.sources.map((u, i) => (
            <span key={u}>{i > 0 && " · "}<a href={u} className="underline" target="_blank" rel="noopener noreferrer">{u.replace("https://www.mi.com", "")}</a></span>
          ))}
          , complétées par les anciennes pages produit encore en ligne.
        </p>
        <div className="overflow-x-auto mt-3 border border-line bg-panel">
          <table className="specs w-full text-sm min-w-[560px]">
            <thead><tr><th>Année d&apos;annonce</th>{redmi.families.map((f) => <th key={f}>{f}</th>)}</tr></thead>
            <tbody>
              {redmi.years.map((y) => (
                <tr key={y}>
                  <th scope="row">{y}</th>
                  {redmi.families.map((f) => (
                    <td key={f}>{redmi.inventory.filter((e) => (e.year ?? "non publiée") === y && e.family === f).map((e) => e.name.replace(/^REDMI /, "")).join(", ") || "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {redmi.toCheck.length > 0 && (
          <ul className="mt-3 text-sm list-disc pl-5 text-muted">
            {redmi.toCheck.map((t) => <li key={t.name}><strong className="text-text">{t.name}</strong> — à vérifier : {t.reason}</li>)}
          </ul>
        )}
        <p className="text-xs text-muted mt-2">Marques retirées du site : {redmi.excluded.join(", ")} (règle unique : data/sources/brand-policy.json).</p>
      </section>

      <section className="mt-10" aria-labelledby="gammes">
        <h2 id="gammes" className="display text-2xl">Par gamme</h2>
        <ul className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 text-sm">
          {c.bySeries.map((s) => <li key={s.brand + s.series} className="flex justify-between border-b border-line py-1.5"><span>{s.brand} → {s.series}</span><strong>{s.n}</strong></li>)}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="imports">
        <h2 id="imports" className="display text-2xl">Derniers imports</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {c.runs.map((r) => (
            <li key={r.source} className="bg-panel border border-line p-3">
              <strong>{r.source}</strong> — {r.status === "ok" ? "réussi" : r.status} {r.finished_at && `le ${dateTimeFr(r.finished_at)}`} · {r.added} ajouts, {r.updated} mises à jour
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
