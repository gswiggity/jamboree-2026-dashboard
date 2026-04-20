"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function LoginButton() {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setLoading(false)
      alert(error.message)
    }
  }

  return (
    <Button onClick={signInWithGoogle} size="lg" className="w-full" disabled={loading}>
      {loading ? "Redirecting…" : "Sign in with Google"}
    </Button>
  )
}
