import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { MISSING, siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confidentialité et cookies", description: "Données traitées par Cadran : aucun compte, aucun cookie de suivi." };

export default function Page() {
  const c = siteConfig();
  return (
    <LegalPage title="Confidentialité et cookies" updated="25 novembre 2026">
      <section>
        <h2>En bref</h2>
        <ul>
          <li>Aucun compte, aucune inscription, aucun formulaire de données personnelles.</li>
          <li>Aucun cookie publicitaire ni outil de mesure d&apos;audience tiers : aucun bandeau de consentement n&apos;est donc nécessaire.</li>
          <li>Tes réponses au questionnaire restent dans ton navigateur et dans l&apos;adresse de la page de résultats.</li>
        </ul>
      </section>
      <section>
        <h2>Ce qui est enregistré dans ton navigateur</h2>
        <ul>
          <li><strong>Questionnaire</strong> (stockage de session) : tes réponses en cours, pour revenir en arrière sans les perdre. Effacé à la fermeture de l&apos;onglet.</li>
          <li><strong>Comparateur</strong> (stockage local) : la liste des téléphones à comparer. Tu peux la vider avec le bouton « Vider ».</li>
        </ul>
        <p>Ces éléments sont strictement nécessaires au service que tu demandes ; ils ne sont jamais transmis à nos serveurs ni à des tiers.</p>
      </section>
      <section>
        <h2>Journaux techniques</h2>
        <p>
          Comme tout site, l&apos;hébergeur conserve des journaux techniques (adresse IP, page demandée, date) pour la sécurité et le bon
          fonctionnement du service, pendant une durée limitée. Ils ne servent à aucun profilage.
        </p>
      </section>
      <section>
        <h2>Contenus de tiers</h2>
        <p>
          Certaines photos produit sont chargées depuis Wikimedia Commons ou Icecat : ces services reçoivent alors ton adresse IP, comme
          pour toute image publiée sur le web. Les liens « Voir l&apos;offre » ou « Vérifier chez le vendeur » t&apos;emmènent sur le site du
          vendeur, qui applique sa propre politique de confidentialité.
          {c.affiliate && " Certains de ces liens sont des liens d'affiliation : le vendeur peut alors savoir que tu viens de Cadran."}
        </p>
      </section>
      <section>
        <h2>Tes droits</h2>
        <p>
          Pour toute question sur tes données ou pour exercer tes droits (accès, rectification, effacement), écris à :{" "}
          {c.editor.email ?? <span className="text-warn">{MISSING}</span>}. Tu peux aussi saisir la CNIL (cnil.fr).
        </p>
      </section>
    </LegalPage>
  );
}
