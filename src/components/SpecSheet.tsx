// Fiche technique épurée : deux colonnes « libellé | valeur », lignes alternées, aucune phrase superflue.
// La fiabilité de chaque valeur reste visible par un petit symbole (détail au survol et dans la légende).

export interface SpecLine {
  label: string;
  value: string;
  /** officiel | autorise | communautaire | editorial ; null = information de la fiche (marque, sortie…). */
  level: string | null;
  url: string | null;
  measured?: boolean;
}

const MARKS: Record<string, { icon: string; cls: string; label: string }> = {
  officiel: { icon: "✓", cls: "text-ok", label: "Source officielle" },
  autorise: { icon: "✓", cls: "text-ok", label: "Fiche fabricant (Icecat)" },
  communautaire: { icon: "◐", cls: "text-warn", label: "Source communautaire" },
  editorial: { icon: "!", cls: "text-muted", label: "À vérifier" },
};

function Mark({ line }: { line: SpecLine }) {
  if (!line.level) return null;
  const m = MARKS[line.level] ?? MARKS.editorial;
  const inner = (
    <span title={m.label} className={`text-xs font-bold ${m.cls}`}>
      <span aria-hidden>{m.icon}</span>
      <span className="sr-only">{m.label}</span>
    </span>
  );
  return line.url ? (
    <a href={line.url} target="_blank" rel="noopener noreferrer" aria-label={`${m.label} pour « ${line.label} » (nouvel onglet)`} className="hover:opacity-70">
      {inner}
    </a>
  ) : inner;
}

function Column({ lines }: { lines: SpecLine[] }) {
  return (
    <dl>
      {lines.map((l, i) => (
        <div key={l.label} className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] gap-x-4 items-baseline px-4 py-3 rounded-lg ${i % 2 === 0 ? "bg-panel" : ""}`}>
          <dt className="text-sm">{l.label}</dt>
          <dd className="text-sm text-muted break-words">
            {l.value}
            {l.measured && <span className="ml-1.5 text-[11px] font-semibold text-ok">mesuré</span>}
          </dd>
          <dd className="w-4 text-right"><Mark line={l} /></dd>
        </div>
      ))}
    </dl>
  );
}

export function SpecSheet({ lines, footer, legend = true }: { lines: SpecLine[]; footer?: React.ReactNode; legend?: boolean }) {
  const half = Math.ceil(lines.length / 2);
  return (
    <div className="bg-page border border-line rounded-3xl p-4 sm:p-8">
      <div className="grid md:grid-cols-2 gap-x-8 md:divide-x md:divide-line">
        <Column lines={lines.slice(0, half)} />
        <div className="md:pl-8"><Column lines={lines.slice(half)} /></div>
      </div>
      <div className="mt-5 pt-4 border-t border-line flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {legend && <>
          <span><span className="text-ok font-bold" aria-hidden>✓</span> Source officielle</span>
          <span><span className="text-warn font-bold" aria-hidden>◐</span> Communautaire</span>
          <span><span className="font-bold" aria-hidden>!</span> À vérifier</span>
        </>}
        {footer}
      </div>
    </div>
  );
}
