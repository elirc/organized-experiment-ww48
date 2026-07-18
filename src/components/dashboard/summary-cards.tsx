import { LEAD_STAGES, stageLabels } from "@/lib/domain";
import type { DashboardResponse } from "@/hooks/use-dashboard";
import { formatCurrency } from "@/lib/utils/formatters";

/**
 * This file renders the dashboard summary metrics above the pipeline board.
 * What calls it: src/components/dashboard/dashboard-page.tsx.
 * What it calls: shared domain constants and formatting helpers.
 * A junior engineer would likely get this wrong by recalculating stage totals in
 * multiple places instead of deriving a single summary view from the query result.
 */
export function SummaryCards({ data }: { data: DashboardResponse }) {
  const totalValue = data.leads.reduce((sum, lead) => sum + (lead.valueCents ?? 0), 0);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Open pipeline</p>
        <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-slate-950">
          {data.leads.length}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{formatCurrency(totalValue)} in visible pipeline value.</p>
      </article>

      {LEAD_STAGES.slice(0, 3).map((stage) => {
        const count = data.counts.find((entry) => entry.stage === stage)?._count.stage ?? 0;

        return (
          <article key={stage} className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{stageLabels[stage]}</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-slate-950">
              {count}
            </h2>
            <p className="mt-2 text-sm text-slate-600">Leads currently in this stage.</p>
          </article>
        );
      })}
    </section>
  );
}

