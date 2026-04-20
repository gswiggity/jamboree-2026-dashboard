import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Nav } from "@/components/nav"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", user.id)
    .single()

  if (!profile) {
    // Session exists but profile row missing — sign out and bounce.
    await supabase.auth.signOut()
    redirect("/login")
  }

  return (
    <div className="relative flex-1 flex flex-col bg-gradient-to-b from-sky-100 via-white to-sky-50 text-slate-800">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] rounded-full bg-gradient-to-br from-sky-200/55 via-blue-200/35 to-white/0 blur-3xl" />
        <div className="absolute top-[40%] -left-40 h-[380px] w-[380px] rounded-full bg-blue-300/15 blur-3xl" />
        <div className="absolute top-[20%] -right-40 h-[380px] w-[380px] rounded-full bg-cyan-200/25 blur-3xl" />
      </div>
      <Nav email={profile.email} role={profile.role as "admin" | "member"} />
      <main className="relative flex-1 mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
    </div>
  )
}
