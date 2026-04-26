"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { CheckCircle2, Mail, AlertCircle, Plug, PlugZap } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { disconnectGmail } from "./gmail-actions"

type Props = {
  connected: boolean
  accountEmail: string | null
  connectedAt: string | null
  lastUsedAt: string | null
}

export function GmailIntegrationCard({
  connected,
  accountEmail,
  connectedAt,
  lastUsedAt,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  // Surface ?gmail_connected / ?gmail_error from the OAuth callback as toasts.
  useEffect(() => {
    const ok = params.get("gmail_connected")
    const err = params.get("gmail_error")
    if (ok) {
      toast.success("Gmail connected.")
      const sp = new URLSearchParams(params)
      sp.delete("gmail_connected")
      router.replace(`/settings${sp.toString() ? `?${sp.toString()}` : ""}`)
    }
    if (err) {
      toast.error(err)
      const sp = new URLSearchParams(params)
      sp.delete("gmail_error")
      router.replace(`/settings${sp.toString() ? `?${sp.toString()}` : ""}`)
    }
  }, [params, router])

  function disconnect() {
    if (
      !confirm(
        "Disconnect the team Gmail? Email previews on submission pages will stop working until you reconnect.",
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await disconnectGmail()
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Disconnected.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Gmail integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <div>
                  Connected as{" "}
                  <span className="font-semibold">
                    {accountEmail ?? "(unknown account)"}
                  </span>
                </div>
                <div className="text-xs text-emerald-800/80">
                  {connectedAt &&
                    `Connected ${new Date(connectedAt).toLocaleString()}`}
                  {lastUsedAt && (
                    <>
                      {connectedAt && " · "}
                      Last used {new Date(lastUsedAt).toLocaleString()}
                    </>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Submission detail pages now show conversations matching the
              contact email. Tokens are admin-only and stored server-side.
            </p>
            <div className="flex gap-2">
              <a
                href="/auth/gmail/start"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "gap-1.5",
                })}
              >
                <PlugZap className="h-3.5 w-3.5" />
                Reconnect
              </a>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={disconnect}
                disabled={pending}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
              <div>
                Not connected. Connect the team Gmail account to surface
                related conversations on each submission.
              </div>
            </div>
            <a
              href="/auth/gmail/start"
              className={buttonVariants({
                size: "sm",
                className: "gap-1.5",
              })}
            >
              <Plug className="h-3.5 w-3.5" />
              Connect Gmail
            </a>
            <p className="text-[11px] text-muted-foreground">
              Read-only scope. Tokens are stored on the server and only ever
              minted with admin access.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
