import { ImageResponse } from "next/og";

export const alt = "Cadran — le bon smartphone pour ton budget";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage (Facebook, WhatsApp, X, LinkedIn…), générée sans police ni image externe. */
export default function OpengraphImage() {
  const grid = "linear-gradient(#1c1c21 1px, transparent 1px), linear-gradient(90deg, #1c1c21 1px, transparent 1px)";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0a0a0b", backgroundImage: grid, backgroundSize: "48px 48px", color: "#f5f5f4", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 900, letterSpacing: -1 }}>
          CADR<span style={{ color: "#ff3434" }}>A</span>N
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 900, lineHeight: 0.95, letterSpacing: -2 }}>
          <span>LE BON SMARTPHONE</span>
          <span style={{ display: "flex" }}>
            POUR&nbsp;<span style={{ color: "#ff3434" }}>TON BUDGET</span>
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa" }}>
          Prix relevés chez les vendeurs · frais inclus · suivi des mises à jour
        </div>
      </div>
    ),
    size,
  );
}
