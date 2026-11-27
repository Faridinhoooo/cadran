// Liens de recherche neutres vers des comparateurs et places de marché publics, pour les modèles dont PickJust
// n'affiche pas (ou pas encore) de prix. Aucun lien d'affiliation, aucun paramètre de suivi : PickJust ne touche rien.

export interface ShopLink {
  id: "google" | "idealo" | "backmarket" | "ebay" | "leboncoin";
  label: string;
  hint: string;
  url: string;
}

/** Requête de recherche : marque + modèle, sans répéter la marque si le nom la contient déjà. */
export function searchQuery(brandName: string, modelName: string, storageGb?: number | null): string {
  const base = modelName.toLowerCase().startsWith(brandName.toLowerCase()) ? modelName : `${brandName} ${modelName}`;
  const cap = storageGb ? ` ${storageGb >= 1024 ? `${storageGb / 1024} To` : `${storageGb} Go`}` : "";
  return `${base}${cap}`.replace(/\s+/g, " ").trim();
}

export function shopLinks(brandName: string, modelName: string, storageGb?: number | null): ShopLink[] {
  const q = encodeURIComponent(searchQuery(brandName, modelName, storageGb));
  return [
    { id: "google", label: "Rechercher sur Google Shopping", hint: "Neuf, toutes enseignes", url: `https://www.google.com/search?udm=28&q=${q}` },
    { id: "idealo", label: "Rechercher sur idealo", hint: "Comparateur de prix", url: `https://www.idealo.fr/prechcat.html?q=${q}` },
    { id: "backmarket", label: "Rechercher sur Back Market", hint: "Reconditionné", url: `https://www.backmarket.fr/fr-fr/search?q=${q}` },
    { id: "ebay", label: "Rechercher sur eBay", hint: "Occasion et neuf", url: `https://www.ebay.fr/sch/i.html?_nkw=${q}` },
  ];
}

/** Recherches d'occasion et de reconditionné (liens neutres). Rakuten France a fermé sa marketplace le 30/09/2026. */
export function usedLinks(brandName: string, modelName: string, storageGb?: number | null, maxPrice?: number | null): ShopLink[] {
  const q = encodeURIComponent(searchQuery(brandName, modelName, storageGb));
  const max = maxPrice ? Math.floor(maxPrice) : null;
  return [
    { id: "backmarket", label: "Rechercher sur Back Market", hint: "Reconditionné par des pros, garanti 12 mois", url: `https://www.backmarket.fr/fr-fr/search?q=${q}` },
    { id: "ebay", label: "Rechercher sur eBay", hint: max ? `Occasion, jusqu'à ${max} €` : "Occasion, vendeurs notés", url: `https://www.ebay.fr/sch/i.html?_nkw=${q}&LH_ItemCondition=3000${max ? `&_udhi=${max}` : ""}` },
    { id: "leboncoin", label: "Rechercher sur Leboncoin", hint: max ? `Entre particuliers, jusqu'à ${max} €` : "Entre particuliers, partout en France", url: `https://www.leboncoin.fr/recherche?category=17&text=${q}${max ? `&price=0-${max}` : ""}` },
  ];
}
