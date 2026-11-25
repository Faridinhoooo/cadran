import { NextResponse } from "next/server";
import { merchantSyncs } from "@/lib/queries";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * État de santé pour un service de surveillance (UptimeRobot, Better Stack…) :
 * 200 si les prix ont été relevés avec succès dans les 36 dernières heures, 503 sinon.
 */
export function GET() {
  const syncs = merchantSyncs();
  const last = syncs.map((s) => s.lastOk).filter((x): x is string => !!x).sort().pop() ?? null;
  const ageHours = last ? Math.round(((Date.now() - new Date(last).getTime()) / 36e5) * 10) / 10 : null;
  const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
  const active = (getDb().prepare("SELECT COUNT(*) n FROM offers WHERE available=1 AND is_test=0 AND checked_at >= ?").get(cutoff) as { n: number }).n;
  const failing = syncs.filter((s) => s.lastFailed).map((s) => s.source);
  const healthy = ageHours !== null && ageHours <= 36 && active > 0;
  return NextResponse.json(
    { status: healthy ? "ok" : "degrade", lastPriceImport: last, ageHours, activeOffers: active, failingSources: failing, sources: syncs },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
