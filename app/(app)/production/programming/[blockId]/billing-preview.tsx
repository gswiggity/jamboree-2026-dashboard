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
import { pickBlurb, pickStr, type ActSubmission } from "./act-marketing"

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

type ActListEntry = {
  id: string
  name: string
  location: string | null
  description: string | null
}

function buildEntries(acts: Act[]): ActListEntry[] {
  return acts.map((a) => ({
    id: a.submission.id,
    name: a.submission.name?.trim() || "Untitled",
    location: pickStr(a.submission.data, "Location"),
    description: pickBlurb(a.submission),
  }))
}

function buildCopy(entries: ActListEntry[]): string {
  return entries
    .map((e) => {
      const head = e.location ? `${e.name} • ${e.location}` : e.name
      return e.description ? `${head}\n${e.description}` : head
    })
    .join("\n\n")
    .trim()
}

export function BillingPreview({ acts }: Props) {
  const entries = useMemo(() => buildEntries(acts), [acts])
  const copyText = useMemo(() => buildCopy(entries), [entries])
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      toast.success("Act list copied.")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Act list</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={entries.length === 0}
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
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add acts to this block to build the act list.
          </p>
        ) : (
          <ol className="space-y-5">
            {entries.map((e) => (
              <li key={e.id} className="space-y-1">
                <p className="text-sm font-medium leading-snug">
                  {e.name}
                  {e.location && (
                    <span className="text-muted-foreground font-normal">
                      {" • "}
                      {e.location}
                    </span>
                  )}
                </p>
                {e.description ? (
                  <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {e.description}
                  </p>
                ) : (
                  <p className="text-xs italic text-muted-foreground/70">
                    No show description on file.
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
