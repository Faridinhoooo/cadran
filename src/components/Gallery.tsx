"use client";
/* eslint-disable @next/next/no-img-element */

import { createElement, useState } from "react";
import { illustrationFor } from "@/lib/visual";

export interface GalleryMedia {
  id: number;
  kind: "photo" | "3d";
  view: string | null;
  url: string;
  thumb_url: string | null;
  license: string;
  author: string | null;
  source_url: string;
  provider: string;
  color: string | null;
}

const VIEW: Record<string, string> = { face: "Face", dos: "Dos", profil: "Profil", autre: "Vue" };
const MV_SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";

let mvLoading: Promise<void> | null = null;
function loadModelViewer(): Promise<void> {
  if (customElements.get("model-viewer")) return Promise.resolve();
  mvLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "module";
    s.src = MV_SRC;
    s.onload = () => resolve();
    s.onerror = () => {
      mvLoading = null;
      reject(new Error("chargement impossible"));
    };
    document.head.appendChild(s);
  });
  return mvLoading;
}

export function Gallery({ name, media, form }: { name: string; media: GalleryMedia[]; form?: string | null }) {
  const photos = media.filter((m) => m.kind === "photo");
  const model3d = media.find((m) => m.kind === "3d");
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<"photo" | "3d" | "chargement">("photo");
  const [err, setErr] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const cur = photos[idx];

  async function open3d() {
    setErr(null);
    setMode("chargement");
    try {
      await loadModelViewer();
      setMode("3d");
    } catch {
      setErr("La vue 3D n'a pas pu être chargée. La photo reste disponible.");
      setMode("photo");
    }
  }

  return (
    <div>
      <div className="relative aspect-[4/3] sm:aspect-square bg-[linear-gradient(160deg,#f1f1f3,#dcdce0)] grid place-items-center overflow-hidden cut">
        {mode === "3d" && model3d ? (
          createElement("model-viewer", {
            src: model3d.url,
            alt: `Modèle 3D du ${name}`,
            "camera-controls": "",
            "touch-action": "pan-y",
            style: { width: "100%", height: "100%" },
            onError: () => {
              setErr("La vue 3D n'a pas pu être affichée. La photo reste disponible.");
              setMode("photo");
            },
          })
        ) : cur && !broken.has(cur.id) ? (
          <img src={cur.thumb_url ?? cur.url} alt={`${name} — ${VIEW[cur.view ?? "autre"]?.toLowerCase() ?? "vue"}`} className="w-full h-full object-contain mix-blend-multiply"
            onError={() => setBroken((b) => new Set(b).add(cur.id))} />
        ) : (
          <>
            <img src={illustrationFor(form)} alt={`Illustration indicative (${name})`} className="w-full h-full object-contain p-[10%]" />
            <span className="absolute bottom-2 right-3 text-xs font-semibold text-ink/60">Illustration indicative — aucun visuel autorisé disponible</span>
          </>
        )}
        {mode === "chargement" && <p className="absolute inset-0 grid place-items-center bg-white/80 text-ink font-bold" role="status">Chargement de la vue 3D…</p>}
      </div>

      {photos.length > 1 && mode !== "3d" && (
        <div className="flex gap-2 mt-3 overflow-x-auto sm:flex-wrap pb-1" role="group" aria-label="Vues disponibles">
          {photos.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setIdx(i)} aria-pressed={i === idx} className={`shrink-0 w-16 h-16 bg-white/95 border-2 ${i === idx ? "border-red" : "border-transparent"}`}>
              <img src={p.thumb_url ?? p.url} alt="" className="w-full h-full object-contain" />
              <span className="sr-only">Afficher la vue {VIEW[p.view ?? "autre"]} {i + 1}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-3">
        {model3d && mode !== "3d" && (
          <button type="button" className="btn btn-ghost min-h-[44px] text-sm" onClick={open3d}>Voir en 3D</button>
        )}
        {mode === "3d" && (
          <button type="button" className="btn btn-ghost min-h-[44px] text-sm" onClick={() => setMode("photo")}>Revenir à la photo</button>
        )}
      </div>
      {err && <p role="alert" className="text-sm text-warn mt-2">{err}</p>}

      {cur && mode !== "3d" && (
        <p className="text-xs text-muted mt-2">
          {VIEW[cur.view ?? "autre"]} · Photo {cur.author ? `: ${cur.author}` : ""}, {cur.license}, via{" "}
          <a href={cur.source_url} className="underline" target="_blank" rel="noopener noreferrer">{cur.provider}</a>. Le coloris illustré peut différer du coloris sélectionné.
        </p>
      )}
    </div>
  );
}
