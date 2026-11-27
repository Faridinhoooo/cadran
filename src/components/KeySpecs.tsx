// « L'essentiel » d'un téléphone : puce, batterie, stockage et mémoire vive, avec des jauges situant le modèle
// entre le moins et le plus performant des smartphones du catalogue (hors gaming). Plus une description factuelle.
import { CHIP_LEVELS, percentileBelow, position, type Scales } from "@/lib/scales";
import { normalizeChip, SEGMENT_LABELS, type Segment } from "@/lib/chips";
import { storageLabel } from "@/lib/format";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dec = (v: number) => String(v).replace(".", ",");

export function Gauge({ value, label, detail, from, to }: { value: number; label: string; detail: string; from: string; to: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mt-2">
      <div className="relative h-2.5 bg-panel-2 rounded-full overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label} aria-valuetext={detail}>
        <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,#ff3434,#ffb347_55%,#4ade80)]" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
        {[25, 50, 75].map((t) => <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-page/80" style={{ left: `${t}%` }} />)}
      </div>
      <p className="flex justify-between text-[10px] text-muted mt-1 tabular-nums"><span>{from}</span><span>{to}</span></p>
      <p className="text-xs mt-0.5">{detail}</p>
    </div>
  );
}

/** Description factuelle, uniquement à partir des données connues de la fiche. */
export function describe(p: {
  name: string; brand: string; form: string | null; segment: Segment | null; releaseLabel: string | null;
  specs: Record<string, unknown>; storages: number[]; ram: number | null;
}): string {
  const s = p.specs;
  const chip = normalizeChip(s.chip) ?? (typeof s.chip === "string" ? s.chip : null);
  const score = num(s.chip_score), mah = num(s.battery_mah), inch = num(s.screen_in), hz = num(s.refresh_hz), w = num(s.charge_w);
  const kind = p.form === "pliable" ? "pliable" : p.form === "clapet" ? "à clapet" : null;
  const parts: string[] = [];
  parts.push(`Le ${p.name} est un smartphone${kind ? ` ${kind}` : ""}${p.segment ? ` ${SEGMENT_LABELS[p.segment].toLowerCase()}` : ""} de ${p.brand}${p.releaseLabel ? `, sorti en ${p.releaseLabel}` : ""}.`);
  const core = [
    chip ? `la puce ${chip}${score !== null ? ` (indice de puissance ${score}/100)` : ""}` : null,
    p.ram ? `${p.ram} Go de mémoire vive` : null,
    (() => {
      const st = [...new Set(p.storages.filter((x) => x > 0))].sort((x, y) => x - y);
      if (!st.length) return null;
      return st.length === 1 ? `${storageLabel(st[0])} de stockage` : `de ${storageLabel(st[0])} à ${storageLabel(st[st.length - 1])} de stockage`;
    })(),
  ].filter(Boolean);
  if (core.length) parts.push(`Il embarque ${core.join(", ")}.`);
  const screen = inch ? `un écran de ${dec(inch)}″${typeof s.screen_tech === "string" && s.screen_tech.length < 25 ? ` ${s.screen_tech}` : ""}${hz ? ` à ${hz} Hz` : ""}` : null;
  const battery = mah ? `une batterie de ${mah.toLocaleString("fr-FR")} mAh${w ? ` rechargeable en ${w} W` : ""}` : null;
  if (screen || battery) parts.push(`Il offre ${[screen, battery].filter(Boolean).join(" et ")}.`);
  if (typeof s.cameras === "string") parts.push(`Photo : ${s.cameras}.`);
  return parts.join(" ");
}

export function KeySpecs({ specs, ram, storages, selected, scales }: { specs: Record<string, unknown>; ram: number | null; storages: number[]; selected: number | null; scales: Scales }) {
  const chip = normalizeChip(specs.chip) ?? (typeof specs.chip === "string" ? specs.chip : null);
  const score = num(specs.chip_score), tier = num(specs.chip_tier), mah = num(specs.battery_mah), w = num(specs.charge_w);
  const st = storages.filter((x) => x > 0);
  return (
    <section aria-labelledby="essentiel" className="mt-6">
      <h2 id="essentiel" className="text-xs font-extrabold uppercase tracking-wider text-muted">L&apos;essentiel</h2>
      <dl className="mt-2 grid grid-cols-2 gap-3">
        <div className="bg-panel rounded-3xl p-4 col-span-2">
          <dt className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted font-bold"><span aria-hidden className="text-red text-base">⚡</span> Processeur</dt>
          <dd className="font-extrabold text-lg mt-0.5">{chip ?? "Non publié par le fabricant"}</dd>
          {score !== null && (
            <dd><Gauge value={position(score, scales.chip)} label="Puissance du processeur"
              detail={`Indice ${score}/100${tier ? ` (${CHIP_LEVELS[tier]})` : ""} : plus puissant que ${percentileBelow(score, scales.chip.values)} % des smartphones du catalogue.`}
              from="Moins puissant" to="Plus puissant" /></dd>
          )}
        </div>
        <div className="bg-panel rounded-3xl p-4 col-span-2">
          <dt className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted font-bold"><span aria-hidden className="text-red text-base">▮</span> Batterie</dt>
          <dd className="font-extrabold text-lg mt-0.5">{mah ? `${mah.toLocaleString("fr-FR")} mAh` : "Non publiée par le fabricant"}{w ? <span className="text-sm font-semibold text-muted"> · charge {w} W</span> : null}</dd>
          {mah !== null && (
            <dd><Gauge value={position(mah, scales.battery)} label="Capacité de la batterie"
              detail={`Plus grande que ${percentileBelow(mah, scales.battery.values)} % des smartphones du catalogue (capacité annoncée, pas une mesure d'autonomie).`}
              from={`${scales.battery.min.toLocaleString("fr-FR")} mAh`} to={`${scales.battery.max.toLocaleString("fr-FR")} mAh`} /></dd>
          )}
        </div>
        <div className="bg-panel rounded-3xl p-4">
          <dt className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted font-bold"><span aria-hidden className="text-red text-base">▤</span> Stockage</dt>
          <dd className="font-extrabold text-lg mt-0.5">{selected ? storageLabel(selected) : st.length ? st.map(storageLabel).join(" / ") : "Non publié"}</dd>
          {selected && st.length > 1 && <dd className="text-xs text-muted mt-0.5">Existe aussi en {st.filter((x) => x !== selected).map(storageLabel).join(", ")}</dd>}
        </div>
        <div className="bg-panel rounded-3xl p-4">
          <dt className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted font-bold"><span aria-hidden className="text-red text-base">◫</span> Mémoire vive</dt>
          <dd className="font-extrabold text-lg mt-0.5">{ram ? `${ram} Go` : "Non publiée"}</dd>
        </div>
      </dl>
    </section>
  );
}
