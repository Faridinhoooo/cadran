import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

export default function NotFound() {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-28">
      <p className="text-red font-bold tracking-widest text-sm">ERREUR 404</p>
      <h1 className="display text-5xl sm:text-7xl mt-3 leading-[0.95]">
        Page <span className="text-red">introuvable</span>
      </h1>
      <p className="text-muted mt-6 text-lg max-w-xl">
        Cette adresse n&apos;existe pas ou a changé. Le téléphone que tu cherches est peut-être dans le catalogue sous un autre nom.
      </p>
      <div className="flex flex-wrap gap-3 mt-10">
        <Link href="/trouver" className="btn btn-primary">Trouver mon smartphone</Link>
        <Link href="/catalogue" className="btn btn-secondary">Parcourir le catalogue</Link>
      </div>
    </section>
  );
}
