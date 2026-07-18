"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { CreateLeadForm } from "@/components/dashboard/create-lead-form";
import { PipelineBoard } from "@/components/dashboard/pipeline-board";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { AppShell } from "@/components/layout/app-shell";
import { useDashboard } from "@/hooks/use-dashboard";
import { LEAD_STAGES, stageLabels } from "@/lib/domain";
import type { SessionUser } from "@/lib/types/auth";
import { formatDate, formatRelativeDate } from "@/lib/utils/formatters";

/**
 * This file coordinates the main dashboard screen and its query-driven UI state.
 * What calls it: src/app/page.tsx.
 * What it calls: AppShell, dashboard hooks, and presentational dashboard components.
 * A junior engineer would likely get this wrong by letting every child own its
 * own copy of filters, which quickly desynchronizes the dashboard state.
 */
export function DashboardPage({ viewer }: { viewer: SessionUser }) {
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(viewer.role === "REP");
  const deferredSearch = useDeferredValue(search);
  const dashboardQuery = useDashboard({
    stage: selectedStage ? (selectedStage as (typeof LEAD_STAGES)[number]) : undefined,
    search: deferredSearch || undefined,
    mineOnly,
  });

  return (
    <AppShell
      viewer={viewer}
      eyebrow="CRM pipeline"
      title="Lead pipeline command center"
      description="Track ownership, stage movement, follow-ups, and the audit trail from one place. The UI stays intentionally thin while the service layer owns the rules."
    >
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Board filters</p>
                  <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-950">
                    Focus the pipeline without changing the security boundary.
                  </h2>
                </div>
                <div className="text-sm text-slate-500">
                  Reps only ever see their owned leads; manager filters just narrow the result set.
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.6fr]">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">Search company or contact</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                    placeholder="Northwind, Dana, northwind.example"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">Stage</span>
                  <select
                    value={selectedStage}
                    onChange={(event) => setSelectedStage(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                  >
                    <option value="">All stages</option>
                    {LEAD_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageLabels[stage]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={mineOnly}
                    onChange={(event) => setMineOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600"
                  />
                  Show only my leads
                </label>
              </div>
            </div>

            {dashboardQuery.isLoading ? (
              <div className="rounded-[2rem] border border-white/70 bg-white/88 p-10 text-sm text-slate-500 shadow-sm">
                Loading the latest pipeline snapshot...
              </div>
            ) : null}

            {dashboardQuery.error instanceof Error ? (
              <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
                {dashboardQuery.error.message}
              </div>
            ) : null}

            {dashboardQuery.data ? (
              <>
                <SummaryCards data={dashboardQuery.data} />
                <PipelineBoard leads={dashboardQuery.data.leads} />
              </>
            ) : null}
          </div>

          <div className="space-y-6">
            {dashboardQuery.data ? (
              <CreateLeadForm
                viewer={viewer}
                assignableUsers={dashboardQuery.data.assignableUsers}
              />
            ) : null}

            <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-sm">
              <div className="mb-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Upcoming follow-ups</p>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-950">
                  Operational view
                </h2>
              </div>

              <div className="space-y-3">
                {dashboardQuery.data?.upcomingFollowUps.length ? (
                  dashboardQuery.data.upcomingFollowUps.map((followUp) => (
                    <Link
                      key={followUp.id}
                      href={`/leads/${followUp.lead.id}`}
                      className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-teal-300 hover:bg-white"
                    >
                      <p className="font-semibold text-slate-950">{followUp.lead.companyName}</p>
                      <p className="mt-1 text-sm text-slate-600">{followUp.description}</p>
                      <div className="mt-3 grid gap-1 text-xs text-slate-500">
                        <p>Due {formatRelativeDate(followUp.dueAt)} · {formatDate(followUp.dueAt)}</p>
                        <p>
                          Owner {followUp.owner.name} · Stage {stageLabels[followUp.lead.stage]}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No pending follow-ups in the current view.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
