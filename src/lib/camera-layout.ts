// Disposition du bloc photo par gamme (data/sources/camera-layouts.json), pour la maquette 3D indicative.
import fs from "node:fs";
import path from "node:path";

export interface CameraLayout {
  island: "none" | "square" | "pill-v" | "pill-h" | "circle" | "bar";
  position: "tl" | "tc";
  arrange: "column" | "row" | "grid" | "triangle" | "ring" | "column-plus";
  front: "punch" | "pill" | "drop";
  /** Page officielle dont le visuel a été regardé, ou null (disposition générique). */
  verified: string | null;
  /** Nombre d'objectifs de la gamme (si la fiche ne le donne pas). */
  lenses?: number;
}

type Rule = CameraLayout & { match: string };
let cache: { rules: Rule[]; default: CameraLayout } | null = null;

function load() {
  cache ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sources", "camera-layouts.json"), "utf8"));
  return cache!;
}

export function cameraLayout(modelId: string): CameraLayout {
  const { rules, default: def } = load();
  const r = rules.find((x) => new RegExp(x.match).test(modelId));
  if (!r) return def;
  const { island, position, arrange, front, verified, lenses } = r;
  return { island, position, arrange, front, verified, ...(lenses ? { lenses } : {}) };
}
