// Réponses du questionnaire ⇄ paramètres d'URL. Toutes les réponses vivent dans l'URL des
// résultats : modifier une réponse ne change que ce paramètre, les autres sont conservées.
import type { Answers, Condition, OsChoice, Priority } from "./engine";
import { parseBudget } from "./money";

const CONDITIONS: Condition[] = ["neuf", "reconditionne", "occasion"];
const PRIORITIES: Priority[] = ["photo", "autonomie", "jeux", "une_main", "longevite", "prix"];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => (one(v) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function parseAnswers(p: Params): Answers | null {
  const parsed = parseBudget(one(p.budget));
  if (!parsed.ok) return null;
  const budget = parsed.value;
  const conditions = list(p.etat).filter((c): c is Condition => CONDITIONS.includes(c as Condition));
  const priorities = list(p.prio).filter((c): c is Priority => PRIORITIES.includes(c as Priority)).slice(0, 2);
  const osRaw = one(p.os);
  const os: OsChoice = osRaw === "ios" || osRaw === "android" ? osRaw : "any";
  const keep = Number(one(p.annees));
  const storage = Number(one(p.stockage));
  return {
    budget,
    conditions: conditions.length ? conditions : ["neuf", "reconditionne", "occasion"],
    priorities: priorities.length ? priorities : ["prix"],
    os,
    keepYears: Number.isFinite(keep) && keep > 0 ? keep : null,
    minStorage: Number.isFinite(storage) && storage > 0 ? storage : null,
    esim: one(p.esim) === "1",
    includeBrands: list(p.marques),
    excludeBrands: list(p.sauf),
    usage: (["leger", "moyen", "intensif"] as const).find((u) => u === one(p.usage)) ?? null,
    size: (["compact", "standard", "grand"] as const).find((u) => u === one(p.taille)) ?? null,
  };
}

export function toParams(a: Answers): URLSearchParams {
  const q = new URLSearchParams();
  q.set("budget", String(a.budget));
  q.set("etat", a.conditions.join(","));
  q.set("prio", a.priorities.join(","));
  q.set("os", a.os);
  if (a.keepYears) q.set("annees", String(a.keepYears));
  if (a.minStorage) q.set("stockage", String(a.minStorage));
  if (a.esim) q.set("esim", "1");
  if (a.includeBrands?.length) q.set("marques", a.includeBrands.join(","));
  if (a.excludeBrands?.length) q.set("sauf", a.excludeBrands.join(","));
  if (a.usage) q.set("usage", a.usage);
  if (a.size) q.set("taille", a.size);
  return q;
}

export function withPatch(a: Answers, patch: Partial<Answers>): string {
  return toParams({ ...a, ...patch }).toString();
}
