"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { DOCUMENTS_BUCKET } from "./constants"

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

/**
 * Record metadata for a file that was just uploaded to Storage by the
 * browser client. Returns the new document row.
 */
export async function createDocument(input: {
  name: string
  file_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  category: string
  description: string
  submission_id?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const trimmedName = input.name.trim() || input.file_name
  const trimmedCategory = input.category.trim().toLowerCase() || "other"

  const { data, error } = await supabase
    .from("documents")
    .insert({
      name: trimmedName,
      file_name: input.file_name,
      storage_path: input.storage_path,
      mime_type: input.mime_type || "application/octet-stream",
      size_bytes: Math.max(0, Math.round(input.size_bytes)),
      category: trimmedCategory,
      description: input.description.trim(),
      uploaded_by: user.id,
      submission_id: input.submission_id ?? null,
    })
    .select("id")
    .single()

  if (error || !data) {
    // Metadata insert failed — the storage object is now orphaned. Try to
    // clean it up best-effort so we don't leak bytes.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([input.storage_path])
    return { ok: false, error: error?.message ?? "Failed to record document." }
  }

  revalidatePath("/documents")
  revalidatePath("/dashboard")
  if (input.submission_id) {
    revalidatePath(`/submissions/${input.submission_id}`)
    revalidatePath("/performers")
  }
  return { ok: true, data: { id: data.id } }
}

/** Update a document's display metadata (name, category, description). */
export async function updateDocument(
  id: string,
  patch: { name: string; category: string; description: string },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const name = patch.name.trim()
  if (!name) return { ok: false, error: "Name can't be empty." }
  const category = patch.category.trim().toLowerCase() || "other"

  const { error } = await supabase
    .from("documents")
    .update({ name, category, description: patch.description.trim() })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/documents")
  return { ok: true, data: null }
}

/** Hard-delete a document: remove the storage object and the metadata row. */
export async function deleteDocument(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path, submission_id")
    .eq("id", id)
    .single()

  if (fetchError || !doc) {
    return { ok: false, error: fetchError?.message ?? "Document not found." }
  }

  const { error: removeError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.storage_path])
  if (removeError) {
    return { ok: false, error: `Couldn't remove file: ${removeError.message}` }
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
  if (deleteError) return { ok: false, error: deleteError.message }

  revalidatePath("/documents")
  revalidatePath("/dashboard")
  if (doc.submission_id) {
    revalidatePath(`/submissions/${doc.submission_id}`)
    revalidatePath("/performers")
  }
  return { ok: true, data: null }
}

/**
 * Mint a short-lived signed URL for downloading a document. Called from
 * the client when the user clicks a filename.
 */
export async function getDownloadUrl(
  id: string,
): Promise<ActionResult<{ url: string; file_name: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path, file_name")
    .eq("id", id)
    .single()
  if (fetchError || !doc) {
    return { ok: false, error: fetchError?.message ?? "Document not found." }
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, 5 * 60, {
      download: doc.file_name,
    })
  if (signError || !signed) {
    return { ok: false, error: signError?.message ?? "Couldn't sign URL." }
  }

  return { ok: true, data: { url: signed.signedUrl, file_name: doc.file_name } }
}
