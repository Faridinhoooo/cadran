// Identité PickJust : « pick » (choisir) + « just » (le juste choix, le prix juste).
// Symbole : la tuile à coins coupés de l'interface, frappée d'une coche — le bon choix, validé.

export const BRAND = { name: "PickJust", red: "#ff3434", ink: "#0a0a0b", text: "#f5f5f4" };

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
      <path d="M13 0H64V51L51 64H0V13Z" fill={BRAND.red} />
      <path d="M14 34 L27 47 L51 19" fill="none" stroke={BRAND.ink} strokeWidth="9.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

/** Logo complet : symbole + nom (« Pick » clair, « Just » rouge). */
export function Logo({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="display leading-none tracking-[-0.02em]" style={{ fontSize: size * 0.8 }}>
        PICK<span className="text-red">JUST</span>
      </span>
    </span>
  );
}
