import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La base SQLite et les sources éditoriales sont lues à l'exécution : elles doivent être embarquées
  // dans chaque fonction serveur déployée (Vercel).
  outputFileTracingIncludes: {
    "/**": ["./data/catalog.db", "./data/sources/**/*"],
  },
};

export default nextConfig;
