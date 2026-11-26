"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/trouver", label: "Trouver mon smartphone", short: "Trouver", match: ["/trouver", "/resultats"] },
  { href: "/catalogue", label: "Catalogue", match: ["/catalogue", "/telephone"] },
  { href: "/comparer", label: "Comparer", match: ["/comparer"] },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex gap-0.5 sm:gap-1 text-[13px] sm:text-sm font-semibold ml-auto overflow-x-auto whitespace-nowrap no-scrollbar -mr-2 sm:mr-0">
      {NAV.map((n) => {
        const on = n.match.some((m) => path.startsWith(m));
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`px-1.5 sm:px-3 py-2.5 border-b-2 ${on ? "border-red text-text" : "border-transparent text-muted hover:text-text"}`}
          >
            {"short" in n ? <><span className="sm:hidden">{n.short}</span><span className="hidden sm:inline">{n.label}</span></> : n.label}
          </Link>
        );
      })}
    </nav>
  );
}
