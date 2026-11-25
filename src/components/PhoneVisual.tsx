"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Visual } from "@/lib/visual";

/**
 * Cadre visuel uniforme (même fond, même cadrage, image entière) pour toutes les cartes.
 * Si l'image distante ne charge pas, l'illustration locale prend le relais.
 */
export function PhoneVisual({ visual, alt, className = "", caption = true }: { visual: Visual; alt: string; className?: string; caption?: boolean }) {
  const [broken, setBroken] = useState(false);
  const showIllustration = visual.type === "illustration" || broken;
  const src = visual.type === "photo" && !broken ? visual.src : visual.type === "photo" ? visual.fallback : visual.src;
  return (
    <div className={`relative overflow-hidden bg-[linear-gradient(160deg,#f1f1f3,#dcdce0)] ${className}`}>
      <img
        src={src}
        alt={showIllustration ? `Illustration indicative (${alt})` : alt}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`absolute inset-0 w-full h-full object-contain ${showIllustration ? "p-[8%]" : "p-[6%]"}`}
      />
      {showIllustration && caption && (
        <span className="absolute bottom-1 inset-x-0 text-center text-[9px] leading-none font-semibold text-ink/55">Illustration indicative</span>
      )}
    </div>
  );
}
