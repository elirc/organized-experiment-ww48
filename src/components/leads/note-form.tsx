"use client";

import { useState, useTransition } from "react";

import { useAddNote, type LeadDetailResponse } from "@/hooks/use-lead-detail";

/**
 * This file handles note creation on the lead detail page.
 * What calls it: src/components/leads/lead-detail-page.tsx.
 * What it calls: the add-note mutation hook.
 * A junior engineer would likely get this wrong by mutating the note list in the
 * component without reloading the activity timeline that should change with it.
 */
export function NoteForm({ lead }: { lead: LeadDetailResponse }) {
  const addNote = useAddNote(lead.id);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      await addNote.mutateAsync({ body });
      setBody("");
    });
  }

  return (
    <section className="rounded-[1.8rem] border border-white/70 bg-white/90 p-6 shadow-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Notes</p>
        <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-950">
          Add context for the next handoff
        </h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
          placeholder="Capture discovery details, buying committee updates, or objections."
        />

        {addNote.error instanceof Error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {addNote.error.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!body.trim() || addNote.isPending || isPending}
          className="inline-flex rounded-full bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {addNote.isPending || isPending ? "Adding note..." : "Add note"}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {lead.notes.map((note) => (
          <article key={note.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-900">{note.author.name}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{note.author.role}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{note.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

