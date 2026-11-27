import type { Metadata } from "next";
import { Quiz } from "@/components/Quiz";
import { parseAnswers } from "@/lib/answers";
import { parseBudget } from "@/lib/money";
import { brands } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trouver mon smartphone en 3 questions", description: "Indique ton budget, l'état souhaité, tes priorités et ton système : PickJust te propose 3 smartphones dans ton budget et explique pourquoi.", alternates: { canonical: "/trouver" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const full = sp.etat ? parseAnswers(sp) : null; // retour depuis les résultats : toutes les réponses sont reprises
  const raw = Array.isArray(sp.budget) ? sp.budget[0] : sp.budget;
  const parsed = parseBudget(raw);
  const initial = full ?? (parsed.ok ? { budget: parsed.value } : {});
  return <Quiz initial={initial} budgetRaw={!parsed.ok && raw ? raw : undefined} brands={brands().map((b) => ({ id: b.id, name: b.name }))} />;
}
