"use client";

import { useState, useTransition } from "react";

import { useAddFollowUp, useUpdateFollowUpStatus, type LeadDetailResponse } from "@/hooks/use-lead-detail";
import type { SessionUser } from "@/lib/types/auth";
import { formatDate, formatRelativeDate } from "@/lib/utils/formatters";

/**
 * This file handles follow-up scheduling plus status actions for existing follow-ups.
 * What calls it: src/components/leads/lead-detail-page.tsx.
 * What it calls: follow-up mutation hooks and shared formatting helpers.
 * A junior engineer would likely get this wrong by exposing "complete" buttons
 * without checking which follow-ups are still pending in the server workflow.
 */
export function FollowUpForm({
  lead,
  viewer,
  assignableUsers,
}: {
  lead: LeadDetailResponse;
  viewer: SessionUser;
  assignableUsers: Array<{ id: string; name: string; role: string }>;
}) {
  const addFollowUp = useAddFollowUp(lead.id);
  const updateFollowUpStatus = useUpdateFollowUpStatus(lead.id);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    description: "",
    dueAt: "",
    ownerId: viewer.id,
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      await addFollowUp.mutateAsync({
        ...form,
        dueAt: form.dueAt,
      });

      setForm({
        description: "",
        dueAt: "",
        ownerId: viewer.id,
      });
    });
  }

  return (
    <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 shadow-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Follow-ups</p>
        <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-950">
          Keep the pipeline moving on purpose
        </h2>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
        <input
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400"
          placeholder="Prep pricing review with finance lead"
        />
        <input
          type="datetime-local"
          value={form.dueAt}
          onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400"
        />
        <select
          value={form.ownerId}
          onChange={(event) => setForm((current) => ({ ...current, ownerId: event.target.value }))}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={viewer.role === "REP"}
        >
          {assignableUsers
            .filter((user) => viewer.role !== "REP" || user.id === viewer.id)
            .map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
        </select>
        <button
          type="submit"
          disabled={!form.description.trim() || !form.dueAt || addFollowUp.isPending || isPending}
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Schedule
        </button>
      </form>

      {addFollowUp.error instanceof Error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {addFollowUp.error.message}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {lead.followUps.map((followUp) => (
          <article key={followUp.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="font-semibold text-slate-900">{followUp.description}</p>
                <div className="grid gap-1 text-sm text-slate-600">
                  <p>Owner: {followUp.owner.name}</p>
                  <p>
                    Due {formatRelativeDate(followUp.dueAt)} · {formatDate(followUp.dueAt)}
                  </p>
                  <p>Status: {followUp.status}</p>
                </div>
              </div>
              {followUp.status === "PENDING" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateFollowUpStatus.mutate({ followUpId: followUp.id, status: "COMPLETED" })
                    }
                    className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateFollowUpStatus.mutate({ followUpId: followUp.id, status: "CANCELED" })
                    }
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

