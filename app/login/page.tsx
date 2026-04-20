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
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Jamboree</h1>
          <p className="text-sm text-muted-foreground">
            Swear Jar Jamboree 2026 — organizer dashboard.
          </p>
        </div>
        <LoginButton />
        <p className="text-xs text-muted-foreground">
          Invite-only. If your email isn&apos;t on the list, ask a Jamboree admin.
        </p>
      </div>
    </main>
  )
}
