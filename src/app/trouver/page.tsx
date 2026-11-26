import type { Metadata } from "next";
import { Quiz } from "@/components/Quiz";
import { parseAnswers } from "@/lib/answers";
import { brands } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trouver mon smartphone en 3 questions", description: "Indique ton budget, l'état souhaité, tes priorités et ton système : PickJust te propose les meilleurs smartphones dans ton budget, frais inclus, et explique pourquoi.", alternates: { canonical: "/trouver" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const full = sp.etat ? parseAnswers(sp) : null; // retour depuis les résultats : toutes les réponses sont reprises
  const budget = Number(Array.isArray(sp.budget) ? sp.budget[0] : sp.budget);
  const initial = full ?? (Number.isFinite(budget) && budget > 0 ? { budget } : {});
  return <Quiz initial={initial} brands={brands().map((b) => ({ id: b.id, name: b.name }))} />;
}
