import type { MetadataRoute } from "next";
import { allModels } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";
import { GUIDE_BUDGETS } from "@/lib/budget-guide";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig().url.replace(/\/$/, "");
  const now = new Date();
  const pages = ["", "/trouver", "/catalogue", "/couverture", "/classement", "/mentions-legales", "/confidentialite"].map((p) => ({
    url: `${base}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6,
  }));
  const models = allModels().map((m) => ({ url: `${base}/telephone/${m.id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 }));
  const guides = ["/meilleurs-smartphones", ...GUIDE_BUDGETS.map((b) => `/meilleurs-smartphones/${b}`)].map((p) => ({
    url: `${base}${p}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9,
  }));
  return [...pages, ...guides, ...models];
}
