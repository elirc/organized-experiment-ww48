import type { LeadDetailResponse } from "@/hooks/use-lead-detail";
import { formatDate, formatRelativeDate } from "@/lib/utils/formatters";

/**
 * This file renders the audit timeline for a lead.
 * What calls it: src/components/leads/lead-detail-page.tsx.
 * What it calls: shared date formatting helpers.
 * A junior engineer would likely get this wrong by treating activity logs as a
 * debug-only feature instead of a product feature that users rely on.
 */
export function ActivityTimeline({ activities }: { activities: LeadDetailResponse["activities"] }) {
  return (
    <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 shadow-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Activity log</p>
        <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-950">
          Audit trail
        </h2>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => (
          <article key={activity.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">{activity.message}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{activity.type}</p>
            </div>
            <div className="mt-2 grid gap-1 text-sm text-slate-600">
              <p>
                {activity.actor ? `${activity.actor.name} (${activity.actor.role})` : "System"}
              </p>
              <p>
                {formatRelativeDate(activity.createdAt)} · {formatDate(activity.createdAt)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

