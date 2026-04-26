"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  drafts: { id: string; name: string; is_published: boolean }[]
  selectedId: string
}

export function DraftPicker({ drafts, selectedId }: Props) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Draft:</span>
      <Select
        value={selectedId}
        onValueChange={(v) => {
          if (!v) return
          router.push(`/production/programming?draft=${v}`)
        }}
      >
        <SelectTrigger className="w-64">
          <SelectValue>
            {(v) => {
              const d = drafts.find((x) => x.id === v)
              if (!d) return ""
              return d.is_published ? `${d.name} · published` : d.name
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {drafts.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.is_published ? `${d.name} · published` : d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
