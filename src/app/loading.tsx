export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12" role="status" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <div className="h-4 w-32 bg-panel-2 animate-pulse" />
      <div className="h-14 w-2/3 max-w-xl bg-panel-2 animate-pulse mt-4" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-10">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="cut bg-panel rounded-3xl">
            <div className="aspect-[4/3] bg-panel-2 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-3 w-1/3 bg-panel-2 animate-pulse" />
              <div className="h-5 w-2/3 bg-panel-2 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
