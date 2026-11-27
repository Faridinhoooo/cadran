"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Visual } from "@/lib/visual";

/** Nom court affiché en filigrane derrière l'illustration (« Galaxy S25 Ultra » → « S25 ULTRA »). */
export function watermarkLabel(name: string): string {
  return name
    .replace(/^(Apple|Samsung|Xiaomi|Google|REDMI|POCO)\s+/i, "")
    .replace(/^(iPhone|Galaxy|Pixel)\s+/i, "")
    .replace(/\s+5G$/i, "")
    .toUpperCase();
}

/**
 * Cadre visuel uniforme (même fond, même cadrage, image entière) pour toutes les cartes.
 * Les fonds blancs des visuels fabricant se fondent dans le cadre (mix-blend multiply).
 * Sans visuel autorisé : illustration générique + nom du modèle en filigrane, légendée « Illustration indicative ».
 * Si l'image distante ne charge pas, l'illustration locale prend le relais.
 */
export function PhoneVisual({ visual, alt, className = "", caption = true }: { visual: Visual; alt: string; className?: string; caption?: boolean }) {
  const [broken, setBroken] = useState(false);
  const showIllustration = visual.type === "illustration" || broken;
  const src = visual.type === "photo" && !broken ? visual.src : visual.type === "photo" ? visual.fallback : visual.src;
  const mark = watermarkLabel(alt);
  return (
    <div style={{ containerType: "inline-size" }} className={`relative overflow-hidden bg-[linear-gradient(160deg,#f1f1f3,#dcdce0)] ${className}`}>
      {showIllustration && caption && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-[9%] px-[6%] text-center display leading-none whitespace-nowrap overflow-hidden text-ink/25 select-none"
          style={{ fontSize: `clamp(0.7rem, ${mark.length > 10 ? 6 : 8}cqw, 2.5rem)` }}
        >
          {mark}
        </span>
      )}
      <img
        src={src}
        alt={showIllustration ? `Illustration indicative (${alt})` : alt}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={`absolute inset-0 w-full h-full ${showIllustration ? `object-contain ${caption ? "px-[8%] pt-[7%] pb-[24%]" : "p-[8%]"}` : visual.type === "photo" && visual.cover ? "object-cover" : "object-contain p-[6%] mix-blend-multiply"}`}
      />
      {showIllustration && caption && (
        <span className="absolute bottom-1 inset-x-0 text-center text-[9px] leading-none font-semibold text-ink/55">Illustration indicative</span>
      )}
    </div>
  );
}
