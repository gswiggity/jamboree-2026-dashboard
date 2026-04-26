import { createClient } from "@/lib/supabase/server"
import {
  aggregatePerformers,
  type SubmissionLite,
} from "@/lib/performers"
import { PerformerList, type JudgmentRow, type VerdictCountRow } from "./performer-list"

export const metadata = {
  title: "Performers · Jamboree",
}

export default async function PerformersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Pull all act + workshop submissions. Volunteers are excluded — this
  // view is about people on stage or in front of a class.
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, type, name, email, submitted_at, data")
    .in("type", ["act", "workshop"])
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false, nullsFirst: false })

  const subs: SubmissionLite[] = (submissions ?? []).map((s) => ({
    id: s.id,
    type: s.type as SubmissionLite["type"],
    name: s.name,
    email: s.email,
    submitted_at: s.submitted_at,
    data: (s.data as Record<string, unknown> | null) ?? null,
  }))

  const performers = aggregatePerformers(subs)
  const submissionIds = subs.map((s) => s.id)

  const [{ data: myJudgments }, { data: counts }] = await Promise.all([
    submissionIds.length > 0
      ? supabase
          .from("judgments")
          .select("submission_id, verdict, notes")
          .eq("user_id", user!.id)
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as JudgmentRow[] }),
    submissionIds.length > 0
      ? supabase
          .from("submission_verdict_counts")
          .select("submission_id, yes_count, no_count, maybe_count, total_judgments")
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as VerdictCountRow[] }),
  ])

  return (
    <PerformerList
      performers={performers}
      myJudgments={(myJudgments ?? []) as JudgmentRow[]}
      verdictCounts={(counts ?? []) as VerdictCountRow[]}
    />
  )
}
