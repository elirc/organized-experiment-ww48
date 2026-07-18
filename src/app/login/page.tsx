import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getPageSession } from "@/lib/auth/session";

/**
 * This file renders the login entry point and redirects already-authenticated users.
 * What calls it: the browser requesting /login.
 * What it calls: session helpers and the login form component.
 * A junior engineer would likely get this wrong by showing the login page to
 * authenticated users and creating confusing double-navigation behavior.
 */
export default async function LoginPage() {
  const session = await getPageSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(112,205,170,0.2),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(255,191,113,0.24),_transparent_30%),linear-gradient(180deg,#f6f1e8_0%,#fbf8f2_60%,#efe7da_100%)] px-6 py-10 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-center">
          <div className="max-w-2xl space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] text-teal-700">Production-style CRM</p>
            <h1 className="font-[family-name:var(--font-heading)] text-6xl font-semibold leading-none tracking-tight text-slate-950">
              Lead pipeline architecture you can actually read.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-600">
              This project is built to teach how requests move from a page to a route, through validation,
              into a service layer, and down to repository-scoped database queries.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                "Centralized RBAC and ownership checks",
                "Activity logging tied to transactions",
                "Service and repository boundaries you can review",
              ].map((item) => (
                <div key={item} className="rounded-[1.6rem] border border-white/70 bg-white/80 p-4 text-sm text-slate-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex items-center">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

