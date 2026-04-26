// Gmail OAuth + readonly API helpers. Uses raw fetch — no SDK — so we don't
// pull in googleapis just for one access token + a couple of list/get calls.

import { createClient } from "@/lib/supabase/server"

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
] as const

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

function requireEnv(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI must be set",
    )
  }
  return { clientId, clientSecret, redirectUri }
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = requireEnv()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // we need a refresh_token
    prompt: "consent", // force refresh_token issuance even on re-consent
    include_granted_scopes: "true",
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: "Bearer"
  id_token?: string
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireEnv()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  })
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Token exchange failed: ${r.status} ${text}`)
  }
  return (await r.json()) as TokenResponse
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = requireEnv()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Refresh failed: ${r.status} ${text}`)
  }
  const data = (await r.json()) as TokenResponse
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

// Decode a Google ID token (no signature verification — we trust it because we
// just received it from Google over TLS in response to our own client_secret).
export function decodeIdTokenEmail(idToken: string | undefined): string | null {
  if (!idToken) return null
  const parts = idToken.split(".")
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { email?: string }
    return payload.email ?? null
  } catch {
    return null
  }
}

// --- Gmail API ---

export type GmailThreadSummary = {
  id: string
  subject: string
  fromName: string | null
  fromEmail: string | null
  snippet: string
  lastDate: number | null // ms epoch from message internalDate
  messageCount: number
  unread: boolean
}

type GmailHeader = { name: string; value: string }
type GmailMessage = {
  id: string
  threadId: string
  internalDate?: string
  snippet?: string
  labelIds?: string[]
  payload?: { headers?: GmailHeader[] }
}
type GmailThread = {
  id: string
  messages: GmailMessage[]
}

function header(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers) return null
  const found = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )
  return found?.value ?? null
}

function parseFromHeader(raw: string | null): {
  name: string | null
  email: string | null
} {
  if (!raw) return { name: null, email: null }
  // "Name <email@x.com>" or just "email@x.com"
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (m) {
    const name = m[1].replace(/^"|"$/g, "").trim() || null
    return { name, email: m[2].trim().toLowerCase() }
  }
  const trimmed = raw.trim().toLowerCase()
  if (trimmed.includes("@")) return { name: null, email: trimmed }
  return { name: trimmed || null, email: null }
}

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Gmail API ${path} failed: ${r.status} ${text}`)
  }
  return (await r.json()) as T
}

export async function searchThreadsByEmail(
  accessToken: string,
  email: string,
  maxResults = 20,
): Promise<GmailThreadSummary[]> {
  // Quote the email so Gmail treats it as a single token.
  const q = `from:"${email}" OR to:"${email}"`
  const list = await gmailFetch<{ threads?: { id: string }[] }>(
    accessToken,
    `/users/me/threads?q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
  )
  const threadIds = (list.threads ?? []).map((t) => t.id)
  if (threadIds.length === 0) return []

  const threads = await Promise.all(
    threadIds.map((id) =>
      gmailFetch<GmailThread>(
        accessToken,
        `/users/me/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      ).catch((): GmailThread | null => null),
    ),
  )

  const summaries: GmailThreadSummary[] = []
  for (const t of threads) {
    if (!t || !t.messages || t.messages.length === 0) continue
    const last = t.messages[t.messages.length - 1]
    const subject = header(last.payload?.headers, "Subject") ?? "(no subject)"
    const { name, email: fromEmail } = parseFromHeader(
      header(last.payload?.headers, "From"),
    )
    const internal = last.internalDate ? Number(last.internalDate) : null
    const unread = (last.labelIds ?? []).includes("UNREAD")
    summaries.push({
      id: t.id,
      subject,
      fromName: name,
      fromEmail,
      snippet: last.snippet ?? "",
      lastDate: internal,
      messageCount: t.messages.length,
      unread,
    })
  }
  summaries.sort((a, b) => (b.lastDate ?? 0) - (a.lastDate ?? 0))
  return summaries
}

// --- Singleton row helpers (admin caller required by RLS) ---

export type GmailIntegrationRow = {
  account_email: string | null
  refresh_token: string | null
  scopes: string | null
  connected_at: string | null
  last_used_at: string | null
}

export async function readIntegration(): Promise<GmailIntegrationRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("gmail_integration")
    .select(
      "account_email, refresh_token, scopes, connected_at, last_used_at",
    )
    .eq("id", true)
    .maybeSingle()
  return data ?? null
}

export async function getAccessTokenForRequest(): Promise<{
  accessToken: string
  accountEmail: string | null
} | null> {
  const integration = await readIntegration()
  if (!integration?.refresh_token) return null
  const { accessToken } = await refreshAccessToken(integration.refresh_token)
  // Best-effort touch — RLS only allows admins to update, so swallow errors
  // when a member triggers a read-only fetch.
  const supabase = await createClient()
  await supabase
    .from("gmail_integration")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", true)
  return { accessToken, accountEmail: integration.account_email }
}
