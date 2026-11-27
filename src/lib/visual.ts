// Choix du visuel d'une carte, dans l'ordre demandé :
//  1. visuel autorisé détouré du modèle exact ;
//  2. autre photo autorisée du modèle exact (fiche détaillée uniquement : les photos de magasin
//     — main, antivol, étiquette — sont écartées des miniatures) ;
//  3. illustration générique locale, choisie selon la forme connue, légendée « Illustration indicative ».

export interface VisualMedia {
  url: string;
  thumb_url: string | null;
  quality?: string | null;
  kind?: string;
  view?: string | null;
}

export type Visual =
  | { type: "photo"; src: string; fallback: string; cover?: boolean }
  | { type: "illustration"; src: string };

export function illustrationFor(form: string | null | undefined): string {
  if (form === "pliable") return "/illustrations/pliable.svg";
  if (form === "clapet") return "/illustrations/clapet.svg";
  return "/illustrations/smartphone.svg";
}

/** Miniature (catalogue, résultats, comparateur) : un visuel officiel détouré autorisé, sinon l'illustration indicative. */
export function cardVisual(media: VisualMedia[] | VisualMedia | null | undefined, form: string | null | undefined): Visual {
  const list = Array.isArray(media) ? media : media ? [media] : [];
  const fallback = illustrationFor(form);
  const clean = list.find((m) => (m.kind ?? "photo") === "photo" && m.quality === "detoure");
  if (clean) return { type: "photo", src: clean.thumb_url ?? clean.url, fallback };
  // Les photos libres (prises en main, en magasin…) restent dans la galerie de la fiche : sur les cartes, elles
  // rompraient l'homogénéité du catalogue. Option conservée pour une photo libre de qualité studio (cover).
  return { type: "illustration", src: fallback };
}
