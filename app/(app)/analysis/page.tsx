import { createClient } from "@/lib/supabase/server"
import { SUBMISSION_TYPES, TYPE_LABELS, type SubmissionType } from "@/lib/csv"
import { getActDisplayName } from "@/lib/solo-act"
import {
  overviewTimeline,
  summarizeActs,
  summarizeVolunteers,
  summarizeWorkshops,
  type SubmissionRow,
} from "@/lib/analysis"
import { AnalysisTabs } from "./analysis-tabs"

export default async function AnalysisPage() {
  const supabase = await createClient()

  const [{ data: submissions }, { data: counts }] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, type, name, email, submitted_at, created_at, data")
      .is("deleted_at", null),
    supabase
      .from("submission_verdict_counts")
      .select("submission_id, type, yes_count, no_count, maybe_count, total_judgments"),
  ])

  const rows = (submissions ?? []).map((s) => {
    const data = (s.data ?? {}) as Record<string, unknown>
    const displayName =
      s.type === "act"
        ? getActDisplayName({ name: s.name, data, email: s.email }).display
        : s.name
    return {
      id: s.id,
      type: s.type as SubmissionType,
      name: displayName,
      email: s.email,
      submitted_at: s.submitted_at,
      created_at: s.created_at,
      data,
    }
  }) as SubmissionRow[]

  const totalByType = SUBMISSION_TYPES.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    count: rows.filter((r) => r.type === type).length,
  }))

  const timeline = overviewTimeline(rows)

  const verdictBreakdown = SUBMISSION_TYPES.map((type) => {
    const forType = (counts ?? []).filter((c) => c.type === type)
    const totalSubs = rows.filter((r) => r.type === type).length
    let yes = 0
    let no = 0
    let maybe = 0
    let judged = 0
    for (const row of forType) {
      yes += row.yes_count ?? 0
      no += row.no_count ?? 0
      maybe += row.maybe_count ?? 0
      if ((row.total_judgments ?? 0) > 0) judged++
    }
    return {
      type: TYPE_LABELS[type],
      Yes: yes,
      Maybe: maybe,
      No: no,
      Unjudged: Math.max(totalSubs - judged, 0),
    }
  })

  const actSummary = summarizeActs(rows)
  const volunteerSummary = summarizeVolunteers(rows)
  const workshopSummary = summarizeWorkshops(rows)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aggregate view. Team verdict totals; no per-user breakdowns.
        </p>
      </div>

      <AnalysisTabs
        totalByType={totalByType}
        timeline={timeline}
        verdictBreakdown={verdictBreakdown}
        actSummary={actSummary}
        volunteerSummary={volunteerSummary}
        workshopSummary={workshopSummary}
      />
    </div>
  )
}
