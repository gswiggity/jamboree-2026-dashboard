"use client"

import { useRef, useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Download,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  FileAudio,
  FileVideo,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  createDocument,
  deleteDocument,
  getDownloadUrl,
  updateDocument,
} from "./actions"
import { DOCUMENTS_BUCKET } from "./constants"

export type DocumentRow = {
  id: string
  name: string
  file_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  category: string
  description: string
  created_at: string
  updated_at: string
  uploader_name: string | null
  uploader_email: string | null
  // Short-lived signed URL for inline preview (images only). Null for
  // non-previewable types or if the sign call failed.
  preview_url: string | null
  // When the document is a performer photo (or any submission-linked file),
  // these surface a "linked to <act name>" badge so the documents view
  // doubles as a marketing-asset rolodex.
  submission_id: string | null
  submission_display_name: string | null
}

type ViewMode = "list" | "grid"
const VIEW_STORAGE_KEY = "documents-view"
const VIEW_CHANGE_EVENT = "documents-view-change"
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB — matches bucket limit

// —— localStorage-backed view preference, read via useSyncExternalStore so
// it survives reloads and stays consistent across tabs without tripping the
// project's set-state-in-effect lint rule.
function subscribeView(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("storage", callback)
  window.addEventListener(VIEW_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(VIEW_CHANGE_EVENT, callback)
  }
}
function getViewSnapshot(): ViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === "grid" || stored === "list") return stored
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return "list"
}
function getViewServerSnapshot(): ViewMode {
  return "list"
}
function writeView(next: ViewMode) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    window.dispatchEvent(new Event(VIEW_CHANGE_EVENT))
  } catch {
    // ignore
  }
}

export function DocumentsShell({
  documents,
  categories,
}: {
  documents: DocumentRow[]
  categories: string[]
}) {
  const [filter, setFilter] = useState<string>("all")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentRow | null>(null)
  // Server-rendered default is 'list'; after hydration this snaps to the
  // user's saved preference from localStorage (if any).
  const view = useSyncExternalStore(
    subscribeView,
    getViewSnapshot,
    getViewServerSnapshot,
  )

  const filtered =
    filter === "all"
      ? documents
      : documents.filter((d) => d.category === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoryFilter
          categories={categories}
          value={filter}
          onChange={setFilter}
          counts={countByCategory(documents)}
          total={documents.length}
        />
        <div className="flex items-center gap-2">
          <ViewToggle value={view} onChange={writeView} />
          <Button onClick={() => setUploadOpen(true)} size="sm">
            <Upload className="h-4 w-4 mr-1.5" />
            Upload document
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          hasAny={documents.length > 0}
          onUpload={() => setUploadOpen(true)}
        />
      ) : view === "grid" ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((doc) => (
            <DocumentTile
              key={doc.id}
              doc={doc}
              onEdit={() => setEditing(doc)}
            />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onEdit={() => setEditing(doc)}
            />
          ))}
        </ul>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        categories={categories}
      />

      <EditDialog
        doc={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (v: ViewMode) => void
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex rounded-full border border-slate-200/70 bg-white/60 p-0.5"
    >
      {(
        [
          { key: "list", label: "List", icon: ListIcon },
          { key: "grid", label: "Grid", icon: LayoutGrid },
        ] as const
      ).map(({ key, label, icon: Icon }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            title={`${label} view`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition",
              active
                ? "bg-blue-950 text-white"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function countByCategory(docs: DocumentRow[]) {
  const counts: Record<string, number> = {}
  for (const d of docs) counts[d.category] = (counts[d.category] ?? 0) + 1
  return counts
}

function CategoryFilter({
  categories,
  value,
  onChange,
  counts,
  total,
}: {
  categories: string[]
  value: string
  onChange: (v: string) => void
  counts: Record<string, number>
  total: number
}) {
  const chips = [
    { key: "all", label: "All", count: total },
    ...categories.map((c) => ({ key: c, label: c, count: counts[c] ?? 0 })),
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const active = c.key === value
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition capitalize",
              active
                ? "bg-blue-950 text-white"
                : "bg-white/60 border border-slate-200/70 text-slate-700 hover:bg-white",
            )}
          >
            <span>{c.label}</span>
            <span
              className={cn(
                "tabular-nums text-[10px]",
                active ? "text-white/70" : "text-slate-500",
              )}
            >
              {c.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function EmptyState({
  hasAny,
  onUpload,
}: {
  hasAny: boolean
  onUpload: () => void
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center">
      <FileText className="h-8 w-8 mx-auto text-slate-400" />
      <p className="text-sm text-slate-700 mt-3 font-medium">
        {hasAny ? "Nothing in this category yet." : "No documents yet."}
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {hasAny
          ? "Try a different filter or upload one."
          : "Upload your first shared asset to get started."}
      </p>
      {!hasAny && (
        <Button size="sm" className="mt-4" onClick={onUpload}>
          <Upload className="h-4 w-4 mr-1.5" />
          Upload document
        </Button>
      )}
    </div>
  )
}

function DocumentCard({
  doc,
  onEdit,
}: {
  doc: DocumentRow
  onEdit: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleDownload() {
    startTransition(async () => {
      const res = await getDownloadUrl(doc.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      // Navigate the browser to the signed URL so the download fires.
      window.location.href = res.data.url
    })
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete “${doc.name}”? This removes the file and can't be undone.`,
      )
    )
      return
    startTransition(async () => {
      const res = await deleteDocument(doc.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Deleted “${doc.name}”.`)
      router.refresh()
    })
  }

  const uploader = doc.uploader_name ?? doc.uploader_email ?? "unknown"

  return (
    <li className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-4 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] transition hover:bg-white/80">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-xl bg-slate-100 text-slate-700 p-2.5">
          <MimeIcon mime={doc.mime_type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={handleDownload}
                disabled={pending}
                className="text-left font-semibold text-slate-900 hover:text-[#2340d9] hover:underline disabled:opacity-50 truncate block max-w-full"
                title={`Download ${doc.file_name}`}
              >
                {doc.name}
              </button>
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {doc.file_name}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDownload}
                disabled={pending}
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="sr-only">Download</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                disabled={pending}
                title="Edit metadata"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDelete}
                disabled={pending}
                title="Delete"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>

          {doc.description && (
            <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
              {doc.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 capitalize">
              {doc.category}
            </span>
            {doc.submission_id && doc.submission_display_name && (
              <a
                href={`/submissions/${doc.submission_id}`}
                className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-900 border border-violet-100 px-2 py-0.5 font-medium hover:bg-violet-100 transition"
                title="Open the submission this is linked to"
              >
                Linked: {doc.submission_display_name}
              </a>
            )}
            <span className="tabular-nums">{formatBytes(doc.size_bytes)}</span>
            <span>· uploaded by {uploader}</span>
            <span>· {new Date(doc.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </li>
  )
}

function DocumentTile({
  doc,
  onEdit,
}: {
  doc: DocumentRow
  onEdit: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [previewBroken, setPreviewBroken] = useState(false)

  function handleDownload() {
    startTransition(async () => {
      const res = await getDownloadUrl(doc.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      window.location.href = res.data.url
    })
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete “${doc.name}”? This removes the file and can't be undone.`,
      )
    )
      return
    startTransition(async () => {
      const res = await deleteDocument(doc.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Deleted “${doc.name}”.`)
      router.refresh()
    })
  }

  const hasImagePreview =
    doc.preview_url && doc.mime_type.startsWith("image/") && !previewBroken

  return (
    <li className="group relative rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl overflow-hidden shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] transition hover:bg-white/80 flex flex-col">
      <button
        type="button"
        onClick={handleDownload}
        disabled={pending}
        className="relative block aspect-[4/3] w-full bg-slate-100 overflow-hidden disabled:opacity-60"
        title={`Download ${doc.file_name}`}
      >
        {hasImagePreview ? (
          // Storage serves the signed URL — plain <img> is fine here and
          // avoids needing to configure next/image remote patterns for a
          // URL that changes every page load.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.preview_url!}
            alt={doc.name}
            className="h-full w-full object-cover"
            onError={() => setPreviewBroken(true)}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-400">
            <div className="[&_svg]:h-10 [&_svg]:w-10">
              <MimeIcon mime={doc.mime_type} />
            </div>
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-slate-700 capitalize shadow-sm">
          {doc.category}
        </span>
      </button>

      <div className="p-3 flex-1 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={pending}
            className="text-left text-sm font-semibold text-slate-900 hover:text-[#2340d9] hover:underline disabled:opacity-50 truncate flex-1"
            title={`Download ${doc.file_name}`}
          >
            {doc.name}
          </button>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDownload}
              disabled={pending}
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="sr-only">Download</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              disabled={pending}
              title="Edit metadata"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              disabled={pending}
              title="Delete"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
        <div className="text-xs text-slate-500 truncate" title={doc.file_name}>
          {doc.file_name}
        </div>
        {doc.submission_id && doc.submission_display_name && (
          <a
            href={`/submissions/${doc.submission_id}`}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-900 border border-violet-100 px-2 py-0.5 text-[10px] font-semibold hover:bg-violet-100 transition w-fit max-w-full truncate"
            title={`Linked to ${doc.submission_display_name}`}
          >
            <span className="truncate">Linked: {doc.submission_display_name}</span>
          </a>
        )}
        <div className="mt-auto pt-2 text-xs text-slate-500 flex items-center justify-between gap-2">
          <span className="tabular-nums">{formatBytes(doc.size_bytes)}</span>
          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </li>
  )
}

function MimeIcon({ mime }: { mime: string }) {
  const cls = "h-5 w-5"
  if (mime.startsWith("image/")) return <ImageIcon className={cls} />
  if (mime.startsWith("audio/")) return <FileAudio className={cls} />
  if (mime.startsWith("video/")) return <FileVideo className={cls} />
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv"
  )
    return <FileSpreadsheet className={cls} />
  if (mime.includes("zip") || mime.includes("compressed"))
    return <FileArchive className={cls} />
  return <FileText className={cls} />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// ——————————————————————————————————————————————————————————
// Upload dialog
// ——————————————————————————————————————————————————————————

function UploadDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean
  onClose: () => void
  categories: string[]
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState(categories[0] ?? "other")
  const [description, setDescription] = useState("")
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setName("")
    setCategory(categories[0] ?? "other")
    setDescription("")
    setDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleClose() {
    if (uploading) return
    reset()
    onClose()
  }

  function pickFile(next: File) {
    if (next.size > MAX_FILE_SIZE) {
      toast.error(
        `File is too big (${formatBytes(
          next.size,
        )}). The limit is ${formatBytes(MAX_FILE_SIZE)}.`,
      )
      return
    }
    setFile(next)
    if (!name.trim()) {
      // Strip the extension for a friendlier default display name.
      const dot = next.name.lastIndexOf(".")
      setName(dot > 0 ? next.name.slice(0, dot) : next.name)
    }
  }

  async function handleUpload() {
    if (!file) {
      toast.error("Pick a file first.")
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const storagePath = makeStoragePath(file.name)
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        })
      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`)
        return
      }

      const res = await createDocument({
        name: name.trim() || file.name,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        category: category.trim() || "other",
        description: description.trim(),
      })

      if (!res.ok) {
        toast.error(res.error)
        return
      }

      toast.success(`Uploaded “${name.trim() || file.name}”.`)
      reset()
      onClose()
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const dropped = e.dataTransfer.files?.[0]
              if (dropped) pickFile(dropped)
            }}
            className={cn(
              "rounded-xl border-2 border-dashed transition p-5 text-center",
              dragging
                ? "border-[#2340d9] bg-blue-50/60"
                : "border-slate-300 bg-white/40",
            )}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-slate-600 shrink-0" />
                <div className="min-w-0 text-left">
                  <div className="font-medium text-slate-900 truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatBytes(file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-slate-500 hover:text-slate-700 shrink-0"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto text-slate-400" />
                <p className="text-sm text-slate-700 mt-2">
                  Drag a file here or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#2340d9] font-medium hover:underline"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Up to {formatBytes(MAX_FILE_SIZE)} · any file type
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const next = e.target.files?.[0]
                if (next) pickFile(next)
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div className="space-y-1">
              <Label htmlFor="doc-name" className="text-xs text-slate-600">
                Display name
              </Label>
              <Input
                id="doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Venue agreement — Fringe Arts"
                disabled={uploading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-category" className="text-xs text-slate-600">
                Category
              </Label>
              <CategoryCombobox
                id="doc-category"
                value={category}
                onChange={setCategory}
                options={categories}
                disabled={uploading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="doc-desc" className="text-xs text-slate-600">
              Description{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="doc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this is, when it was signed, anything worth knowing."
              rows={3}
              disabled={uploading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || !file}
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ——————————————————————————————————————————————————————————
// Edit dialog
// ——————————————————————————————————————————————————————————

function EditDialog({
  doc,
  categories,
  onClose,
}: {
  doc: DocumentRow | null
  categories: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [pending, startTransition] = useTransition()

  // Sync form state when a new document opens. Keyed re-creation happens via
  // the `doc?.id` dependency on the Dialog's lifecycle, but we also snap the
  // values explicitly so stale state never leaks across edits.
  const currentId = doc?.id
  const [lastId, setLastId] = useState<string | null>(null)
  if (doc && currentId !== lastId) {
    setLastId(currentId ?? null)
    setName(doc.name)
    setCategory(doc.category)
    setDescription(doc.description)
  }

  function handleSave() {
    if (!doc) return
    startTransition(async () => {
      const res = await updateDocument(doc.id, {
        name,
        category,
        description,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Saved “${name.trim()}”.`)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={doc !== null}
      onOpenChange={(v) => {
        if (!v && !pending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
        </DialogHeader>
        {doc && (
          <div className="space-y-4">
            <div className="text-xs text-slate-500">
              File: <span className="font-mono text-slate-700">{doc.file_name}</span>
              {" · "}
              {formatBytes(doc.size_bytes)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor="edit-doc-name"
                  className="text-xs text-slate-600"
                >
                  Display name
                </Label>
                <Input
                  id="edit-doc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="edit-doc-category"
                  className="text-xs text-slate-600"
                >
                  Category
                </Label>
                <CategoryCombobox
                  id="edit-doc-category"
                  value={category}
                  onChange={setCategory}
                  options={categories}
                  disabled={pending}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="edit-doc-desc"
                className="text-xs text-slate-600"
              >
                Description
              </Label>
              <Textarea
                id="edit-doc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={pending}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ——————————————————————————————————————————————————————————
// Category combobox — pick from existing, or type a new one.
// ——————————————————————————————————————————————————————————

function CategoryCombobox({
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  options: string[]
  disabled?: boolean
}) {
  const [custom, setCustom] = useState(!options.includes(value))

  if (custom) {
    return (
      <div className="flex gap-1">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder="new category"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setCustom(false)
            onChange(options[0] ?? "other")
          }}
          disabled={disabled}
          title="Pick from list instead"
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Pick from list</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-1">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 capitalize"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setCustom(true)
          onChange("")
        }}
        disabled={disabled}
        title="Add new category"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="sr-only">Add new category</span>
      </Button>
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Storage path — timestamp + random + original filename. Keeps uploads
// uniquely addressable and human-readable when inspecting the bucket.
// ——————————————————————————————————————————————————————————

function makeStoragePath(filename: string): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const rand = Math.random().toString(36).slice(2, 10)
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_")
  return `${y}/${m}/${now.getTime()}-${rand}-${safe}`
}
