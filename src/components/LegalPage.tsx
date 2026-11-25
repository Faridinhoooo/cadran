export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <h1 className="display text-4xl sm:text-5xl">{title}</h1>
      <p className="text-sm text-muted mt-2">Dernière mise à jour : {updated}</p>
      <div className="mt-8 grid gap-6 leading-relaxed [&_h2]:display [&_h2]:text-xl [&_h2]:mt-4 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:grid [&_ul]:gap-1">
        {children}
      </div>
    </article>
  );
}

export function Field({ label, value, missing }: { label: string; value: string | null; missing: string }) {
  return (
    <div className="grid sm:grid-cols-[220px_1fr] gap-x-4 border-b border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={value ? "" : "text-warn"}>{value ?? missing}</dd>
    </div>
  );
}
