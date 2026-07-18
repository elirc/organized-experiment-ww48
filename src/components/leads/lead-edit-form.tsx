"use client";

import { useState, useTransition } from "react";

import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STAGES } from "@/lib/domain";
import { useUpdateLead, type LeadDetailResponse } from "@/hooks/use-lead-detail";
import type { SessionUser } from "@/lib/types/auth";

/**
 * This file handles editable lead fields and stage transitions on the detail page.
 * What calls it: src/components/leads/lead-detail-page.tsx.
 * What it calls: the update-lead mutation hook and shared domain constants.
 * A junior engineer would likely get this wrong by assuming every visible field
 * should be editable, instead of letting the server remain the source of truth.
 */
export function LeadEditForm({
  lead,
  viewer,
  assignableUsers,
}: {
  lead: LeadDetailResponse;
  viewer: SessionUser;
  assignableUsers: Array<{ id: string; name: string; role: string }>;
}) {
  const updateLead = useUpdateLead(lead.id);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    companyName: lead.companyName,
    contactName: lead.contactName,
    email: lead.email,
    phone: lead.phone ?? "",
    description: lead.description ?? "",
    source: lead.source,
    priority: lead.priority,
    stage: lead.stage,
    ownerId: lead.ownerId,
    valueCents: String(lead.valueCents ?? 0),
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      await updateLead.mutateAsync({
        ...form,
        valueCents: Number(form.valueCents),
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 shadow-sm">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Lead details</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-950">
            Update core lead data
          </h2>
        </div>
        <p className="text-xs text-slate-500">Created by {lead.createdBy.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span>Company</span>
          <input
            value={form.companyName}
            onChange={(event) => updateField("companyName", event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Contact</span>
          <input
            value={form.contactName}
            onChange={(event) => updateField("contactName", event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Source</span>
          <select
            value={form.source}
            onChange={(event) => updateField("source", event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
          >
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Priority</span>
          <select
            value={form.priority}
            onChange={(event) => updateField("priority", event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
          >
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Stage</span>
          <select
            value={form.stage}
            onChange={(event) => updateField("stage", event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
          >
            {LEAD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Owner</span>
          <select
            value={form.ownerId}
            onChange={(event) => updateField("ownerId", event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={viewer.role === "REP"}
          >
            {assignableUsers
              .filter((user) => viewer.role !== "REP" || user.id === viewer.id)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block space-y-2 text-sm text-slate-700">
        <span>Description</span>
        <textarea
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
        />
      </label>

      <label className="mt-4 block max-w-xs space-y-2 text-sm text-slate-700">
        <span>Estimated value in cents</span>
        <input
          type="number"
          min={0}
          value={form.valueCents}
          onChange={(event) => updateField("valueCents", event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
        />
      </label>

      {updateLead.error instanceof Error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {updateLead.error.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={updateLead.isPending || isPending}
        className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {updateLead.isPending || isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
