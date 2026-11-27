"use client";

/** Ouvre le panneau « Toutes les caractéristiques » (élément <details>) et y fait défiler la page. */
export function MoreSpecsButton({ target, children }: { target: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${target}`}
      className="btn btn-ghost min-h-[44px] text-sm"
      onClick={(e) => {
        const d = document.getElementById(target) as HTMLDetailsElement | null;
        if (!d) return;
        e.preventDefault();
        d.open = true;
        d.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", `#${target}`);
      }}
    >
      {children}
    </a>
  );
}
