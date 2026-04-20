"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveJudgment } from "@/app/(app)/submissions/[id]/actions"

type Verdict = "yes" | "no" | "maybe"

const VERDICTS: { key: Verdict; label: string; activeClass: string }[] = [
  {
    key: "yes",
    label: "Yes",
    activeClass:
      "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-600",
  },
  {
    key: "maybe",
    label: "Could be convinced",
    activeClass:
      "bg-amber-500 text-white border-amber-500 hover:bg-amber-500",
  },
  {
    key: "no",
    label: "No",
    activeClass: "bg-rose-600 text-white border-rose-600 hover:bg-rose-600",
  },
]

export function JudgingForm({
  submissionId,
  initialVerdict,
  initialNotes,
}: {
  submissionId: string
  initialVerdict: Verdict | null
  initialNotes: string
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(initialVerdict)
  const [notes, setNotes] = useState(initialNotes)
  const [savedVerdict, setSavedVerdict] = useState<Verdict | null>(initialVerdict)
  const [savedNotes, setSavedNotes] = useState(initialNotes)
  const [pending, startTransition] = useTransition()

  const dirty = verdict !== savedVerdict || notes !== savedNotes

  function commit(nextVerdict: Verdict | null, nextNotes: string) {
    startTransition(async () => {
      const result = await saveJudgment(submissionId, nextVerdict, nextNotes)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSavedVerdict(nextVerdict)
      setSavedNotes(nextNotes)
      toast.success("Saved.")
    })
  }

  function pick(next: Verdict) {
    const chosen = next === verdict ? null : next
    setVerdict(chosen)
    commit(chosen, notes)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm">Your verdict</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {VERDICTS.map((v) => {
            const active = verdict === v.key
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => pick(v.key)}
                disabled={pending}
                className={cn(
                  "px-4 py-2 text-sm rounded-md border transition-colors disabled:opacity-50",
                  active
                    ? v.activeClass
                    : "bg-background hover:bg-accent border-border",
                )}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm">
          Notes
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why — anything your teammates should know."
          rows={4}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => commit(verdict, notes)}
            disabled={pending || !dirty}
          >
            {pending ? "Saving…" : "Save notes"}
          </Button>
          {!dirty && savedVerdict !== null && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>
      </div>
    </div>
  )
}
