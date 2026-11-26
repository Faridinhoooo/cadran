// Identité de l'éditeur et de l'hébergeur (mentions légales, LCEN art. 6). Valeurs à renseigner par variables
// d'environnement serveur dans .env.local ou chez l'hébergeur — jamais inventées ici.
const v = (k: string) => process.env[k]?.trim() || null;

export function siteConfig() {
  return {
    name: "Cadran",
    url: siteUrl(),
    editor: {
      name: v("EDITEUR_NOM"), // personne physique ou raison sociale
      status: v("EDITEUR_STATUT"), // ex. « Entrepreneur individuel », « SAS au capital de … »
      address: v("EDITEUR_ADRESSE"),
      email: v("EDITEUR_EMAIL") ?? v("EDITEUR_CONTACT"),
      siren: v("EDITEUR_SIREN"),
      publicationDirector: v("DIRECTEUR_PUBLICATION"),
    },
    /** Sans nom d'éditeur déclaré : particulier non professionnel (LCEN art. 6, III, 2 — anonymat possible). */
    nonProfessional: !v("EDITEUR_NOM"),
    host: hostInfo(),
    /** Liens affiliés actifs : à passer à « 1 » dès qu'un flux d'affiliation est branché. */
    affiliate: v("AFFILIATION_ACTIVE") === "1",
  };
}

export const MISSING = "À compléter (variable d'environnement manquante)";

/**
 * Adresse publique du site : SITE_URL si elle est fournie, sinon l'adresse de production que Vercel
 * expose automatiquement (VERCEL_PROJECT_PRODUCTION_URL), sinon le serveur local.
 */
export function siteUrl(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/**
 * Hébergeur : variables HEBERGEUR_* si fournies ; sur Vercel, coordonnées publiées par Vercel Inc. dans ses
 * conditions d'utilisation (https://vercel.com/legal/terms, § 23.3.4). Aucun numéro de téléphone n'y est publié.
 */
function hostInfo() {
  const name = v("HEBERGEUR_NOM");
  if (name || process.env.VERCEL !== "1") {
    return { name, address: v("HEBERGEUR_ADRESSE"), phone: v("HEBERGEUR_TELEPHONE"), contact: null as string | null };
  }
  return {
    name: "Vercel Inc.",
    address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    phone: v("HEBERGEUR_TELEPHONE"),
    contact: "https://vercel.com/help",
  };
}
