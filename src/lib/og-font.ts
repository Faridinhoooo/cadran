// Police d'affichage (Outfit 700) pour les images générées (partage, icônes). Chargée une fois, au build ;
// en cas d'échec réseau, l'image est quand même produite avec la police par défaut.
let cached: Promise<ArrayBuffer | null> | null = null;

export function archivoBlack(): Promise<ArrayBuffer | null> {
  cached ??= (async () => {
    try {
      const css = await (await fetch("https://fonts.googleapis.com/css2?family=Outfit:wght@700", { signal: AbortSignal.timeout(8000) })).text();
      const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
      if (!url) return null;
      return await (await fetch(url, { signal: AbortSignal.timeout(8000) })).arrayBuffer();
    } catch {
      return null;
    }
  })();
  return cached;
}

export async function ogFonts() {
  const data = await archivoBlack();
  return data ? [{ name: "Outfit", data, weight: 700 as const, style: "normal" as const }] : undefined;
}
