"use client"

import { useMemo, useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { pickBlurb, type ActSubmission } from "./act-marketing"

type Act = {
  submission: ActSubmission
  duration_minutes: number | null
}

type Props = {
  blockTitle: string
  theme: string
  host: string
  acts: Act[]
}

function buildCopy({
  blockTitle,
  theme,
  host,
  acts,
}: Props): string {
  const lines: string[] = []
  if (blockTitle.trim()) lines.push(blockTitle.trim().toUpperCase())
  if (theme.trim()) lines.push(theme.trim())
  if (host.trim()) lines.push(`Hosted by ${host.trim()}.`)
  if (lines.length > 0) lines.push("")

  const billed = acts.map((a) => {
    const name = a.submission.name?.trim() || "Untitled"
    const blurb = pickBlurb(a.submission)
    return blurb ? `${name} — ${blurb}` : name
  })

  if (billed.length > 0) {
    lines.push("Featuring:")
    for (const b of billed) lines.push(`• ${b}`)
  }

  return lines.join("\n").trim()
}

export function BillingPreview(props: Props) {
  const copy = useMemo(() => buildCopy(props), [props])
  const [draft, setDraft] = useState(copy)
  const [edited, setEdited] = useState(false)
  const [copied, setCopied] = useState(false)

  // Reset textarea when source changes — but only if user hasn't manually edited.
  const value = edited ? draft : copy

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Billing copied.")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing preview</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <CheckIcon className="size-3.5" /> Copied
              </>
            ) : (
              <>
                <CopyIcon className="size-3.5" /> Copy
              </>
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => {
            setDraft(e.target.value)
            setEdited(true)
          }}
          rows={Math.min(20, Math.max(6, value.split("\n").length + 1))}
          className="font-mono text-xs leading-relaxed"
          placeholder="Add acts and a theme to start building copy."
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Pulled from each act&apos;s submission. Edit freely — your text wins until you reset.
          </span>
          {edited && (
            <button
              type="button"
              onClick={() => {
                setDraft(copy)
                setEdited(false)
              }}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Reset to generated
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
