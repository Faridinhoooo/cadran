// Identité PickJust : « pick » (choisir) + « just » (le juste choix, le prix juste).
// Symbole : une tuile arrondie rouge frappée d'une coche blanche — le bon choix, validé.

export const BRAND = { name: "PickJust", red: "#e0222c", ink: "#0f0f12", text: "#111114" };

/** Symbole seul (favicon, application, réseaux). */
export function LogoMark({ size = 32, className = "", title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M0 18A18 18 0 0 1 18 0H46A18 18 0 0 1 64 18V46A18 18 0 0 1 46 64H18A18 18 0 0 1 0 46Z" fill={BRAND.red} />
      <path d="M17 33 L28 44 L48 22" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Logo complet : symbole + nom (« Pick » encre, « Just » rouge). */
export function Logo({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="display leading-none font-bold tracking-[-0.03em]" style={{ fontSize: size * 0.82 }}>
        Pick<span className="text-red">Just</span>
      </span>
    </span>
  );
}
