// Shared types for the Volunteers pillar. Kept separate from `actions.ts`
// because `"use server"` files only allow async function exports.

export type RoleRow = {
  key: string
  label: string
  sort_order: number
}

export type ShiftRow = {
  id: string
  role_key: string
  day: string // YYYY-MM-DD
  start_time: string // HH:mm:ss
  end_time: string // HH:mm:ss
  required_count: number
  location: string
  notes: string
}

export type AssignmentRow = {
  shift_id: string
  volunteer_id: string
}

export type VolunteerRow = {
  id: string
  name: string | null
  email: string | null
}
