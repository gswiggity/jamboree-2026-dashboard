import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LoginButton } from "./login-button"

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-sky-100 via-white to-sky-50 text-slate-800">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] rounded-full bg-gradient-to-br from-sky-200/55 via-blue-200/35 to-white/0 blur-3xl" />
        <div className="absolute top-[40%] -left-40 h-[380px] w-[380px] rounded-full bg-blue-300/15 blur-3xl" />
        <div className="absolute top-[20%] -right-40 h-[380px] w-[380px] rounded-full bg-cyan-200/25 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-empty p-10 text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-blue-900 mb-4">
          Swear Jar Jamboree 2026
        </div>
        <h1 className="font-[family-name:var(--font-serif)] text-5xl text-blue-950 leading-[1.05]">
          Organizer{" "}
          <span className="italic text-brand">dashboard</span>
        </h1>
        <p className="text-sm text-slate-700 mt-4 max-w-sm mx-auto">
          Indie comedy + improv fest in Philadelphia. Sign in to triage
          submissions, judge acts, and run the show.
        </p>
        <div className="mt-8">
          <LoginButton />
        </div>
        <p className="text-xs text-slate-600 mt-6">
          Invite-only. If your email isn&apos;t on the list, ask a Jamboree
          admin.
        </p>
      </div>
    </main>
  )
}
