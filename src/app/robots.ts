import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig().url.replace(/\/$/, "");
  // Résultats et comparateur : combinaisons de paramètres infinies, sans intérêt pour l'indexation.
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/resultats", "/comparer", "/trouver?"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
