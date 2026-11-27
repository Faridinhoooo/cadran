import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og-font";

export const alt = "PickJust — le bon smartphone pour ton budget";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage (Facebook, WhatsApp, X, LinkedIn…), générée au build avec la police Outfit du site. */
export default async function OpengraphImage() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(180deg, #ffffff 0%, #f4f4f6 100%)", color: "#111114", fontFamily: fonts ? "Outfit" : "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="68" height="68" viewBox="0 0 64 64">
            <path d="M0 18A18 18 0 0 1 18 0H46A18 18 0 0 1 64 18V46A18 18 0 0 1 46 64H18A18 18 0 0 1 0 46Z" fill="#e0222c" />
            <path d="M17 33 L28 44 L48 22" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 700, letterSpacing: -1.5 }}>
            Pick<span style={{ color: "#e0222c" }}>Just</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 96, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
          <span>Le bon smartphone.</span>
          <span style={{ display: "flex" }}>
            Au&nbsp;<span style={{ color: "#e0222c" }}>juste prix.</span>
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#5d5d66", letterSpacing: 0 }}>
          Prix relevés chez les vendeurs · frais inclus · 3 choix expliqués
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
