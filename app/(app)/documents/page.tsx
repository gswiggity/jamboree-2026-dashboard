import { createClient } from "@/lib/supabase/server"
import { getActDisplayName } from "@/lib/solo-act"
import { DocumentsShell, type DocumentRow } from "./documents-shell"
import { DOCUMENTS_BUCKET } from "./constants"

// Starter categories — users can add free-form categories on upload.
const STARTER_CATEGORIES = [
  "agreement",
  "marketing",
  "invoice",
  "logistics",
  "performer-photo",
  "other",
]

// Signed preview URLs live long enough that the user can flip between
// grid/list and scroll around without stale 403s. One hour is plenty; the
// URL is re-minted on every page load since this is a Server Component.
const PREVIEW_TTL_SECONDS = 60 * 60

function isPreviewable(mime: string): boolean {
  return mime.startsWith("image/")
}

export default async function DocumentsPage() {
  const supabase = await createClient()

  const [{ data: documents }, { data: profiles }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, name, file_name, storage_path, mime_type, size_bytes, category, description, uploaded_by, submission_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email"),
  ])

  // Fetch the submissions referenced by any documents so we can show a
  // "linked to: <act name>" badge with the substituted display name.
  const submissionIds = Array.from(
    new Set(
      (documents ?? [])
        .map((d) => d.submission_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const { data: linkedSubs } =
    submissionIds.length > 0
      ? await supabase
          .from("submissions")
          .select("id, type, name, data")
          .in("id", submissionIds)
      : { data: [] as Array<{ id: string; type: string; name: string | null; data: unknown }> }
  const submissionById = new Map(
    (linkedSubs ?? []).map((s) => {
      const display =
        s.type === "act"
          ? getActDisplayName({
              name: s.name,
              data: (s.data as Record<string, unknown> | null) ?? null,
            }).display
          : s.name ?? "(untitled)"
      return [s.id, { id: s.id, type: s.type, displayName: display }] as const
    }),
  )

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { name: p.full_name, email: p.email } as { name: string | null; email: string },
    ]),
  )

  // Batch-sign preview URLs for image documents so the grid view can render
  // thumbnails without any client round-trip. Non-images just get the icon.
  const previewPaths = (documents ?? [])
    .filter((d) => isPreviewable(d.mime_type))
    .map((d) => d.storage_path)
  const previewByPath = new Map<string, string>()
  if (previewPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrls(previewPaths, PREVIEW_TTL_SECONDS)
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) previewByPath.set(s.path, s.signedUrl)
    }
  }

  const rows: DocumentRow[] = (documents ?? []).map((d) => {
    const uploader = d.uploaded_by ? profileById.get(d.uploaded_by) : null
    const linked = d.submission_id ? submissionById.get(d.submission_id) : null
    return {
      id: d.id,
      name: d.name,
      file_name: d.file_name,
      storage_path: d.storage_path,
      mime_type: d.mime_type,
      size_bytes: d.size_bytes,
      category: d.category,
      description: d.description,
      created_at: d.created_at,
      updated_at: d.updated_at,
      uploader_name: uploader?.name ?? null,
      uploader_email: uploader?.email ?? null,
      preview_url: previewByPath.get(d.storage_path) ?? null,
      submission_id: d.submission_id ?? null,
      submission_display_name: linked?.displayName ?? null,
    }
  })

  const existingCategories = Array.from(
    new Set(rows.map((r) => r.category).filter(Boolean)),
  )
  const categories = Array.from(
    new Set([...STARTER_CATEGORIES, ...existingCategories]),
  ).sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Shared assets for the team — contracts, agreements, marketing files,
          invoices, and anything else worth one source of truth.
        </p>
      </div>

      <DocumentsShell documents={rows} categories={categories} />
    </div>
  )
}
