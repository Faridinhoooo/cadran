"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-28">
      <p className="text-red font-bold tracking-widest text-sm">INCIDENT</p>
      <h1 className="display text-5xl sm:text-6xl mt-3 leading-[0.95]">Un problème est survenu</h1>
      <p className="text-muted mt-6 text-lg max-w-xl">
        La page n&apos;a pas pu être affichée. Aucune donnée n&apos;a été perdue : réessaie dans un instant.
        {error.digest && <span className="block text-sm mt-2">Référence : {error.digest}</span>}
      </p>
      <div className="flex flex-wrap gap-3 mt-10">
        <button type="button" onClick={reset} className="btn btn-primary">Réessayer</button>
        <Link href="/" className="btn btn-secondary">Retour à l&apos;accueil</Link>
      </div>
    </section>
  );
}
