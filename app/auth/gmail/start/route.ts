import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { buildAuthorizeUrl } from "@/lib/gmail"

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Admin only.")}`,
    )
  }

  // CSRF/state cookie — bound to this user's browser, validated on callback.
  const state = randomBytes(24).toString("base64url")
  const url = buildAuthorizeUrl(state)

  const response = NextResponse.redirect(url)
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  })
  return response
}
