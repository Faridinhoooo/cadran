// Formulaire GET : fonctionne sans JavaScript. Le budget est transmis au questionnaire.
export function BudgetForm({ defaultValue, id = "budget" }: { defaultValue?: number; id?: string }) {
  return (
    <form action="/trouver" method="get" className="w-full max-w-xl">
      <label htmlFor={id} className="block text-sm font-bold uppercase tracking-wider text-muted mb-2">
        Mon budget maximum
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 cut bg-text">
          <input
            id={id}
            name="budget"
            type="number"
            inputMode="decimal"
            min={50}
            max={5000}
            step={1}
            required
            defaultValue={defaultValue}
            placeholder="400"
            aria-describedby={`${id}-aide`}
            className="w-full h-[60px] bg-transparent text-ink text-3xl font-extrabold pl-5 pr-12 outline-none placeholder:text-ink/35 tabular-nums"
          />
          <span aria-hidden className="absolute right-5 top-1/2 -translate-y-1/2 text-ink text-3xl font-extrabold">€</span>
        </div>
        <button type="submit" className="btn btn-primary h-[60px] text-base">
          Trouver mon smartphone
        </button>
      </div>
      <p id={`${id}-aide`} className="text-sm text-muted mt-2">
        Coût total maximum, livraison et frais obligatoires compris. Ce n&apos;est pas un montant à dépenser.
      </p>
    </form>
  );
}
