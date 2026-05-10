"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function CopyLineupButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  if (!text) return null

  async function onClick() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Lineup copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access")
    }
  }

  return (
    <Button onClick={onClick} variant="outline" size="sm">
      {copied ? (
        <>
          <CheckIcon className="size-4" />
          Copied
        </>
      ) : (
        <>
          <CopyIcon className="size-4" />
          Copy lineup
        </>
      )}
    </Button>
  )
}
