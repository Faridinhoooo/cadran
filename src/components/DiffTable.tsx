"use client";

import { useState } from "react";

export interface DiffRow {
  group: string;
  label: string;
  values: string[];
}

/**
 * Tableau comparatif. Ordinateur : jusqu'à trois colonnes alignées. Mobile : deux modèles lisibles côte à côte,
 * le second remplaçable par le troisième ; les noms restent visibles en haut pendant la lecture.
 */
export function DiffTable({ names, rows }: { names: string[]; rows: DiffRow[] }) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  // Paire visible sur mobile : toujours le premier, puis le deuxième ou le troisième.
  const [second, setSecond] = useState(1);
  const shownOnMobile = (i: number) => i === 0 || i === second;
  const cell = (i: number) => (names.length > 2 && !shownOnMobile(i) ? "hidden sm:table-cell" : "");
  const visible = rows.filter((r) => !onlyDiff || new Set(r.values).size > 1);
  let lastGroup = "";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
        <label className="flex items-center gap-3 min-h-[44px] font-semibold">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="w-5 h-5 accent-[var(--red)]" />
          Afficher seulement les différences
        </label>
        {names.length > 2 && (
          <fieldset className="sm:hidden flex flex-wrap items-center gap-2">
            <legend className="sr-only">Modèle comparé au N°1</legend>
            <span className="text-sm text-muted">Comparer {names[0]} avec :</span>
            {names.slice(1).map((n, k) => (
              <button key={n} type="button" aria-pressed={second === k + 1} onClick={() => setSecond(k + 1)}
                className={`px-3 py-2 min-h-[40px] rounded-full border-2 text-sm font-semibold ${second === k + 1 ? "border-red bg-red-soft" : "border-line"}`}>
                {n}
              </button>
            ))}
          </fieldset>
        )}
      </div>
      <div className="sm:overflow-x-auto bg-panel rounded-3xl">
        <table className="specs w-full text-sm sm:min-w-[560px] table-fixed sm:table-auto">
          <caption className="sr-only">Comparaison des caractéristiques</caption>
          <thead className="sticky top-14 sm:static z-10">
            <tr>
              <th scope="col" className="w-[30%] sm:w-[28%] bg-panel">Caractéristique</th>
              {names.map((n, i) => <th key={n} scope="col" className={`font-extrabold bg-panel ${cell(i)}`}>{n}</th>)}
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
                  <th scope="row" className="font-normal text-muted bg-panel break-words">
                    {r.label}
                    {differs && <span className="sr-only"> (diffère)</span>}
                  </th>
                  {r.values.map((v, i) => <td key={i} className={`break-words ${cell(i)} ${/^(Non renseigné|Non publié|Aucune offre)/.test(v) ? "text-muted" : ""}`}>{v}</td>)}
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
