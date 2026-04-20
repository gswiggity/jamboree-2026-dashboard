"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { setVerdictsPublished } from "./actions"

export function PublishToggle({ published }: { published: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onChange(next: string | null) {
    if (next !== "hidden" && next !== "published") return
    const nextPublished = next === "published"
    if (nextPublished === published) return
    startTransition(async () => {
      const result = await setVerdictsPublished(nextPublished)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        nextPublished
          ? "Your verdicts are now visible to the team."
          : "Your verdicts are hidden from the team.",
      )
      router.refresh()
    })
  }

  return (
    <Select
      value={published ? "published" : "hidden"}
      onValueChange={onChange}
      disabled={pending}
    >
      <SelectTrigger size="sm" className="min-w-[140px]">
        <SelectValue>
          {(v) => (v === "published" ? "Published" : "Hidden")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="hidden">Hidden</SelectItem>
        <SelectItem value="published">Published</SelectItem>
      </SelectContent>
    </Select>
  )
}
