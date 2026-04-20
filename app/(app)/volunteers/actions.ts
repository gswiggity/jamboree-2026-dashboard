"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** Turn a label like "Tech Assist 2" into a slug "tech-assist-2". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

// ————————————————————————————————————————————————————————————
// Roles
// ————————————————————————————————————————————————————————————

/** Create a new volunteer role. Key is derived from label. */
export async function createVolunteerRole(input: {
  label: string
  sort_order?: number
}): Promise<ActionResult<{ key: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const label = input.label.trim()
  if (!label) return { ok: false, error: "Label can't be empty." }
  const key = slugify(label)
  if (!key) {
    return {
      ok: false,
      error: "Label needs at least one letter or number.",
    }
  }

  const { error } = await supabase.from("volunteer_roles").insert({
    key,
    label,
    sort_order: input.sort_order ?? 100,
  })

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A role called "${label}" already exists.` }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/volunteers")
  return { ok: true, data: { key } }
}

/** Update a role's label / sort_order. Key stays fixed. */
export async function updateVolunteerRole(
  key: string,
  patch: { label?: string; sort_order?: number },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const update: { label?: string; sort_order?: number } = {}
  if (patch.label !== undefined) {
    const label = patch.label.trim()
    if (!label) return { ok: false, error: "Label can't be empty." }
    update.label = label
  }
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order

  if (Object.keys(update).length === 0) return { ok: true, data: null }

  const { error } = await supabase
    .from("volunteer_roles")
    .update(update)
    .eq("key", key)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/volunteers")
  return { ok: true, data: null }
}

/** Delete a role. Fails if any shifts still reference it (on delete restrict). */
export async function deleteVolunteerRole(
  key: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("volunteer_roles")
    .delete()
    .eq("key", key)

  if (error) {
    // 23503 = foreign_key_violation. Friendlier message.
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This role is in use by one or more shifts. Reassign or delete those shifts first.",
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/volunteers")
  return { ok: true, data: null }
}

// ————————————————————————————————————————————————————————————
// Shifts
// ————————————————————————————————————————————————————————————

type ShiftInput = {
  role_key: string
  day: string // YYYY-MM-DD
  start_time: string // HH:mm
  end_time: string // HH:mm
  required_count: number
  location: string
  notes: string
}

function validateShift(input: ShiftInput): string | null {
  if (!input.role_key) return "Pick a role."
  if (!input.day) return "Pick a day."
  if (!input.start_time || !input.end_time) return "Start and end times required."
  if (input.end_time <= input.start_time) {
    return "End time must be after start time."
  }
  if (!Number.isFinite(input.required_count) || input.required_count < 1) {
    return "Need at least 1 volunteer."
  }
  return null
}

/** Create a shift. */
export async function createShift(
  input: ShiftInput,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateShift(input)
  if (err) return { ok: false, error: err }

  const { data, error } = await supabase
    .from("volunteer_shifts")
    .insert({
      role_key: input.role_key,
      day: input.day,
      start_time: input.start_time,
      end_time: input.end_time,
      required_count: input.required_count,
      location: input.location.trim(),
      notes: input.notes.trim(),
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create shift." }
  }

  revalidatePath("/volunteers")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: data.id } }
}

/** Update an existing shift. */
export async function updateShift(
  id: string,
  input: ShiftInput,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateShift(input)
  if (err) return { ok: false, error: err }

  const { error } = await supabase
    .from("volunteer_shifts")
    .update({
      role_key: input.role_key,
      day: input.day,
      start_time: input.start_time,
      end_time: input.end_time,
      required_count: input.required_count,
      location: input.location.trim(),
      notes: input.notes.trim(),
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/volunteers")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

/** Delete a shift (cascades assignments). */
export async function deleteShift(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("volunteer_shifts")
    .delete()
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/volunteers")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

// ————————————————————————————————————————————————————————————
// Assignments
// ————————————————————————————————————————————————————————————

/**
 * Replace the full assignment set for a shift with the provided list.
 * Simpler UX than delta-tracking add/remove buttons. Uses a delete-then-insert
 * approach; for a 3-person team on a small shift count this is fine.
 */
export async function setShiftAssignments(
  shiftId: string,
  volunteerIds: string[],
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  // Dedupe while preserving order.
  const unique = Array.from(new Set(volunteerIds.filter(Boolean)))

  const { error: delError } = await supabase
    .from("volunteer_shift_assignments")
    .delete()
    .eq("shift_id", shiftId)
  if (delError) return { ok: false, error: delError.message }

  if (unique.length > 0) {
    const { error: insError } = await supabase
      .from("volunteer_shift_assignments")
      .insert(
        unique.map((volunteer_id) => ({
          shift_id: shiftId,
          volunteer_id,
          assigned_by: user.id,
        })),
      )
    if (insError) return { ok: false, error: insError.message }
  }

  revalidatePath("/volunteers")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

/** Remove a single volunteer from a shift. */
export async function removeAssignment(
  shiftId: string,
  volunteerId: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("volunteer_shift_assignments")
    .delete()
    .eq("shift_id", shiftId)
    .eq("volunteer_id", volunteerId)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/volunteers")
  return { ok: true, data: null }
}
