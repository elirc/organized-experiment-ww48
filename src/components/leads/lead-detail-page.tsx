"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { FollowUpForm } from "@/components/leads/follow-up-form";
import { LeadEditForm } from "@/components/leads/lead-edit-form";
import { NoteForm } from "@/components/leads/note-form";
import { useLeadDetail } from "@/hooks/use-lead-detail";
import type { SessionUser } from "@/lib/types/auth";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

/**
 * This file coordinates the lead detail view and its nested mutation forms.
 * What calls it: src/app/leads/[leadId]/page.tsx.
 * What it calls: AppShell, lead-detail hooks, and detail subcomponents.
 * A junior engineer would likely get this wrong by letting child components load
 * the same lead independently, multiplying requests and cache invalidation work.
 */
export function LeadDetailPage({
  leadId,
  viewer,
  assignableUsers,
}: {
  leadId: string;
  viewer: SessionUser;
  assignableUsers: Array<{ id: string; name: string; role: string }>;
}) {
  const leadQuery = useLeadDetail(leadId);

  return (
    <AppShell
      viewer={viewer}
      eyebrow="Lead workspace"
      title="Lead detail and operating trail"
      description="This page is where stage transitions, reassignment, notes, follow-ups, and audit logging all converge. The UI stays declarative while the service layer enforces the workflow."
    >
      {leadQuery.isLoading ? (
        <div className="rounded-[2rem] border border-white/70 bg-white/88 p-10 text-sm text-slate-500 shadow-sm">
          Loading lead details...
        </div>
      ) : null}

      {leadQuery.error instanceof Error ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {leadQuery.error.message}
        </div>
      ) : null}

      {leadQuery.data ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Current stage</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-slate-950">
                {leadQuery.data.stage}
              </h2>
            </article>
            <article className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Owner</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-slate-950">
                {leadQuery.data.owner.name}
              </h2>
            </article>
            <article className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Pipeline value</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-slate-950">
                {formatCurrency(leadQuery.data.valueCents)}
              </h2>
            </article>
            <article className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Next follow-up</p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold text-slate-950">
                {formatDate(leadQuery.data.nextFollowUpAt)}
              </h2>
            </article>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <LeadEditForm
                key={`${leadQuery.data.id}-${leadQuery.data.activities[0]?.id ?? "initial"}`}
                lead={leadQuery.data}
                viewer={viewer}
                assignableUsers={assignableUsers}
              />
              <NoteForm lead={leadQuery.data} />
            </div>

            <div className="space-y-6">
              <FollowUpForm
                lead={leadQuery.data}
                viewer={viewer}
                assignableUsers={assignableUsers}
              />
              <ActivityTimeline activities={leadQuery.data.activities} />
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
