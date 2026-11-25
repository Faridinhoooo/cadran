"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/trouver", label: "Trouver mon smartphone", match: ["/trouver", "/resultats"] },
  { href: "/catalogue", label: "Catalogue", match: ["/catalogue", "/telephone"] },
  { href: "/comparer", label: "Comparer", match: ["/comparer"] },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-wrap gap-1 text-sm font-semibold sm:ml-auto">
      {NAV.map((n) => {
        const on = n.match.some((m) => path.startsWith(m));
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`px-3 py-2.5 border-b-2 ${on ? "border-red text-text" : "border-transparent text-muted hover:text-text"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
