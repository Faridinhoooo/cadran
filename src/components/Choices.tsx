import Link from "next/link";
import type { Answers, Choice } from "@/lib/engine";
import { CONDITION_LABELS } from "@/lib/engine";
import { euros, storageLabel } from "@/lib/format";
import { CHIP_LEVELS, percentileBelow, position, type Scales } from "@/lib/scales";
import { normalizeChip } from "@/lib/chips";
import { securityDeadline, keepYearsVerdict } from "@/lib/support";
import { Thumb } from "@/components/ui";
import { ShopLinks } from "@/components/ShopLinks";
import type { MediaRow } from "@/lib/queries";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dec = (v: number) => String(v).replace(".", ",");

const PRIO_PROFILE: Record<string, string> = {
  photo: "la photo", autonomie: "l'autonomie", jeux: "les jeux", une_main: "un format maniable", longevite: "la durée de vie", prix: "le prix le plus bas",
};

/** Résumé du profil en une ligne, et ce qu'on en déduit. */
export function ProfileSummary({ answers }: { answers: Answers }) {
  const bits = [
    `orienté ${answers.priorities.map((p) => PRIO_PROFILE[p]).join(" puis ")}`,
    answers.usage ? `usage ${answers.usage === "leger" ? "léger" : answers.usage === "moyen" ? "moyen" : "intensif"}` : null,
    answers.size ? (answers.size === "compact" ? "écran compact" : answers.size === "grand" ? "grand écran" : "écran standard") : null,
    answers.minStorage ? `${storageLabel(answers.minStorage)} minimum` : null,
    answers.keepYears ? `à garder ${answers.keepYears} an${answers.keepYears > 1 ? "s" : ""}` : null,
    answers.os === "ios" ? "iPhone" : answers.os === "android" ? "Android" : null,
  ].filter(Boolean);
  return (
    <p className="text-sm">
      <span className="text-muted">Ton profil :</span> <span className="font-semibold">{bits.join(" · ")}</span>
    </p>
  );
}

function Gauge({ value, label, detail, from, to }: { value: number; label: string; detail: string; from: string; to: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mt-1.5">
      <div className="relative h-2.5 bg-panel-2 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label} aria-valuetext={detail}>
        <div className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#ff3434,#ffb347_55%,#4ade80)]" style={{ width: "100%", clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
        {[25, 50, 75].map((t) => <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-ink/60" style={{ left: `${t}%` }} />)}
      </div>
      <p className="flex justify-between text-[10px] text-muted mt-1 tabular-nums"><span>{from}</span><span>{to}</span></p>
      <p className="text-xs mt-0.5">{detail}</p>
    </div>
  );
}

function reasons(c: Choice, answers: Answers, s: Scales, today: Date): string[] {
  const sp = c.model.specs;
  const out: string[] = [c.why];
  const mah = num(sp.battery_mah), score = num(sp.chip_score), inch = num(sp.screen_in);
  if (answers.usage === "intensif" && (score !== null || mah !== null)) {
    const bits = [score !== null ? `une puce plus puissante que ${percentileBelow(score, s.chip.values)} % des modèles` : null, mah !== null && !answers.priorities.includes("autonomie") ? `une batterie de ${mah.toLocaleString("fr-FR")} mAh (plus grande que ${percentileBelow(mah, s.battery.values)} % des modèles)` : null].filter(Boolean);
    out.push(`Pour ton usage intensif : ${bits.join(" et ")}.`);
  } else if (answers.usage === "leger") {
    out.push("Pour un usage léger, inutile de payer une puissance que tu n'utiliserais pas : il couvre tes besoins.");
  }
  if (answers.size && inch !== null) {
    const ok = answers.size === "compact" ? inch <= 6.3 : answers.size === "grand" ? inch >= 6.7 : inch >= 6.3 && inch < 6.7;
    out.push(ok ? `Écran de ${dec(inch)}″ : la taille ${answers.size === "compact" ? "compacte" : answers.size === "grand" ? "grand écran" : "standard"} que tu cherches.`
      : `Écran de ${dec(inch)}″ : un peu hors de la taille souhaitée, mais c'est le meilleur compromis pour le reste.`);
  }
  if (answers.minStorage && c.config.storage_gb >= answers.minStorage) out.push(`${storageLabel(c.config.storage_gb)} de stockage : de quoi garder tes photos et applis.`);
  if (answers.keepYears) {
    const v = keepYearsVerdict(answers.keepYears, securityDeadline(c.model.support, today));
    out.push(v.text);
  }
  const left = Math.round((answers.budget - (c.total ?? c.shown)) * 100) / 100;
  if (left > 0) out.push(`${euros(left)} sous ton budget${c.total === null ? " (avant frais de livraison à vérifier)" : ""}.`);
  return out.slice(0, 5);
}

export function ChoicesSection({ choices, answers, scales, thumbs, today }: { choices: Choice[]; answers: Answers; scales: Scales; thumbs: Map<string, MediaRow>; today: Date }) {
  return (
    <section aria-labelledby="choix" className="grid gap-5">
      <div>
        <h2 id="choix" className="display text-2xl sm:text-4xl">
          {choices.length > 1 ? <>Nos <span className="text-red">{choices.length} choix</span> pour toi</> : <>Notre choix pour toi</>}
        </h2>
        <div className="mt-2"><ProfileSummary answers={answers} /></div>
      </div>
      <ol className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr] items-stretch">
        {choices.map((c, i) => {
          const sp = c.model.specs;
          const chip = normalizeChip(sp.chip) ?? (typeof sp.chip === "string" ? sp.chip : null);
          const tier = num(sp.chip_tier);
          const score = num(sp.chip_score);
          const ram = c.config.ram_gb ?? num(sp.ram_gb);
          const mah = num(sp.battery_mah);
          return (
            <li key={c.model.id} className={`relative border cut flex flex-col ${i === 0 ? "border-red border-2 bg-[linear-gradient(180deg,#1d1213,#121214_45%)] shadow-[0_0_60px_-20px_rgba(255,52,52,0.6)]" : "bg-panel border-line"}`}>
              {i === 0 && (
                <p className="bg-red text-ink text-center text-xs font-extrabold uppercase tracking-widest py-1.5">★ Notre meilleur choix pour toi</p>
              )}
              <div className="p-4 pb-0 flex items-center justify-between gap-2">
                <span className={`display text-lg ${i === 0 ? "text-red" : "text-muted"}`}>{i === 0 ? "N°1" : `N°${i + 1}`}</span>
                <span className="text-xs text-muted">{CONDITION_LABELS[c.offer.condition]} · {c.offer.seller}</span>
              </div>
              <div className={`p-4 grid ${i === 0 ? "grid-cols-[112px_1fr]" : "grid-cols-[88px_1fr]"} gap-4 items-center`}>
                <Thumb media={thumbs.get(c.model.id) ?? null} alt={c.model.name} form={c.model.form_factor} size={i === 0 ? 112 : 88} />
                <div className="min-w-0">
                  <h3 className={`font-extrabold leading-tight ${i === 0 ? "text-2xl" : "text-xl"}`}>
                    <Link href={`/telephone/${c.model.id}${c.config.storage_gb ? `?go=${c.config.storage_gb}` : ""}`} className="hover:text-red">{c.model.name}</Link>
                  </h3>
                  <p className={`mt-1 font-extrabold tabular-nums ${i === 0 ? "text-3xl" : "text-2xl"}`}>{euros(c.total ?? c.shown)}</p>
                  <p className={`text-xs font-semibold ${c.total !== null ? "text-ok" : "text-warn"}`}>
                    {c.total !== null ? "✓ Frais inclus, dans ton budget" : "Hors livraison : à vérifier chez le vendeur"}
                  </p>
                </div>
              </div>

              <dl className="px-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted font-bold">Processeur</dt>
                  <dd className="font-semibold">{chip ?? "Non publié"}</dd>
                  {score !== null && (
                    <Gauge value={position(score, scales.chip)} label="Puissance du processeur"
                      detail={`Indice ${score}/100${tier ? ` (${CHIP_LEVELS[tier]})` : ""} : plus puissant que ${percentileBelow(score, scales.chip.values)} % des smartphones du catalogue.`}
                      from="Moins puissant" to="Plus puissant" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted font-bold">Mémoire vive</dt>
                    <dd className="font-semibold">{ram ? `${ram} Go` : "Non publiée"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted font-bold">Stockage</dt>
                    <dd className="font-semibold">{c.config.storage_gb ? storageLabel(c.config.storage_gb) : "Selon l'offre"}</dd>
                  </div>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted font-bold">Batterie</dt>
                  <dd className="font-semibold">{mah ? `${mah.toLocaleString("fr-FR")} mAh` : "Non publiée"}</dd>
                  {mah !== null && (
                    <Gauge value={position(mah, scales.battery)} label="Capacité de la batterie"
                      detail={`Plus grande que ${percentileBelow(mah, scales.battery.values)} % des smartphones du catalogue.`}
                      from={`${scales.battery.min.toLocaleString("fr-FR")} mAh`} to={`${scales.battery.max.toLocaleString("fr-FR")} mAh`} />
                  )}
                </div>
              </dl>

              <div className="m-4 mb-0 border-l-2 border-red pl-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-red">Pourquoi c&apos;est le téléphone pour toi</p>
                <ul className="mt-1.5 grid gap-1 text-sm">
                  {reasons(c, answers, scales, today).map((r) => <li key={r}>• {r}</li>)}
                </ul>
              </div>

              <div className="p-4 mt-auto grid gap-3">
                <div className="flex flex-wrap gap-2">
                  <a href={c.offer.url} target="_blank" rel="noopener noreferrer" className={`btn ${i === 0 ? "btn-primary" : "btn-ghost"} min-h-[44px] text-sm`}>
                    {c.total !== null ? "Voir l'offre" : "Vérifier le prix"}<span className="sr-only"> chez {c.offer.seller}, nouvel onglet</span>
                  </a>
                  <Link href={`/telephone/${c.model.id}`} className="btn btn-ghost min-h-[44px] text-sm">Fiche</Link>
                </div>
                <ShopLinks compact title="Comparer" brand={c.model.brand_name} name={c.model.name} storageGb={c.config.storage_gb || null} />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">
        Jauges : position du modèle entre le moins et le plus performant des smartphones du catalogue PickJust (hors téléphones gaming).
        Puissance : indice PickJust de 0 à 100, établi d&apos;après la gamme et la génération des puces (indicatif, pas un test mesuré). Batterie : capacité annoncée par le fabricant, pas une mesure d&apos;autonomie.
      </p>
    </section>
  );
}
