"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { normalizeRow, type SubmissionType } from "@/lib/csv"
import type { Json } from "@/lib/database.types"

type ImportResult =
  | {
      ok: true
      newRows: number
      updatedRows: number
      duplicatesInBatch: number
      importId: string
    }
  | { ok: false; error: string }

export async function importSubmissions(
  type: SubmissionType,
  fileName: string,
  rows: Record<string, unknown>[],
): Promise<ImportResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  if (!rows || rows.length === 0) {
    return { ok: false, error: "No rows to import." }
  }

  const normalizedRaw = await Promise.all(rows.map((r) => normalizeRow(type, r)))
  // Dedupe within the batch: Postgres rejects ON CONFLICT touching the same
  // conflict key twice in one statement. Last row wins on duplicates.
  const byId = new Map<string, (typeof normalizedRaw)[number]>()
  for (const n of normalizedRaw) byId.set(n.externalId, n)
  const normalized = Array.from(byId.values())
  const duplicatesInBatch = normalizedRaw.length - normalized.length
  const externalIds = normalized.map((n) => n.externalId)

  // Figure out which rows already exist to count new vs updated.
  const { data: existing, error: selectError } = await supabase
    .from("submissions")
    .select("external_id")
    .eq("type", type)
    .in("external_id", externalIds)

  if (selectError) {
    return { ok: false, error: selectError.message }
  }
  const existingSet = new Set((existing ?? []).map((r) => r.external_id))

  // Create the import row first so we can stamp source_import_id.
  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .insert({
      type,
      uploaded_by: user.id,
      file_name: fileName,
      row_count: rows.length,
      new_rows: 0,
      updated_rows: 0,
    })
    .select("id")
    .single()

  if (importError || !importRow) {
    return { ok: false, error: importError?.message ?? "Failed to record import." }
  }

  const payload = normalized.map((n) => ({
    type,
    external_id: n.externalId,
    name: n.name,
    email: n.email,
    submitted_at: n.submittedAt,
    data: n.data as Json,
    source_import_id: importRow.id,
  }))

  const { error: upsertError } = await supabase
    .from("submissions")
    .upsert(payload, { onConflict: "type,external_id" })

  if (upsertError) {
    return { ok: false, error: upsertError.message }
  }

  const updatedRows = externalIds.filter((id) => existingSet.has(id)).length
  const newRows = externalIds.length - updatedRows

  const { error: updateError } = await supabase
    .from("imports")
    .update({ new_rows: newRows, updated_rows: updatedRows })
    .eq("id", importRow.id)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  revalidatePath("/dashboard")
  revalidatePath("/submissions")
  revalidatePath("/analysis")

  return {
    ok: true,
    newRows,
    updatedRows,
    duplicatesInBatch,
    importId: importRow.id,
  }
}
