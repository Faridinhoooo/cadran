import type { Metadata } from "next";
import Link from "next/link";
import { configsFor, getBrand, getModel, mediaFor, specsFor, specMap, supportFor } from "@/lib/queries";
import { isFresh, offerTotal } from "@/lib/engine";
import { NR, euros, releaseLabel, specText, storageLabel } from "@/lib/format";
import { securityDeadline, securityHeadline } from "@/lib/support";
import { Thumb } from "@/components/ui";
import { DiffTable, type DiffRow } from "@/components/DiffTable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comparer des smartphones", description: "Compare jusqu'à quatre smartphones côte à côte : prix relevés, écran, puce, photo, autonomie et durée des mises à jour, avec la source de chaque valeur.", alternates: { canonical: "/comparer" } };

const KEYS: [string, string, string][] = [
  ["Écran", "screen_in", "Diagonale"], ["Écran", "screen_tech", "Technologie"], ["Écran", "resolution", "Résolution"], ["Écran", "refresh_hz", "Fréquence"],
  ["Format", "height_mm", "Hauteur"], ["Format", "width_mm", "Largeur"], ["Format", "thickness_mm", "Épaisseur"], ["Format", "weight_g", "Poids"],
  ["Performances", "chip", "Processeur"], ["Performances", "ram_gb", "RAM"], ["Performances", "expandable", "Extension microSD"],
  ["Photo et vidéo", "cameras", "Appareils photo"], ["Photo et vidéo", "ois", "Stabilisation optique"], ["Photo et vidéo", "optical_zoom", "Zoom optique"], ["Photo et vidéo", "video", "Vidéo"],
  ["Batterie", "battery_mah", "Capacité"], ["Batterie", "charge_w", "Charge filaire"], ["Batterie", "wireless", "Sans fil"],
  ["Connectivité", "five_g", "5G"], ["Connectivité", "esim", "eSIM"], ["Connectivité", "nfc", "NFC"], ["Connectivité", "ip", "Indice de protection"],
];

export default async function Page({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids = "" } = await searchParams;
  const today = new Date();
  const wanted = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3).map((s) => {
    const [id, go] = s.split(":");
    return { id, go: go ? Number(go) : null };
  });
  const items = wanted.map(({ id, go }) => {
    const m = getModel(id);
    if (!m) return null;
    const configs = configsFor(id);
    const sel = configs.find((c) => c.storage_gb === go) ?? configs.find((c) => c.offers.some((o) => isFresh(o, today))) ?? configs[0] ?? null;
    const best = (cond: string) => sel?.offers.filter((o) => o.condition === cond && isFresh(o, today) && offerTotal(o) !== null).sort((a, b) => offerTotal(a)! - offerTotal(b)!)[0] ?? null;
    return { m, configs, sel, specs: specMap(specsFor(id)), support: supportFor(id), thumb: mediaFor(id)[0] ?? null, brand: getBrand(m.brand_id), neuf: best("neuf"), reco: best("reconditionne") };
  }).filter((x): x is NonNullable<typeof x> => !!x);

  if (items.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <h1 className="display text-4xl sm:text-6xl">Comparer</h1>
        <p className="text-muted mt-4">Choisis deux ou trois téléphones dans le catalogue avec le bouton « + Comparer », puis reviens ici.</p>
        <Link href="/catalogue" className="btn btn-primary mt-6">Ouvrir le catalogue</Link>
      </div>
    );
  }

  const param = (override: { id: string; go: number }) =>
    items.map((it) => (it.m.id === override.id ? `${it.m.id}:${override.go}` : `${it.m.id}${it.sel ? `:${it.sel.storage_gb}` : ""}`)).join(",");

  const rows: DiffRow[] = [
    { group: "Prix et suivi", label: "Capacité choisie", values: items.map((i) => (i.sel ? storageLabel(i.sel.storage_gb) : NR)) },
    { group: "Prix et suivi", label: "Neuf (coût total)", values: items.map((i) => (i.neuf ? `${euros(offerTotal(i.neuf)!)} · ${i.neuf.seller}` : "Aucune offre vérifiée")) },
    { group: "Prix et suivi", label: "Reconditionné (coût total)", values: items.map((i) => (i.reco ? `${euros(offerTotal(i.reco)!)} · ${i.reco.seller}` : "Aucune offre vérifiée")) },
    { group: "Prix et suivi", label: "Sécurité restante", values: items.map((i) => securityHeadline(securityDeadline(i.support, today))) },
    { group: "Prix et suivi", label: "Sortie", values: items.map((i) => { const r = releaseLabel(i.m); return r.note ? `${r.date} (mondiale)` : r.date; }) },
    { group: "Prix et suivi", label: "Origine de la marque", values: items.map((i) => i.brand?.origin_country ?? NR) },
    ...KEYS.map(([group, key, label]) => ({
      group, label,
      values: items.map((i) => (key === "ram_gb" && i.sel?.ram_gb ? specText(key, i.sel.ram_gb) : specText(key, i.specs[key]))),
    })),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="display text-4xl sm:text-6xl">Comparer</h1>
      <div className={`grid gap-4 mt-6 ${items.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
        {items.map((i) => (
          <div key={i.m.id} className="bg-panel rounded-3xl p-4 flex gap-4 sm:flex-col">
            <Thumb media={i.thumb} alt={i.m.name} form={i.m.form_factor} size={96} />
            <div className="min-w-0">
              <h2 className="font-extrabold text-lg leading-tight"><Link href={`/telephone/${i.m.id}${i.sel ? `?go=${i.sel.storage_gb}` : ""}`} className="hover:text-red">{i.m.name}</Link></h2>
              {i.configs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label={`Capacité du ${i.m.name}`}>
                  {i.configs.map((c) => (
                    <Link key={c.id} href={`/comparer?ids=${param({ id: i.m.id, go: c.storage_gb })}`} aria-current={c.id === i.sel?.id ? "true" : undefined}
                      className={`px-3.5 py-1.5 min-h-[40px] grid place-items-center text-sm border-2 rounded-full font-semibold ${c.id === i.sel?.id ? "border-red" : "border-line"}`}>
                      {storageLabel(c.storage_gb)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <DiffTable names={items.map((i) => i.m.name)} rows={rows} />
      </div>
      <p className="text-xs text-muted mt-3">Caractéristiques annoncées par les fabricants. Prix pour la capacité choisie, offres vérifiées il y a moins de 7 jours.</p>
    </div>
  );
}
