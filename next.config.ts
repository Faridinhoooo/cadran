import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Politique de sécurité du contenu : le site ne charge que ses propres ressources, plus les visuels
// autorisés (Wikimedia Commons, Icecat) affichés en <img>. Aucun script tiers, aucun traceur.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://upload.wikimedia.org https://thumb.wikimedia.org https://images.icecat.biz",
  "font-src 'self'",
  `connect-src 'self' https://cdn.jsdelivr.net${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // La base SQLite et les sources éditoriales sont lues à l'exécution : elles doivent être embarquées
  // dans chaque fonction serveur déployée (Vercel).
  outputFileTracingIncludes: {
    "/**": ["./data/catalog.db", "./data/sources/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
