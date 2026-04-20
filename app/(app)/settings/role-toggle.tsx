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
import { setUserRole } from "./actions"

export function RoleToggle({
  userId,
  role,
  disabled,
  disabledReason,
}: {
  userId: string
  role: "admin" | "member"
  disabled?: boolean
  disabledReason?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onChange(next: string | null) {
    if (next !== "admin" && next !== "member") return
    if (next === role) return
    startTransition(async () => {
      const result = await setUserRole(userId, next)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(next === "admin" ? "Promoted to admin." : "Demoted to member.")
      router.refresh()
    })
  }

  return (
    <Select
      value={role}
      onValueChange={onChange}
      disabled={disabled || pending}
    >
      <SelectTrigger
        size="sm"
        className="min-w-[110px]"
        title={disabled ? disabledReason : undefined}
      >
        <SelectValue>{(v) => (v === "admin" ? "Admin" : "Member")}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  )
}
