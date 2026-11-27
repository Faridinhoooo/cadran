import { priceStatus } from "@/lib/price";
import { euros } from "@/lib/format";
import type { OfferLite } from "@/lib/engine";

type Offer = Pick<OfferLite, "price" | "mandatory_fees" | "shipping"> & { capacity_status?: string };

/** Montant + mention de frais, identiques sur toutes les pages. */
export function PriceTag({ offer, budget, size = "md", note = true }: { offer: Offer; budget?: number | null; size?: "sm" | "md" | "lg" | "xl"; note?: boolean }) {
  const p = priceStatus(offer, budget);
  const big = { sm: "text-lg", md: "text-xl", lg: "text-2xl", xl: "text-3xl" }[size];
  return (
    <div className="leading-tight">
      <p>
        <span className={`font-extrabold tabular-nums ${big}`}>{euros(p.amount)}</span>{" "}
        <span className={`text-sm font-semibold ${p.kind === "total" ? "text-ok" : "text-warn"}`}>{p.kind === "total" ? "✓ " : ""}{p.label}</span>
      </p>
      {note && p.budgetNote && <p className="text-xs text-muted mt-1">{p.budgetNote}</p>}
    </div>
  );
}
