"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { addAllowedEmail, removeAllowedEmail } from "./invite-actions"

type AllowedEmail = {
  email: string
  invited_at: string
}

export function AllowlistManager({
  allowed,
  currentUserEmail,
}: {
  allowed: AllowedEmail[]
  currentUserEmail: string
}) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState("")
  const [pending, startTransition] = useTransition()

  function handleAdd() {
    const value = newEmail.trim()
    if (!value) return
    startTransition(async () => {
      const res = await addAllowedEmail(value)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Added ${value.toLowerCase()}.`)
      setNewEmail("")
      router.refresh()
    })
  }

  function handleRemove(email: string) {
    if (
      !confirm(
        `Remove ${email} from the allowlist? They won't be able to sign in if they lose their session.`,
      )
    )
      return
    startTransition(async () => {
      const res = await removeAllowedEmail(email)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Removed ${email}.`)
      router.refresh()
    })
  }

  const sorted = [...allowed].sort((a, b) =>
    a.invited_at.localeCompare(b.invited_at),
  )

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleAdd()
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="space-y-1 flex-1 min-w-[220px]">
          <Label
            htmlFor="allow-email"
            className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500"
          >
            Invite email
          </Label>
          <Input
            id="allow-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new-teammate@example.com"
            disabled={pending}
          />
        </div>
        <Button type="submit" size="sm" disabled={pending || !newEmail.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {pending ? "Adding…" : "Add to allowlist"}
        </Button>
      </form>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No invites on the allowlist yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200/60 rounded-lg border border-slate-200/70 overflow-hidden bg-white/40 text-sm">
          {sorted.map((a) => {
            const isSelf = a.email === currentUserEmail
            return (
              <li
                key={a.email}
                className="py-2.5 px-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono truncate">{a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    invited {new Date(a.invited_at).toLocaleDateString()}
                    {isSelf && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500">
                        you
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(a.email)}
                  disabled={pending || isSelf}
                  title={
                    isSelf
                      ? "Can't remove yourself — you'd be locked out if your session ended."
                      : undefined
                  }
                  className={cn(
                    "h-8 shrink-0",
                    !isSelf && "text-rose-600 hover:text-rose-700 hover:bg-rose-50",
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only md:not-sr-only md:ml-1">Remove</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Added emails can sign in with Google. Removing an email blocks future
        sign-ups but doesn&apos;t affect existing sessions.
      </p>
    </div>
  )
}
