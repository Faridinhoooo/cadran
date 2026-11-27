import { budgetInput } from "@/lib/money";

// Formulaire GET : fonctionne sans JavaScript. Le budget est transmis au questionnaire.
export function BudgetForm({ defaultValue, id = "budget" }: { defaultValue?: number; id?: string }) {
  return (
    <form action="/trouver" method="get" className="w-full max-w-xl">
      <label htmlFor={id} className="block text-sm font-semibold text-muted mb-2">
        Mon budget maximum
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 rounded-full bg-page shadow-[inset_0_0_0_1.5px_var(--line)] focus-within:shadow-[inset_0_0_0_2px_var(--ink)]">
          <input
            id={id}
            name="budget"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            pattern="\s*\d[\d\s]*([.,]\d{1,2})?\s*€?\s*"
            title="Un montant en euros, par exemple 327,50"
            defaultValue={defaultValue ? budgetInput(defaultValue) : undefined}
            placeholder="400"
            aria-describedby={`${id}-aide`}
            className="w-full h-[60px] bg-transparent text-ink text-2xl font-semibold pl-6 pr-12 outline-none placeholder:text-ink/35 tabular-nums"
          />
          <span aria-hidden className="absolute right-6 top-1/2 -translate-y-1/2 text-muted text-2xl font-semibold">€</span>
        </div>
        <button type="submit" className="btn btn-red h-[60px] text-base px-8">
          Trouver mon smartphone
        </button>
      </div>
      <p id={`${id}-aide`} className="text-sm text-muted mt-2">
        Montant exact au centime près (ex. 327,50), entre 50 € et 5 000 €. Coût total maximum, livraison et frais obligatoires compris.
      </p>
    </form>
  );
}
