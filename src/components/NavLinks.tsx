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
    <nav aria-label="Navigation principale" className="flex gap-0.5 sm:gap-1 text-[13px] sm:text-sm font-medium ml-auto overflow-x-auto whitespace-nowrap no-scrollbar -mr-2 sm:mr-0">
      {NAV.map((n) => {
        const on = n.match.some((m) => path.startsWith(m));
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`px-2 sm:px-4 py-2 rounded-full transition-colors ${on ? "bg-ink text-white" : "text-muted hover:text-text hover:bg-panel"}`}
          >
            {"short" in n ? <><span className="sm:hidden">{n.short}</span><span className="hidden sm:inline">{n.label}</span></> : n.label}
          </Link>
        );
      })}
    </nav>
  );
}
