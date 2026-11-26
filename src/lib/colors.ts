// Teintes approchées des coloris annoncés par les fabricants. Les fabricants publient un NOM de coloris
// (« Noir Stellaire », « Blanc Perle »), jamais un code couleur : la teinte affichée est une approximation
// choisie d'après les mots du nom, et la maquette le dit.

export interface Swatch { name: string; hex: string; approx: true }

const WORDS: [RegExp, string][] = [
  [/menthe|mint|vert d'eau|aqua|turquoise|cyan|lagon/i, "#8fcfc0"],
  [/lavande|lilas|lavender|mauve/i, "#b9a7d8"],
  [/rose|pink|corail|coral|p[êe]che|peach|saumon/i, "#e7b2bd"],
  [/violet|purple|pourpre|am[ée]thyste|prune/i, "#6d5a92"],
  [/marine|navy|nuit|minuit|midnight|saphir|sapphire|oc[ée]an|ocean|abyss/i, "#25324d"],
  [/bleu|blue|ciel|sky|azur|glacier|icy/i, "#5677a8"],
  [/vert|green|for[êe]t|forest|olive|jade|émeraude|emerald|sauge|sage|kaki/i, "#4f7458"],
  [/jaune|yellow|citron|lemon|soleil|sun/i, "#e9d36a"],
  [/orange|mandarine|ambre|amber|cuivre|copper/i, "#d9783e"],
  [/rouge|red|bordeaux|cerise|rubis|ruby/i, "#a3322f"],
  [/or\b|gold|dor[ée]|champagne|sable|sand|beige|cr[èe]me|cream|ivoire|ivory|lin|desert|d[ée]sert/i, "#d9c7a5"],
  [/argent|silver|chrome|platine|platinum/i, "#c8ccd2"],
  [/titane|titanium|gris|grey|gray|graphite|ardoise|slate|acier|steel|lune|moon/i, "#7f838a"],
  [/blanc|white|perle|pearl|neige|snow|nacre|porcelaine|lumi[èe]re/i, "#eceae4"],
  [/noir|black|obsidienne|obsidian|onyx|carbone|carbon|[ée]b[èe]ne|phantom|minuit|stellaire|cosmique|cosmic|ombre|shadow/i, "#1d1d20"],
];

export function swatchFor(name: string): Swatch {
  const hex = WORDS.find(([re]) => re.test(name))?.[1] ?? "#5b5e66";
  return { name, hex, approx: true };
}

/** Coloris d'exemple quand aucun coloris officiel n'est relevé. */
export const GENERIC_SWATCHES: Swatch[] = [
  { name: "Noir", hex: "#1d1d20", approx: true },
  { name: "Blanc", hex: "#eceae4", approx: true },
  { name: "Bleu", hex: "#5677a8", approx: true },
];

export function swatches(names: unknown): { list: Swatch[]; official: boolean } {
  const arr = Array.isArray(names) ? names.filter((x): x is string => typeof x === "string" && x.length > 1 && x.length < 40) : [];
  const uniq = [...new Set(arr)].slice(0, 6);
  return uniq.length ? { list: uniq.map(swatchFor), official: true } : { list: GENERIC_SWATCHES, official: false };
}
