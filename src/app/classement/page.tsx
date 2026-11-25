import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site-config";
import { OFFER_MAX_AGE_DAYS } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Comment nous classons les offres",
  description: "Critères de référencement et de classement des offres, relations avec les vendeurs et rémunération.",
};

// Informations exigées des comparateurs en ligne (Code de la consommation, art. L111-7 et D111-7 à D111-10).
export default function Page() {
  const c = siteConfig();
  return (
    <LegalPage title="Comment nous classons les offres" updated="25 novembre 2026">
      <section>
        <h2>Qui est référencé</h2>
        <ul>
          <li>Les smartphones commercialisés en France depuis le 1er janvier 2023, sauf les marques retirées du site (voir <Link href="/couverture">Sources et couverture</Link>).</li>
          <li>Les offres des vendeurs dont les prix sont relevés automatiquement : Apple, Samsung, Xiaomi et Google (boutiques officielles françaises).</li>
          <li>Aucun vendeur ne paie pour être référencé. Un modèle sans offre reste consultable dans le catalogue.</li>
        </ul>
      </section>
      <section>
        <h2>Critères de classement</h2>
        <ul>
          <li>Seules les offres disponibles, relevées il y a moins de {OFFER_MAX_AGE_DAYS} jours, pour la capacité exacte et dans l&apos;état choisi sont prises en compte.</li>
          <li>« Dans ton budget, frais inclus » : seulement si le coût total (prix, frais obligatoires et livraison) est connu et ne dépasse pas ton budget.</li>
          <li>« Frais à vérifier » : le prix affiché respecte ton budget mais le vendeur ne publie pas tous ses frais.</li>
          <li>L&apos;ordre suit tes priorités : prix le plus bas, photo, autonomie, jeux, usage à une main ou durée de suivi logiciel. Chaque carte explique en une phrase pourquoi le modèle ressort.</li>
          <li>Le classement ne dépend d&apos;aucune rémunération.</li>
        </ul>
      </section>
      <section>
        <h2>Relations avec les vendeurs et rémunération</h2>
        <p>
          {c.affiliate
            ? "Certains liens vers les vendeurs sont des liens d'affiliation : Cadran peut percevoir une commission si tu achètes après avoir cliqué. Cette commission n'a aucune influence sur le classement, et le prix payé reste le même."
            : "Cadran n'a aujourd'hui aucun lien capitalistique ni contractuel avec les vendeurs référencés et ne perçoit aucune commission sur les achats."}
        </p>
      </section>
      <section>
        <h2>Limites</h2>
        <ul>
          <li>Les caractéristiques sont annoncées par les fabricants ; elles ne sont pas mesurées par Cadran.</li>
          <li>Les prix peuvent changer entre le relevé et ta visite : la date de relevé est affichée sur chaque offre. Vérifie toujours le total chez le vendeur.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
