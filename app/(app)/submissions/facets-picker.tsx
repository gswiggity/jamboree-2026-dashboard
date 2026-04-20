"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Facet = { key: string; label: string; count: number }

export function ActFacetsPicker({
  typeFacets,
  locationFacets,
  selectedActType,
  selectedLocation,
  type,
  filter,
}: {
  typeFacets: Facet[]
  locationFacets: Facet[]
  selectedActType: string
  selectedLocation: string
  type: string
  filter: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function push(param: "actType" | "location", value: string) {
    const sp = new URLSearchParams(searchParams)
    sp.set("type", type)
    if (filter !== "all") sp.set("filter", filter)
    else sp.delete("filter")
    if (value === "all") sp.delete(param)
    else sp.set(param, value)
    router.push(`/submissions?${sp.toString()}`)
  }

  const activeCount =
    (selectedActType !== "all" ? 1 : 0) + (selectedLocation !== "all" ? 1 : 0)

  return (
    <div className="flex flex-wrap items-center gap-2 flex-1">
      <Select
        value={selectedActType}
        onValueChange={(v) => v && push("actType", v)}
      >
        <SelectTrigger className="h-8 rounded-full bg-white/80 border-slate-200 text-sm font-medium px-3 min-w-[160px] hover:bg-white">
          <SelectValue>
            {(v) => {
              if (v === "all" || !v) return "All act types"
              const f = typeFacets.find((x) => x.key === v)
              return f ? f.label : String(v)
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All act types</SelectItem>
          {typeFacets.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
              <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                · {f.count}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedLocation}
        onValueChange={(v) => v && push("location", v)}
      >
        <SelectTrigger className="h-8 rounded-full bg-white/80 border-slate-200 text-sm font-medium px-3 min-w-[180px] hover:bg-white">
          <SelectValue>
            {(v) => {
              if (v === "all" || !v) return "All locations"
              const f = locationFacets.find((x) => x.key === v)
              return f ? f.label : String(v)
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All locations</SelectItem>
          {locationFacets.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
              <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                · {f.count}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => {
            const sp = new URLSearchParams(searchParams)
            sp.delete("actType")
            sp.delete("location")
            router.push(`/submissions?${sp.toString()}`)
          }}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-4"
        >
          Clear {activeCount === 1 ? "refinement" : "refinements"}
        </button>
      )}
    </div>
  )
}
