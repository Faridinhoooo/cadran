import type { Metadata } from "next";
import { Field, LegalPage } from "@/components/LegalPage";
import { MISSING, siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentions légales", description: "Éditeur, hébergeur et contact du site PickJust." };

export default function Page() {
  const c = siteConfig();
  return (
    <LegalPage title="Mentions légales" updated="26 novembre 2026">
      <section>
        <h2>Éditeur du site</h2>
        {c.nonProfessional ? (
          <>
            <p>
              PickJust est un site d&apos;information gratuit, édité à titre non professionnel par un particulier, sans publicité ni
              activité commerciale. Conformément à l&apos;article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
              l&apos;économie numérique, l&apos;éditeur a choisi de ne pas rendre publique son identité ; les éléments permettant de
              l&apos;identifier ont été communiqués à l&apos;hébergeur.
            </p>
            <dl className="mt-3">
              <Field label="Contact" value={c.editor.email} missing={MISSING} />
            </dl>
          </>
        ) : (
        <dl className="mt-3">
          <Field label="Nom ou raison sociale" value={c.editor.name} missing={MISSING} />
          <Field label="Statut" value={c.editor.status} missing={MISSING} />
          <Field label="Adresse" value={c.editor.address} missing={MISSING} />
          <Field label="SIREN" value={c.editor.siren} missing={MISSING} />
          <Field label="Contact" value={c.editor.email} missing={MISSING} />
          <Field label="Directeur de la publication" value={c.editor.publicationDirector} missing={MISSING} />
        </dl>
        )}
      </section>
      <section>
        <h2>Hébergeur</h2>
        <dl className="mt-3">
          <Field label="Nom" value={c.host.name} missing={MISSING} />
          <Field label="Adresse" value={c.host.address} missing={MISSING} />
          {c.host.phone || !c.host.contact
            ? <Field label="Téléphone" value={c.host.phone} missing={MISSING} />
            : <Field label="Contact" value={c.host.contact} missing={MISSING} />}
        </dl>
      </section>
      <section>
        <h2>Propriété intellectuelle et sources</h2>
        <p>
          Les textes, l&apos;interface et les illustrations génériques du site appartiennent à l&apos;éditeur. Les caractéristiques et prix
          proviennent des sources citées sur chaque fiche et sur la page <a href="/couverture">Sources et couverture</a>. Les photos
          produit restent la propriété de leurs auteurs ; leur licence et leur auteur sont indiqués sous chaque image. Les marques
          citées appartiennent à leurs titulaires.
        </p>
      </section>
      <section>
        <h2>Signaler une erreur</h2>
        <p>Un prix, une caractéristique ou une date inexacte ? Écris-nous à l&apos;adresse de contact ci-dessus en indiquant la fiche concernée.</p>
      </section>
    </LegalPage>
  );
}
