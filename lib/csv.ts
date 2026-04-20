export type SubmissionType = "act" | "volunteer" | "workshop"

export const SUBMISSION_TYPES: SubmissionType[] = ["act", "volunteer", "workshop"]

export const TYPE_LABELS: Record<SubmissionType, string> = {
  act: "Acts",
  volunteer: "Volunteers",
  workshop: "Workshops",
}

// Squarespace column mappings differ per submission type. Acts has a quirky
// "Primary Contact 11" for name and "Primary Contact" for email (yes, really).
type FieldMap = {
  name: string[]
  email: string[]
  submittedAt: string[]
  displayTitle?: string[]
}

export const FIELD_MAPS: Record<SubmissionType, FieldMap> = {
  act: {
    name: ["Primary Contact 11", "Primary Contact Name", "Name"],
    email: ["Primary Contact", "Email"],
    submittedAt: ["Submitted On", "Submission Date"],
    displayTitle: ["Group Name"],
  },
  volunteer: {
    name: ["Name"],
    email: ["Email"],
    submittedAt: ["Submitted On", "Submission Date"],
  },
  workshop: {
    name: ["Name"],
    email: ["Email"],
    submittedAt: ["Submitted On", "Submission Date"],
    displayTitle: ["Workshop Title"],
  },
}

function pickFirst(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim()
    }
  }
  return null
}

export function parseSubmittedAt(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  // Formats observed: "1/15/2026" (acts), "01/15/2026 21:49:37" (vol/workshop)
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d.toISOString()
  return null
}

export async function computeExternalId(
  email: string | null,
  submittedAt: string | null,
  name: string | null,
  row: Record<string, unknown>,
): Promise<string> {
  // Prefer a stable natural key with enough specificity to distinguish two
  // submissions from the same email on the same day (acts only have
  // date-granular timestamps). Fall back to a full row hash.
  const basis =
    email && submittedAt
      ? `${email.toLowerCase()}|${submittedAt}|${(name ?? "").toLowerCase().trim()}`
      : JSON.stringify(
          Object.keys(row)
            .sort()
            .reduce<Record<string, unknown>>((acc, k) => {
              acc[k] = row[k]
              return acc
            }, {}),
        )
  const bytes = new TextEncoder().encode(basis)
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export type NormalizedRow = {
  externalId: string
  name: string | null
  email: string | null
  submittedAt: string | null
  data: Record<string, unknown>
}

export async function normalizeRow(
  type: SubmissionType,
  row: Record<string, unknown>,
): Promise<NormalizedRow> {
  const map = FIELD_MAPS[type]
  const rawName = pickFirst(row, map.name)
  const displayTitle = map.displayTitle ? pickFirst(row, map.displayTitle) : null
  const name = displayTitle ?? rawName
  const emailRaw = pickFirst(row, map.email)
  const email = emailRaw?.toLowerCase() ?? null
  const submittedAt = parseSubmittedAt(pickFirst(row, map.submittedAt))
  const externalId = await computeExternalId(email, submittedAt, name, row)
  return { externalId, name, email, submittedAt, data: row }
}
