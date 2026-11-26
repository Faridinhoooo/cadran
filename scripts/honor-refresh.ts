// Relevé manuel des pages HONOR (respecte les 30 s de robots.txt) : npx tsx scripts/honor-refresh.ts
import { honorInventory, refreshHonorCache } from "./honor";
(async () => {
  const notes: string[] = [];
  const cache = await refreshHonorCache(honorInventory().models.map((m) => m.slug), notes);
  console.log(Object.keys(cache).length, "pages en copie");
  console.log(notes.join("\n"));
})();
