import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  decodeIdTokenEmail,
  exchangeCodeForTokens,
} from "@/lib/gmail"

function fail(origin: string, message: string) {
  return NextResponse.redirect(
    `${origin}/settings?gmail_error=${encodeURIComponent(message)}`,
  )
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  if (error) return fail(origin, error)
  if (!code || !state) return fail(origin, "Missing code or state.")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  // CSRF check.
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("gmail_oauth_state="))
    ?.split("=")[1]
  if (!cookieState || cookieState !== state) {
    return fail(origin, "OAuth state mismatch.")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") return fail(origin, "Admin only.")

  let tokens
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (e) {
    return fail(origin, e instanceof Error ? e.message : "Token exchange failed.")
  }

  if (!tokens.refresh_token) {
    // Google withholds refresh_token on re-consent unless we forced prompt=consent.
    // Our authorize URL sets prompt=consent, so this is rare — surface clearly.
    return fail(
      origin,
      "Google did not return a refresh token. Disconnect existing access at myaccount.google.com → Security → Third-party access, then try again.",
    )
  }

  const accountEmail = decodeIdTokenEmail(tokens.id_token)

  const { error: upsertErr } = await supabase.from("gmail_integration").upsert(
    {
      id: true,
      account_email: accountEmail,
      refresh_token: tokens.refresh_token,
      scopes: tokens.scope,
      connected_at: new Date().toISOString(),
      connected_by: user.id,
    },
    { onConflict: "id" },
  )
  if (upsertErr) return fail(origin, upsertErr.message)

  const response = NextResponse.redirect(`${origin}/settings?gmail_connected=1`)
  response.cookies.set("gmail_oauth_state", "", {
    maxAge: 0,
    path: "/",
  })
  return response
}
