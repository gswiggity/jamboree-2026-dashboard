"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { TablesUpdate } from "@/lib/database.types"

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, admin: false as const }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  return { supabase, user, admin: profile?.role === "admin" }
}

async function requireAuthed() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createDraft(name: string): Promise<Result<{ id: string }>> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: "Name required." }
  const { supabase, user, admin } = await requireAdmin()
  if (!user) return { ok: false, error: "Not authenticated." }
  if (!admin) return { ok: false, error: "Admin only." }

  const { data, error } = await supabase
    .from("programming_drafts")
    .insert({ name: trimmed, created_by: user.id })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." }

  revalidatePath("/production")
  return { ok: true, data: { id: data.id } }
}

export async function updateDraftSettings(
  id: string,
  settings: {
    venues: string[]
    venue_colors: Record<string, string>
    window_start_time: string
    window_end_time: string
  },
): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const cleanedVenues = Array.from(
    new Set(settings.venues.map((v) => v.trim()).filter((v) => v.length > 0)),
  )

  const cleanedColors: Record<string, string> = {}
  for (const venue of cleanedVenues) {
    const raw = settings.venue_colors[venue]
    if (typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw)) {
      cleanedColors[venue] = raw.toLowerCase()
    }
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(settings.window_start_time)) {
    return { ok: false, error: "Invalid window start." }
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(settings.window_end_time)) {
    return { ok: false, error: "Invalid window end." }
  }
  if (settings.window_end_time <= settings.window_start_time) {
    return { ok: false, error: "Window end must be after start." }
  }

  const { error } = await supabase
    .from("programming_drafts")
    .update({
      venues: cleanedVenues,
      venue_colors: cleanedColors,
      window_start_time: settings.window_start_time,
      window_end_time: settings.window_end_time,
    })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  return { ok: true, data: null }
}

export async function renameDraft(id: string, name: string): Promise<Result> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: "Name required." }
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const { error } = await supabase
    .from("programming_drafts")
    .update({ name: trimmed })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  return { ok: true, data: null }
}

export async function duplicateDraft(id: string, newName: string): Promise<Result<{ id: string }>> {
  const { supabase, user, admin } = await requireAdmin()
  if (!user) return { ok: false, error: "Not authenticated." }
  if (!admin) return { ok: false, error: "Admin only." }
  const trimmed = newName.trim()
  if (!trimmed) return { ok: false, error: "Name required." }

  const { data: source } = await supabase
    .from("programming_drafts")
    .select("venues, venue_colors, window_start_time, window_end_time")
    .eq("id", id)
    .single()

  const { data: newDraft, error: insertErr } = await supabase
    .from("programming_drafts")
    .insert({
      name: trimmed,
      created_by: user.id,
      venues: source?.venues ?? [],
      venue_colors: source?.venue_colors ?? {},
      ...(source?.window_start_time
        ? { window_start_time: source.window_start_time }
        : {}),
      ...(source?.window_end_time
        ? { window_end_time: source.window_end_time }
        : {}),
    })
    .select("id")
    .single()
  if (insertErr || !newDraft) {
    return { ok: false, error: insertErr?.message ?? "Insert failed." }
  }

  const { data: blocks, error: blocksErr } = await supabase
    .from("show_blocks")
    .select("day, start_time, end_time, title, location, notes, id")
    .eq("draft_id", id)
  if (blocksErr) return { ok: false, error: blocksErr.message }

  if (blocks && blocks.length > 0) {
    const rows = blocks.map((b) => ({
      draft_id: newDraft.id,
      day: b.day,
      start_time: b.start_time,
      end_time: b.end_time,
      title: b.title,
      location: b.location,
      notes: b.notes,
    }))
    const { data: copied, error: copyErr } = await supabase
      .from("show_blocks")
      .insert(rows)
      .select("id, day, start_time, end_time, title, location, notes")
    if (copyErr || !copied) return { ok: false, error: copyErr?.message ?? "Copy blocks failed." }

    // Map old block -> new block so we can copy submission tags.
    const oldToNew = new Map<string, string>()
    for (const old of blocks) {
      const match = copied.find(
        (c) =>
          c.day === old.day &&
          c.start_time === old.start_time &&
          c.end_time === old.end_time &&
          (c.title ?? null) === (old.title ?? null) &&
          (c.location ?? null) === (old.location ?? null) &&
          (c.notes ?? null) === (old.notes ?? null),
      )
      if (match) oldToNew.set(old.id, match.id)
    }

    const oldIds = blocks.map((b) => b.id)
    const { data: tags } = await supabase
      .from("show_block_submissions")
      .select("block_id, submission_id")
      .in("block_id", oldIds)
    if (tags && tags.length > 0) {
      const tagRows = tags
        .map((t) => {
          const newBlockId = oldToNew.get(t.block_id)
          return newBlockId ? { block_id: newBlockId, submission_id: t.submission_id } : null
        })
        .filter((r): r is { block_id: string; submission_id: string } => r !== null)
      if (tagRows.length > 0) {
        await supabase.from("show_block_submissions").insert(tagRows)
      }
    }
  }

  revalidatePath("/production")
  return { ok: true, data: { id: newDraft.id } }
}

export async function deleteDraft(id: string): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const { error } = await supabase.from("programming_drafts").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  return { ok: true, data: null }
}

export async function publishDraft(id: string): Promise<Result> {
  const { supabase, user, admin } = await requireAdmin()
  if (!user) return { ok: false, error: "Not authenticated." }
  if (!admin) return { ok: false, error: "Admin only." }

  const { error: unpubErr } = await supabase
    .from("programming_drafts")
    .update({ is_published: false, published_at: null, published_by: null })
    .eq("is_published", true)
    .neq("id", id)
  if (unpubErr) return { ok: false, error: unpubErr.message }

  const { error } = await supabase
    .from("programming_drafts")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      published_by: user.id,
    })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  return { ok: true, data: null }
}

export async function unpublishDraft(id: string): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const { error } = await supabase
    .from("programming_drafts")
    .update({ is_published: false, published_at: null, published_by: null })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  return { ok: true, data: null }
}

export async function addBlockComment(
  blockId: string,
  body: string,
): Promise<Result<{ id: string }>> {
  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: "Comment cannot be empty." }
  const { supabase, user } = await requireAuthed()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { data, error } = await supabase
    .from("show_block_comments")
    .insert({ block_id: blockId, user_id: user.id, body: trimmed })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." }

  revalidatePath("/production")
  return { ok: true, data: { id: data.id } }
}

export async function deleteBlockComment(id: string): Promise<Result> {
  const { supabase, user } = await requireAuthed()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("show_block_comments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  return { ok: true, data: null }
}


type BlockInput = {
  draft_id: string
  day: string
  start_time: string
  end_time: string
  title: string | null
  location: string | null
  notes: string | null
  theme?: string | null
  host?: string | null
}

function validateBlock(b: BlockInput): string | null {
  if (!b.draft_id) return "Draft required."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.day)) return "Invalid day."
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(b.start_time)) return "Invalid start time."
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(b.end_time)) return "Invalid end time."
  if (b.end_time <= b.start_time) return "End must be after start."
  return null
}

export async function createBlock(input: BlockInput): Promise<Result<{ id: string }>> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }
  const err = validateBlock(input)
  if (err) return { ok: false, error: err }

  const { data, error } = await supabase
    .from("show_blocks")
    .insert({
      draft_id: input.draft_id,
      day: input.day,
      start_time: input.start_time,
      end_time: input.end_time,
      title: input.title?.trim() || null,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      theme: input.theme?.trim() || null,
      host: input.host?.trim() || null,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  return { ok: true, data: { id: data.id } }
}

export async function updateBlock(id: string, input: Omit<BlockInput, "draft_id">): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }
  const err = validateBlock({ ...input, draft_id: "x" })
  if (err) return { ok: false, error: err }

  const update: TablesUpdate<"show_blocks"> = {
    day: input.day,
    start_time: input.start_time,
    end_time: input.end_time,
    title: input.title?.trim() || null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
  }
  if (input.theme !== undefined) update.theme = input.theme?.trim() || null
  if (input.host !== undefined) update.host = input.host?.trim() || null

  const { error } = await supabase.from("show_blocks").update(update).eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  revalidatePath(`/production/programming/${id}`)
  return { ok: true, data: null }
}

export async function deleteBlock(id: string): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const { error } = await supabase.from("show_blocks").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  return { ok: true, data: null }
}

export async function setBlockSubmissions(
  blockId: string,
  submissionIds: string[],
): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const ids = Array.from(new Set(submissionIds))

  const { data: existing, error: readErr } = await supabase
    .from("show_block_submissions")
    .select("submission_id, position")
    .eq("block_id", blockId)
  if (readErr) return { ok: false, error: readErr.message }

  const have = new Set((existing ?? []).map((r) => r.submission_id))
  const want = new Set(ids)
  const toAdd = ids.filter((id) => !have.has(id))
  const toRemove = Array.from(have).filter((id) => !want.has(id))
  const maxPosition = (existing ?? []).reduce(
    (acc, r) => (r.position != null && r.position > acc ? r.position : acc),
    -1,
  )

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("show_block_submissions")
      .delete()
      .eq("block_id", blockId)
      .in("submission_id", toRemove)
    if (error) return { ok: false, error: error.message }
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map((submission_id, i) => ({
      block_id: blockId,
      submission_id,
      position: maxPosition + 1 + i,
    }))
    const { error } = await supabase.from("show_block_submissions").insert(rows)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  revalidatePath(`/production/programming/${blockId}`)
  return { ok: true, data: null }
}

// --- Programming deep-dive actions ---

export async function updateBlockProgramming(
  blockId: string,
  patch: {
    title?: string | null
    theme?: string | null
    host?: string | null
    kind?: "show" | "workshop" | "event"
  },
): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const update: TablesUpdate<"show_blocks"> = {}
  if (patch.title !== undefined) update.title = patch.title?.trim() || null
  if (patch.theme !== undefined) update.theme = patch.theme?.trim() || null
  if (patch.host !== undefined) update.host = patch.host?.trim() || null
  if (patch.kind !== undefined) {
    if (!["show", "workshop", "event"].includes(patch.kind)) {
      return { ok: false, error: "Invalid block kind." }
    }
    update.kind = patch.kind
  }
  if (Object.keys(update).length === 0) return { ok: true, data: null }

  // Switching to workshop: keep at most one tagged submission. Switching to
  // event: drop all tagged submissions (events are volunteer-driven).
  if (patch.kind === "workshop") {
    const { data: tags } = await supabase
      .from("show_block_submissions")
      .select("submission_id, position")
      .eq("block_id", blockId)
      .order("position", { ascending: true })
    if (tags && tags.length > 1) {
      const keep = tags[0].submission_id
      await supabase
        .from("show_block_submissions")
        .delete()
        .eq("block_id", blockId)
        .neq("submission_id", keep)
    }
  } else if (patch.kind === "event") {
    await supabase
      .from("show_block_submissions")
      .delete()
      .eq("block_id", blockId)
  }

  const { error } = await supabase.from("show_blocks").update(update).eq("id", blockId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  revalidatePath(`/production/programming/${blockId}`)
  return { ok: true, data: null }
}

export async function addActToBlock(
  blockId: string,
  submissionId: string,
): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const { data: existing, error: readErr } = await supabase
    .from("show_block_submissions")
    .select("submission_id, position")
    .eq("block_id", blockId)
  if (readErr) return { ok: false, error: readErr.message }
  if ((existing ?? []).some((r) => r.submission_id === submissionId)) {
    return { ok: true, data: null }
  }
  const maxPosition = (existing ?? []).reduce(
    (acc, r) => (r.position != null && r.position > acc ? r.position : acc),
    -1,
  )

  const { error } = await supabase.from("show_block_submissions").insert({
    block_id: blockId,
    submission_id: submissionId,
    position: maxPosition + 1,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  revalidatePath(`/production/programming/${blockId}`)
  return { ok: true, data: null }
}

export async function removeActFromBlock(
  blockId: string,
  submissionId: string,
): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const { error } = await supabase
    .from("show_block_submissions")
    .delete()
    .eq("block_id", blockId)
    .eq("submission_id", submissionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  revalidatePath(`/production/programming/${blockId}`)
  return { ok: true, data: null }
}

export async function setActDuration(
  blockId: string,
  submissionId: string,
  durationMinutes: number | null,
): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  const value =
    durationMinutes == null || Number.isNaN(durationMinutes)
      ? null
      : Math.max(0, Math.min(600, Math.round(durationMinutes)))

  const { error } = await supabase
    .from("show_block_submissions")
    .update({ duration_minutes: value })
    .eq("block_id", blockId)
    .eq("submission_id", submissionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  revalidatePath(`/production/programming/${blockId}`)
  return { ok: true, data: null }
}

export async function reorderBlockActs(
  blockId: string,
  orderedSubmissionIds: string[],
): Promise<Result> {
  const { supabase, admin } = await requireAdmin()
  if (!admin) return { ok: false, error: "Admin only." }

  for (let i = 0; i < orderedSubmissionIds.length; i++) {
    const { error } = await supabase
      .from("show_block_submissions")
      .update({ position: i })
      .eq("block_id", blockId)
      .eq("submission_id", orderedSubmissionIds[i])
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath("/production")
  revalidatePath("/production/programming")
  revalidatePath(`/production/programming/${blockId}`)
  return { ok: true, data: null }
}

