"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";

import { apiFetch } from "@/lib/http/client";

/**
 * This file handles the login UX and sends credential requests to the auth route.
 * What calls it: src/app/login/page.tsx.
 * What it calls: the browser fetch helper and Next.js router refresh/navigation.
 * A junior engineer would likely get this wrong by navigating optimistically
 * before the session cookie is actually written by the server response.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("manager@crm.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        router.push("/");
        router.refresh();
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Unable to sign in.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_20px_80px_-45px_rgba(36,41,51,0.5)] backdrop-blur">
      <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">
        <LockKeyhole className="h-3.5 w-3.5" />
        Demo sign-in
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-teal-400"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-teal-400"
          required
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Signing in..." : "Enter CRM workspace"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
