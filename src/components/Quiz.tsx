"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Answers, Condition, OsChoice, Priority, SizePref, Usage } from "@/lib/engine";
import { toParams } from "@/lib/answers";

const KEY = "pickjust-questionnaire-v2";

const CONDITIONS: { id: Condition; label: string; help: string }[] = [
  { id: "neuf", label: "Neuf", help: "Jamais utilisé, vendu scellé avec la garantie légale de 2 ans." },
  { id: "reconditionne", label: "Reconditionné par un professionnel", help: "Testé et remis en état par une entreprise identifiable, vendu avec une garantie." },
  { id: "occasion", label: "Occasion entre particuliers", help: "Acheté directement à une personne : souvent moins cher, sans garantie professionnelle." },
];

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "photo", label: "Réussir mes photos et mes vidéos." },
  { id: "autonomie", label: "Tenir longtemps sans recharger." },
  { id: "jeux", label: "Jouer à des jeux exigeants." },
  { id: "une_main", label: "Pouvoir l'utiliser facilement à une main." },
  { id: "longevite", label: "Le garder plusieurs années." },
  { id: "prix", label: "Dépenser le moins possible." },
];

const OS: { id: OsChoice; label: string; help: string }[] = [
  { id: "ios", label: "Un iPhone", help: "Seuls les iPhone seront proposés." },
  { id: "android", label: "Un Android", help: "Seuls les téléphones Android seront proposés." },
  { id: "any", label: "Les deux me vont", help: "La comparaison reste ouverte." },
];

const USAGES: { id: Usage; label: string; help: string }[] = [
  { id: "leger", label: "Léger", help: "Appels, messages, un peu de réseaux sociaux et d'internet. Moins de 3 h d'écran par jour." },
  { id: "moyen", label: "Moyen", help: "Réseaux sociaux, vidéos, photos et GPS tous les jours. 3 à 5 h d'écran par jour." },
  { id: "intensif", label: "Intensif", help: "Jeux, longues vidéos, partage de connexion, montage… Plus de 5 h d'écran par jour." },
];

const SIZES: { id: SizePref | "any"; label: string; help: string }[] = [
  { id: "compact", label: "Compact", help: "Écran de 6,3″ ou moins : se glisse partout, s'utilise à une main." },
  { id: "standard", label: "Standard", help: "Écran de 6,3″ à 6,6″ : le bon compromis." },
  { id: "grand", label: "Grand écran", help: "Écran de 6,7″ ou plus : idéal pour les vidéos et les jeux." },
  { id: "any", label: "Peu importe", help: "La taille ne compte pas pour moi." },
];

const STORAGE: { gb: number | null; label: string; help: string }[] = [
  { gb: null, label: "Peu de choses", help: "Quelques applis et photos, le reste dans le cloud. 64 à 128 Go suffisent." },
  { gb: 128, label: "Un usage courant", help: "Photos, vidéos et applis du quotidien : 128 Go minimum." },
  { gb: 256, label: "Beaucoup de photos et vidéos", help: "Gros jeux, vidéos en 4K, beaucoup de musique hors ligne : 256 Go minimum." },
  { gb: 512, label: "Énormément", help: "Tout garder sur le téléphone, vidéos 4K longues : 512 Go minimum." },
];

type State = Answers & { step: number; sizeAnswered?: boolean; storageAnswered?: boolean };

function Tick({ on, text }: { on: boolean; text?: string }) {
  return (
    <span className="tick" aria-hidden>
      {on ? text ?? "✓" : ""}
    </span>
  );
}

export function Quiz({ initial, brands }: { initial: Partial<Answers> & { budget?: number }; brands: { id: string; name: string }[] }) {
  const router = useRouter();
  const [s, setS] = useState<State>(() => ({
    budget: initial.budget ?? 0,
    conditions: initial.conditions ?? [],
    priorities: initial.priorities ?? [],
    os: initial.os ?? ("" as OsChoice),
    keepYears: initial.keepYears ?? null,
    minStorage: initial.minStorage ?? null,
    esim: initial.esim ?? false,
    includeBrands: initial.includeBrands ?? [],
    excludeBrands: initial.excludeBrands ?? [],
    usage: initial.usage ?? null,
    size: initial.size ?? null,
    step: 0,
  }));
  const heading = useRef<HTMLHeadingElement>(null);
  const loaded = useRef(false);

  // Reprise de la saisie (retour arrière, rechargement) sans écraser un budget fourni dans l'URL.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as State | null;
      if (saved && !initial.conditions) setS((cur) => ({ ...saved, budget: initial.budget ?? saved.budget, step: cur.step }));
    } catch {}
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, [s]);

  const steps = ["etat", "priorites", "usage", "taille", "stockage", "annees", "os"];
  const current = steps[s.step];
  const isLast = s.step === steps.length - 1;

  useEffect(() => {
    heading.current?.focus();
  }, [s.step]);

  const set = (patch: Partial<State>) => setS((cur) => ({ ...cur, ...patch }));
  const canNext =
    (current === "etat" && s.conditions.length > 0) ||
    (current === "priorites" && s.priorities.length > 0) ||
    (current === "os" && !!s.os) ||
    (current === "usage" && !!s.usage) ||
    (current === "taille" && !!s.sizeAnswered) ||
    (current === "stockage" && !!s.storageAnswered) ||
    (current === "annees" && !!s.keepYears);

  function toggleCondition(c: Condition) {
    let next = s.conditions.length === 3 ? [] : [...s.conditions];
    if (next.includes(c)) next = next.filter((x) => x !== c);
    else next = next.length >= 2 ? [next[1], c] : [...next, c];
    set({ conditions: next });
  }

  function togglePriority(p: Priority) {
    let next = [...s.priorities];
    if (next.includes(p)) next = next.filter((x) => x !== p);
    else if (next.length < 2) next.push(p);
    else next = [next[0], p];
    set({ priorities: next });
  }

  function submit() {
    const { step: _step, sizeAnswered: _a, storageAnswered: _b, ...answers } = s;
    void _step; void _a; void _b;
    router.push(`/resultats?${toParams(answers as Answers).toString()}`);
  }

  function next() {
    if (!canNext) return;
    if (isLast) submit();
    else set({ step: s.step + 1 });
  }

  const titles: Record<string, string> = {
    etat: "Comment veux-tu l'acheter ?",
    priorites: "Qu'est-ce qui compte le plus pour toi ?",
    os: "Tu veux un iPhone, un Android, ou les deux te vont ?",
    usage: "Comment utilises-tu ton téléphone au quotidien ?",
    taille: "Quelle taille d'écran préfères-tu ?",
    stockage: "Combien de photos, vidéos et applis gardes-tu ?",
    annees: "Combien de temps veux-tu le garder ?",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center gap-3 justify-between mb-6">
        <p className="text-sm font-bold uppercase tracking-wider text-muted">
          {`Question ${s.step + 1} sur ${steps.length}`}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Budget maximum</span>
          <span className="relative">
            <input
              type="number"
              min={50}
              inputMode="decimal"
              value={s.budget || ""}
              onChange={(e) => set({ budget: Number(e.target.value) })}
              className="w-28 bg-page border border-line rounded-xl px-3 py-2 pr-7 font-bold tabular-nums"
              aria-label="Budget maximum en euros"
            />
            <span aria-hidden className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold">€</span>
          </span>
        </label>
      </div>

      <div className="h-1.5 bg-panel-2 mb-8" aria-hidden>
        <div className="h-full bg-red transition-all" style={{ width: `${((s.step + 1) / steps.length) * 100}%` }} />
      </div>

      <h1 ref={heading} tabIndex={-1} className="display text-3xl sm:text-5xl mb-2 outline-none">
        {titles[current]}
      </h1>

      {current === "etat" && (
        <>
          <p className="text-muted mb-6">Choisis un ou deux états, ou compare les trois.</p>
          <div className="grid gap-3" role="group" aria-label="État d'achat">
            {CONDITIONS.map((c) => {
              const on = s.conditions.includes(c.id) && s.conditions.length < 3;
              return (
                <button key={c.id} type="button" className="choice cut-sm" aria-pressed={on} onClick={() => toggleCondition(c.id)}>
                  <Tick on={on} />
                  <span>
                    <span className="block text-lg font-bold">{c.label}</span>
                    <span className="block text-muted text-sm mt-0.5">{c.help}</span>
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="choice cut-sm"
              aria-pressed={s.conditions.length === 3}
              onClick={() => set({ conditions: s.conditions.length === 3 ? [] : ["neuf", "reconditionne", "occasion"] })}
            >
              <Tick on={s.conditions.length === 3} />
              <span>
                <span className="block text-lg font-bold">Comparer les trois</span>
                <span className="block text-muted text-sm mt-0.5">Neuf, reconditionné et cote d&apos;occasion côte à côte.</span>
              </span>
            </button>
          </div>
        </>
      )}

      {current === "priorites" && (
        <>
          <p className="text-muted mb-6">Choisis ta priorité principale, puis une seconde si tu veux.</p>
          <div className="grid sm:grid-cols-2 gap-3" role="group" aria-label="Priorités">
            {PRIORITIES.map((p) => {
              const idx = s.priorities.indexOf(p.id);
              return (
                <button key={p.id} type="button" className="choice cut-sm" aria-pressed={idx >= 0} onClick={() => togglePriority(p.id)}>
                  <Tick on={idx >= 0} text={String(idx + 1)} />
                  <span>
                    <span className="block text-lg font-bold">{p.label}</span>
                    {idx >= 0 && <span className="block text-sm text-red font-semibold">{idx === 0 ? "Priorité principale" : "Seconde priorité"}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {current === "os" && (
        <div className="grid gap-3 mt-6" role="radiogroup" aria-label="Système">
          {OS.map((o) => (
            <button key={o.id} type="button" role="radio" className="choice cut-sm" aria-checked={s.os === o.id} onClick={() => set({ os: o.id })}>
              <Tick on={s.os === o.id} />
              <span>
                <span className="block text-lg font-bold">{o.label}</span>
                <span className="block text-muted text-sm mt-0.5">{o.help}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {current === "usage" && (
        <>
          <p className="text-muted mb-6">Ça nous aide à choisir la bonne puissance et la bonne batterie.</p>
          <div className="grid gap-3" role="radiogroup" aria-label="Intensité d'usage">
            {USAGES.map((u) => (
              <button key={u.id} type="button" role="radio" className="choice cut-sm" aria-checked={s.usage === u.id} onClick={() => set({ usage: u.id })}>
                <Tick on={s.usage === u.id} />
                <span>
                  <span className="block text-lg font-bold">{u.label}</span>
                  <span className="block text-muted text-sm mt-0.5">{u.help}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {current === "taille" && (
        <div className="grid sm:grid-cols-2 gap-3 mt-6" role="radiogroup" aria-label="Taille d'écran">
          {SIZES.map((z) => {
            const on = !!s.sizeAnswered && (z.id === "any" ? !s.size : s.size === z.id);
            return (
              <button key={z.id} type="button" role="radio" className="choice cut-sm" aria-checked={on}
                onClick={() => set({ size: z.id === "any" ? null : z.id, sizeAnswered: true })}>
                <Tick on={on} />
                <span>
                  <span className="block text-lg font-bold">{z.label}</span>
                  <span className="block text-muted text-sm mt-0.5">{z.help}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {current === "stockage" && (
        <>
          <p className="text-muted mb-6">Le stockage ne s&apos;agrandit pas après l&apos;achat sur la plupart des téléphones : mieux vaut prévoir.</p>
          <div className="grid gap-3" role="radiogroup" aria-label="Stockage">
            {STORAGE.map((o) => {
              const on = !!s.storageAnswered && (s.minStorage ?? null) === o.gb;
              return (
                <button key={String(o.gb)} type="button" role="radio" className="choice cut-sm" aria-checked={on}
                  onClick={() => set({ minStorage: o.gb, storageAnswered: true })}>
                  <Tick on={on} />
                  <span>
                    <span className="block text-lg font-bold">{o.label}</span>
                    <span className="block text-muted text-sm mt-0.5">{o.help}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {current === "annees" && (
        <>
          <p className="text-muted mb-6">On vérifie que le téléphone recevra encore des mises à jour de sécurité pendant toute cette durée. Acheter neuf ou reconditionné ne remet pas ce compteur à zéro.</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3" role="radiogroup" aria-label="Nombre d'années">
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <button key={y} type="button" role="radio" aria-checked={s.keepYears === y} className="choice cut-sm justify-center items-center" onClick={() => set({ keepYears: y })}>
                <span className="text-xl font-extrabold">{y === 6 ? "6 ans +" : `${y} an${y > 1 ? "s" : ""}`}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {isLast && (
        <details className="mt-8 bg-panel rounded-3xl">
          <summary className="cursor-pointer px-5 py-4 font-bold min-h-[52px] flex items-center">Affiner mon choix (facultatif)</summary>
          <div className="px-5 pb-5 grid gap-5">
            <label className="flex items-center gap-3 min-h-[44px]">
              <input type="checkbox" checked={!!s.esim} onChange={(e) => set({ esim: e.target.checked })} className="w-5 h-5 accent-[var(--red)]" />
              <span className="font-semibold">eSIM indispensable</span>
            </label>
            <fieldset>
              <legend className="font-semibold mb-2">Marques</legend>
              <p className="text-sm text-muted mb-3">Un clic : à inclure. Deux clics : à exclure. Trois : sans préférence.</p>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => {
                  const inc = s.includeBrands?.includes(b.id);
                  const exc = s.excludeBrands?.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`px-4 py-2 border rounded-full text-sm font-semibold min-h-[44px] ${inc ? "border-ok" : exc ? "border-red line-through" : "border-line"}`}
                      onClick={() => {
                        const i = (s.includeBrands ?? []).filter((x) => x !== b.id);
                        const x = (s.excludeBrands ?? []).filter((y) => y !== b.id);
                        if (!inc && !exc) set({ includeBrands: [...i, b.id], excludeBrands: x });
                        else if (inc) set({ includeBrands: i, excludeBrands: [...x, b.id] });
                        else set({ includeBrands: i, excludeBrands: x });
                      }}
                    >
                      {inc ? "✓ " : exc ? "✕ " : ""}
                      {b.name}
                      <span className="sr-only">{inc ? " (incluse)" : exc ? " (exclue)" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-3 mt-8">
        {s.step > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => set({ step: s.step - 1 })}>
            ← Retour
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={next} aria-disabled={!canNext || !s.budget} disabled={!canNext || !s.budget}>
          {isLast ? "Voir mon résultat" : "Suivant"}
        </button>
      </div>
      {!s.budget && <p className="text-sm text-warn mt-3">Indique ton budget maximum en haut de la page.</p>}
    </div>
  );
}
