"use client";

import { useState } from "react";

export interface DiffRow {
  group: string;
  label: string;
  values: string[];
}

export function DiffTable({ names, rows }: { names: string[]; rows: DiffRow[] }) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const visible = rows.filter((r) => !onlyDiff || new Set(r.values).size > 1);
  let lastGroup = "";
  return (
    <div>
      <label className="flex items-center gap-3 min-h-[44px] font-semibold mb-3">
        <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="w-5 h-5 accent-[var(--red)]" />
        Afficher seulement les différences
      </label>
      <div className="overflow-x-auto border border-line bg-panel">
        <table className="specs w-full text-sm min-w-[560px]">
          <caption className="sr-only">Comparaison des caractéristiques</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[28%] sticky left-0 bg-panel">Caractéristique</th>
              {names.map((n) => <th key={n} scope="col" className="font-extrabold">{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const head = r.group !== lastGroup;
              lastGroup = r.group;
              const differs = new Set(r.values).size > 1;
              return [
                head && (
                  <tr key={`g-${r.group}`}>
                    <th colSpan={names.length + 1} scope="colgroup" className="text-red uppercase text-xs tracking-wider pt-4">{r.group}</th>
                  </tr>
                ),
                <tr key={`${r.group}-${r.label}`}>
                  <th scope="row" className="font-normal text-muted sticky left-0 bg-panel">
                    {r.label}
                    {differs && <span className="sr-only"> (diffère)</span>}
                  </th>
                  {r.values.map((v, i) => <td key={i} className={v === "Non renseigné" ? "text-muted" : ""}>{v}</td>)}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      {onlyDiff && visible.length === 0 && <p className="text-muted mt-3">Aucune différence sur les caractéristiques renseignées.</p>}
    </div>
  );
}
