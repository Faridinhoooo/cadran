import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icône d'écran d'accueil (iPhone, Android) : le symbole PickJust sur fond sombre. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0b" }}>
        <svg width="124" height="124" viewBox="0 0 64 64">
          <path d="M13 0H64V51L51 64H0V13Z" fill="#ff3434" />
          <path d="M14 34 L27 47 L51 19" fill="none" stroke="#0a0a0b" strokeWidth="9.5" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
      </div>
    ),
    size,
  );
}
