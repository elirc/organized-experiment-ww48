"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, PanelTopClose, Waypoints } from "lucide-react";

import { apiFetch } from "@/lib/http/client";
import type { SessionUser } from "@/lib/types/auth";

/**
 * This file provides the shared chrome for authenticated pages.
 * What calls it: dashboard-page.tsx and lead-detail-page.tsx.
 * What it calls: logout API requests and Next.js navigation helpers.
 * A junior engineer would likely get this wrong by duplicating auth-aware header
 * logic in each page instead of giving the app a reusable shell boundary.
 */
export function AppShell({
  viewer,
  eyebrow,
  title,
  description,
  children,
}: {
  viewer: SessionUser;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(112,205,170,0.24),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(255,191,113,0.2),_transparent_32%),linear-gradient(180deg,#f5efe1_0%,#faf7f0_58%,#f0ebe0_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_18px_70px_-40px_rgba(39,45,58,0.45)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-teal-700">
                <Waypoints className="h-4 w-4" />
                {eyebrow}
              </div>
              <div className="space-y-2">
                <h1 className="font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight text-slate-950">
                  {title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-4 text-slate-50 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Signed in as</p>
                <p className="text-sm font-semibold">{viewer.name}</p>
                <p className="text-xs text-slate-300">
                  {viewer.email} · {viewer.role}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-teal-400 hover:text-teal-200"
                >
                  <PanelTopClose className="h-4 w-4" />
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 py-8">{children}</main>
      </div>
    </div>
  );
}

