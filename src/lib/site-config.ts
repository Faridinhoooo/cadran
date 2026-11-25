// Identité de l'éditeur et de l'hébergeur (mentions légales, LCEN art. 6). Valeurs à renseigner par variables
// d'environnement serveur dans .env.local ou chez l'hébergeur — jamais inventées ici.
const v = (k: string) => process.env[k]?.trim() || null;

export function siteConfig() {
  return {
    name: "Cadran",
    url: v("SITE_URL") ?? "http://localhost:3000",
    editor: {
      name: v("EDITEUR_NOM"), // personne physique ou raison sociale
      status: v("EDITEUR_STATUT"), // ex. « Entrepreneur individuel », « SAS au capital de … »
      address: v("EDITEUR_ADRESSE"),
      email: v("EDITEUR_EMAIL"),
      siren: v("EDITEUR_SIREN"),
      publicationDirector: v("DIRECTEUR_PUBLICATION"),
    },
    host: {
      name: v("HEBERGEUR_NOM"),
      address: v("HEBERGEUR_ADRESSE"),
      phone: v("HEBERGEUR_TELEPHONE"),
    },
    /** Liens affiliés actifs : à passer à « 1 » dès qu'un flux d'affiliation est branché. */
    affiliate: v("AFFILIATION_ACTIVE") === "1",
  };
}

export const MISSING = "À compléter (variable d'environnement manquante)";
