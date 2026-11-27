"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "cadran-comparer";
const EVT = "cadran-comparer-change";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

function useSelection() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}

export function CompareToggle({ id, name }: { id: string; name: string }) {
  const ids = useSelection();
  const on = ids.includes(id);
  const full = !on && ids.length >= 3;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={full}
      onClick={() => write(on ? ids.filter((x) => x !== id) : [...ids, id])}
      className={`text-sm font-semibold px-4 py-2 min-h-[44px] border rounded-full ${on ? "border-red text-text bg-red-soft" : "border-line text-muted hover:text-text"} disabled:opacity-40`}
    >
      {on ? "✓ Dans le comparateur" : full ? "Comparateur plein (3)" : "+ Comparer"}
      <span className="sr-only"> {name}</span>
    </button>
  );
}

export function CompareTray() {
  const ids = useSelection();
  if (!ids.length) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-page/95 backdrop-blur-xl border-t border-line shadow-[0_-12px_30px_-18px_rgba(15,15,18,0.3)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold">{ids.length} téléphone{ids.length > 1 ? "s" : ""} sélectionné{ids.length > 1 ? "s" : ""} (2 ou 3 pour comparer)</p>
        <button type="button" onClick={() => write([])} className="text-sm underline text-muted ml-auto">Vider</button>
        {ids.length >= 2 ? (
          <Link href={`/comparer?ids=${ids.join(",")}`} className="btn btn-primary min-h-[44px] text-sm">Comparer</Link>
        ) : (
          <span className="text-sm text-muted">Ajoute encore un téléphone</span>
        )}
      </div>
    </div>
  );
}
