import Link from "next/link"
import { ExternalLink, Inbox, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  buildEmailQuery,
  getAccessTokenForRequest,
  searchThreadsByEmail,
  type GmailThreadSummary,
} from "@/lib/gmail"

type LoadResult =
  | { state: "no-email" }
  | { state: "not-connected" }
  | { state: "error"; message: string }
  | { state: "ok"; accountEmail: string | null; threads: GmailThreadSummary[] }

async function loadThreads(submissionEmail: string | null): Promise<LoadResult> {
  if (!submissionEmail) return { state: "no-email" }
  let auth
  try {
    auth = await getAccessTokenForRequest()
  } catch (e) {
    return {
      state: "error",
      message: e instanceof Error ? e.message : "Gmail auth failed.",
    }
  }
  if (!auth) return { state: "not-connected" }
  try {
    const threads = await searchThreadsByEmail(
      auth.accessToken,
      submissionEmail,
    )
    return {
      state: "ok",
      accountEmail: auth.accountEmail,
      threads,
    }
  } catch (e) {
    return {
      state: "error",
      message: e instanceof Error ? e.message : "Failed to load threads.",
    }
  }
}

export async function ConversationsCard({
  submissionEmail,
}: {
  submissionEmail: string | null
}) {
  const result = await loadThreads(submissionEmail)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Conversations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {result.state === "no-email" && (
          <p className="text-muted-foreground">
            No contact email on this submission, so we can&apos;t pull related
            email threads.
          </p>
        )}

        {result.state === "not-connected" && (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Connect the team Gmail to see threads with this contact.
            </p>
            <Link
              href="/settings"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open Settings
            </Link>
          </div>
        )}

        {result.state === "error" && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
            <div className="font-medium">Couldn&apos;t load conversations.</div>
            <p className="text-xs mt-0.5 break-words">{result.message}</p>
          </div>
        )}

        {result.state === "ok" && (
          <ThreadList
            threads={result.threads}
            accountEmail={result.accountEmail}
            queryEmail={submissionEmail!}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ThreadList({
  threads,
  accountEmail,
  queryEmail,
}: {
  threads: GmailThreadSummary[]
  accountEmail: string | null
  queryEmail: string
}) {
  // Gmail's `/mail/u/<n>/` expects an integer index; `?authuser=<email>` lets
  // us target a specific account by address regardless of how Gmail has it
  // ordered locally. Falling back to `/u/0/` if we don't know the email.
  const accountQS = accountEmail
    ? `?authuser=${encodeURIComponent(accountEmail)}`
    : ""
  const accountPath = accountEmail ? "" : "u/0/"
  const allMail = `https://mail.google.com/mail/${accountPath}${accountQS}#search/${encodeURIComponent(buildEmailQuery(queryEmail))}`

  if (threads.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Inbox className="size-4" />
          <span>
            No emails on file for{" "}
            <span className="font-medium">{queryEmail}</span>.
          </span>
        </div>
        <a
          href={allMail}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline underline-offset-4 inline-flex items-center gap-1"
        >
          Search in Gmail <ExternalLink className="size-3" />
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y -mx-1">
        {threads.map((t) => {
          const url = `https://mail.google.com/mail/${accountPath}${accountQS}#all/${t.id}`
          return (
            <li key={t.id} className="px-1 py-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {t.unread && (
                      <span
                        className="size-1.5 rounded-full bg-blue-500 shrink-0"
                        aria-label="Unread"
                      />
                    )}
                    <span
                      className={cn(
                        "truncate group-hover:underline underline-offset-4",
                        t.unread ? "font-semibold" : "font-medium",
                      )}
                    >
                      {t.subject}
                    </span>
                  </div>
                  {t.lastDate && (
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {formatRelative(t.lastDate)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  <span className="font-medium text-foreground/70">
                    {t.fromName ?? t.fromEmail ?? "(unknown sender)"}
                  </span>
                  {t.messageCount > 1 && (
                    <span className="ml-1.5">· {t.messageCount} messages</span>
                  )}
                  {t.snippet && (
                    <span className="ml-1.5">— {t.snippet}</span>
                  )}
                </div>
              </a>
            </li>
          )
        })}
      </ul>
      <a
        href={allMail}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline underline-offset-4 inline-flex items-center gap-1"
      >
        Open all in Gmail <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

function formatRelative(ms: number): string {
  const diffMs = Date.now() - ms
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d`
  return new Date(ms).toLocaleDateString()
}
