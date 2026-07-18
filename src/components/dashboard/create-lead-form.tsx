"use client";

import { useState, useTransition } from "react";

import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STAGES } from "@/lib/domain";
import type { DashboardResponse } from "@/hooks/use-dashboard";
import { useCreateLead } from "@/hooks/use-dashboard";
import type { SessionUser } from "@/lib/types/auth";

/**
 * This file handles the create-lead workflow on the dashboard.
 * What calls it: src/components/dashboard/dashboard-page.tsx.
 * What it calls: the create-lead mutation hook and shared domain constants.
 * A junior engineer would likely get this wrong by deriving owner assignment from
 * a hidden input rather than making the server verify the submitted ownerId.
 */
export function CreateLeadForm({
  viewer,
  assignableUsers,
}: {
  viewer: SessionUser;
  assignableUsers: DashboardResponse["assignableUsers"];
}) {
  const createLead = useCreateLead();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    description: "",
    source: "REFERRAL",
    priority: "MEDIUM",
    stage: "NEW",
    ownerId: viewer.id,
    valueCents: "250000",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      try {
        await createLead.mutateAsync({
          ...form,
          valueCents: Number(form.valueCents),
        });

        setForm({
          companyName: "",
          contactName: "",
          email: "",
          phone: "",
          description: "",
          source: "REFERRAL",
          priority: "MEDIUM",
          stage: "NEW",
          ownerId: viewer.id,
          valueCents: "250000",
        });
      } catch {
        // The mutation state already carries the error for the inline alert.
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[2rem] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-sm">
      <div className="mb-5 space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-teal-300">Create lead</p>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">
          Add pipeline momentum without leaving the board.
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Company</span>
          <input
            value={form.companyName}
            onChange={(event) => updateField("companyName", event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Contact</span>
          <input
            value={form.contactName}
            onChange={(event) => updateField("contactName", event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Phone</span>
          <input
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Source</span>
          <select
            value={form.source}
            onChange={(event) => updateField("source", event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
          >
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Priority</span>
          <select
            value={form.priority}
            onChange={(event) => updateField("priority", event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
          >
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Stage</span>
          <select
            value={form.stage}
            onChange={(event) => updateField("stage", event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
          >
            {LEAD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Owner</span>
          <select
            value={form.ownerId}
            onChange={(event) => updateField("ownerId", event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400 disabled:cursor-not-allowed disabled:opacity-70"
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

      <label className="mt-4 block space-y-2 text-sm">
        <span className="text-slate-300">Description</span>
        <textarea
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          className="min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
        />
      </label>

      <label className="mt-4 block max-w-xs space-y-2 text-sm">
        <span className="text-slate-300">Estimated value in cents</span>
        <input
          type="number"
          min={0}
          value={form.valueCents}
          onChange={(event) => updateField("valueCents", event.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-teal-400"
        />
      </label>

      {createLead.error instanceof Error ? (
        <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {createLead.error.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={createLead.isPending || isPending}
        className="mt-5 inline-flex rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {createLead.isPending || isPending ? "Creating..." : "Create lead"}
      </button>
    </form>
  );
}

