import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og-font";

export const alt = "PickJust — le bon smartphone pour ton budget";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage (Facebook, WhatsApp, X, LinkedIn…), générée au build avec la police Archivo du site. */
export default async function OpengraphImage() {
  const fonts = await ogFonts();
  const grid = "linear-gradient(#1c1c21 1px, transparent 1px), linear-gradient(90deg, #1c1c21 1px, transparent 1px)";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0a0a0b", backgroundImage: grid, backgroundSize: "48px 48px", color: "#f5f5f4", fontFamily: fonts ? "Archivo" : "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <path d="M13 0H64V51L51 64H0V13Z" fill="#ff3434" />
            <path d="M14 34 L27 47 L51 19" fill="none" stroke="#0a0a0b" strokeWidth="9.5" strokeLinecap="square" strokeLinejoin="miter" />
          </svg>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 900, letterSpacing: -1 }}>
            PICK<span style={{ color: "#ff3434" }}>JUST</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 900, lineHeight: 0.95, letterSpacing: -2 }}>
          <span>LE BON SMARTPHONE</span>
          <span style={{ display: "flex" }}>
            POUR&nbsp;<span style={{ color: "#ff3434" }}>TON BUDGET</span>
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa", letterSpacing: 0 }}>
          Prix relevés chez les vendeurs · frais inclus · suivi des mises à jour
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
