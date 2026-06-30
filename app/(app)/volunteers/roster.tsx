"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { DayPart, VolunteerAvailability } from "@/lib/volunteer-availability"
import { DAY_PARTS } from "@/lib/volunteer-availability"
import type { RoleRow, VolunteerRow } from "./types"

// Festival days the sign-up form offers. Tue/Wed are setup/load-in days that
// have no programmed shows but volunteers can still mark availability for.
const FESTIVAL_DAYS: { date: string; label: string; sub?: string }[] = [
  { date: "2026-07-07", label: "Tue 7", sub: "Setup" },
  { date: "2026-07-08", label: "Wed 8", sub: "Setup" },
  { date: "2026-07-09", label: "Thu 9" },
  { date: "2026-07-10", label: "Fri 10" },
  { date: "2026-07-11", label: "Sat 11" },
  { date: "2026-07-12", label: "Sun 12" },
]

const PART_LETTER: Record<DayPart, string> = {
  morning: "M",
  afternoon: "A",
  evening: "E",
}

export function Roster({
  volunteers,
  availability,
  rolesByKey,
}: {
  volunteers: VolunteerRow[]
  availability: Record<string, VolunteerAvailability>
  rolesByKey: Map<string, RoleRow>
}) {
  const rows = useMemo(
    () =>
      volunteers.map((v) => ({
        v,
        av: availability[v.id] ?? null,
      })),
    [volunteers, availability],
  )

  if (volunteers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center">
        <p className="text-sm text-slate-700 font-medium">
          No volunteers in the pool yet.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Import a volunteer CSV on the Upload page to populate the roster.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold text-slate-700">
          Volunteer availability
          <span className="ml-2 text-slate-400 font-normal tabular-nums">
            {volunteers.length}
          </span>
        </h2>
        <span className="text-[10px] text-slate-500">
          <span className="font-semibold">M</span>orning ·{" "}
          <span className="font-semibold">A</span>fternoon ·{" "}
          <span className="font-semibold">E</span>vening
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200/70">
              <th className="sticky left-0 bg-white/80 backdrop-blur-xl px-3 py-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 min-w-[12rem]">
                Volunteer
              </th>
              {FESTIVAL_DAYS.map((d) => (
                <th
                  key={d.date}
                  className="px-2 py-2 text-center text-[11px] font-semibold text-slate-600 whitespace-nowrap"
                >
                  {d.label}
                  {d.sub && (
                    <span className="block text-[9px] font-normal text-slate-400 uppercase tracking-wide">
                      {d.sub}
                    </span>
                  )}
                </th>
              ))}
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 min-w-[14rem]">
                Roles &amp; notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50">
            {rows.map(({ v, av }) => {
              const name = v.name ?? v.email?.split("@")[0] ?? "Unknown"
              return (
                <tr key={v.id} className="align-top hover:bg-white/50">
                  <td className="sticky left-0 bg-white/70 backdrop-blur-xl px-3 py-2.5">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {name}
                    </div>
                    {v.email && (
                      <div className="text-[11px] text-slate-500 truncate">
                        {v.email}
                      </div>
                    )}
                  </td>
                  {FESTIVAL_DAYS.map((d) => (
                    <td key={d.date} className="px-2 py-2.5 text-center">
                      <DayCell av={av} date={d.date} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <RoleInterests av={av} rolesByKey={rolesByKey} />
                    {av?.note && (
                      <p className="mt-1 text-[11px] text-slate-500 whitespace-pre-wrap">
                        {av.note}
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DayCell({
  av,
  date,
}: {
  av: VolunteerAvailability | null
  date: string
}) {
  const available = av?.days.includes(date) ?? false
  if (!available) {
    return <span className="text-slate-300" aria-hidden>·</span>
  }
  // No time preference given → available any part.
  const anyTime = !av || av.parts.length === 0
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 border border-emerald-100 px-1.5 py-1">
      {DAY_PARTS.map((p) => {
        const on = anyTime || av!.parts.includes(p)
        return (
          <span
            key={p}
            className={cn(
              "text-[10px] font-semibold tabular-nums w-3 text-center",
              on ? "text-emerald-700" : "text-emerald-200",
            )}
          >
            {PART_LETTER[p]}
          </span>
        )
      })}
    </div>
  )
}

function RoleInterests({
  av,
  rolesByKey,
}: {
  av: VolunteerAvailability | null
  rolesByKey: Map<string, RoleRow>
}) {
  if (!av) return <span className="text-[11px] text-slate-400">—</span>
  if (av.flexibleRole && av.roleKeys.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        Wherever needed
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {av.flexibleRole && (
        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-800">
          Flexible
        </span>
      )}
      {av.roleKeys.map((key) => (
        <span
          key={key}
          className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 max-w-[10rem] truncate"
          title={rolesByKey.get(key)?.label ?? key}
        >
          {rolesByKey.get(key)?.label ?? key}
        </span>
      ))}
      {!av.flexibleRole && av.roleKeys.length === 0 && (
        <span className="text-[11px] text-slate-400">—</span>
      )}
    </div>
  )
}
