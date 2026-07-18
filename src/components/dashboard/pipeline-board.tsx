import Link from "next/link";

import { LEAD_STAGES, stageLabels } from "@/lib/domain";
import type { DashboardResponse } from "@/hooks/use-dashboard";
import { formatCurrency, formatRelativeDate } from "@/lib/utils/formatters";

/**
 * This file renders the lead pipeline grouped by stage.
 * What calls it: src/components/dashboard/dashboard-page.tsx.
 * What it calls: shared domain constants and formatting helpers.
 * A junior engineer would likely get this wrong by making each stage column fetch
 * independently, which multiplies network chatter and complicates reordering later.
 */
export function PipelineBoard({ leads }: { leads: DashboardResponse["leads"] }) {
  return (
    <section className="grid gap-5 xl:grid-cols-6">
      {LEAD_STAGES.map((stage) => {
        const stageLeads = leads.filter((lead) => lead.stage === stage);

        return (
          <div key={stage} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{stageLabels[stage]}</h3>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {stageLeads.length} visible
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {stageLeads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No leads here yet.
                </div>
              ) : null}

              {stageLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white"
                >
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-950">{lead.companyName}</p>
                      <p className="text-sm text-slate-600">{lead.contactName}</p>
                    </div>

                    <div className="grid gap-2 text-xs text-slate-500">
                      <p>Owner: {lead.owner.name}</p>
                      <p>Pipeline value: {formatCurrency(lead.valueCents)}</p>
                      <p>Next follow-up: {formatRelativeDate(lead.nextFollowUpAt)}</p>
                      <p>
                        Notes {lead._count.notes} · Follow-ups {lead._count.followUps}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

