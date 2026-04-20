"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  publishDraft,
  renameDraft,
  unpublishDraft,
} from "./actions"
import { ScheduleCanvas, type Block, type EligibleSubmission } from "./schedule-canvas"
import { DraftSettingsDialog } from "./draft-settings"
import type { BlockComment } from "./block-comments"

type Draft = {
  id: string
  name: string
  is_published: boolean
  published_at: string | null
  updated_at: string
  created_at: string
  created_by: string | null
  venues: string[]
  venue_colors: Record<string, string>
  window_start_time: string
  window_end_time: string
}

export function DraftsShell({
  drafts,
  selectedDraft,
  blocks,
  eligibleSubmissions,
  tagsByBlock,
  commentsByBlock,
  currentUserId,
}: {
  drafts: Draft[]
  selectedDraft: Draft | null
  blocks: Block[]
  eligibleSubmissions: EligibleSubmission[]
  tagsByBlock: Record<string, string[]>
  commentsByBlock: Record<string, BlockComment[]>
  currentUserId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [newName, setNewName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(selectedDraft?.name ?? "")
  const [settingsOpen, setSettingsOpen] = useState(false)

  function selectDraft(id: string) {
    const params = new URLSearchParams(searchParams)
    params.set("draft", id)
    router.push(`/production?${params.toString()}`)
  }

  function onCreate() {
    if (!newName.trim()) return
    startTransition(async () => {
      const result = await createDraft(newName)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Draft created.")
      setNewName("")
      selectDraft(result.data.id)
      router.refresh()
    })
  }

  function onRenameSubmit() {
    if (!selectedDraft) return
    const next = renameValue.trim()
    if (!next || next === selectedDraft.name) {
      setRenaming(false)
      return
    }
    startTransition(async () => {
      const result = await renameDraft(selectedDraft.id, next)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Renamed.")
      setRenaming(false)
      router.refresh()
    })
  }

  function onDuplicate() {
    if (!selectedDraft) return
    startTransition(async () => {
      const result = await duplicateDraft(
        selectedDraft.id,
        `${selectedDraft.name} (copy)`,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Duplicated.")
      selectDraft(result.data.id)
      router.refresh()
    })
  }

  function onDelete() {
    if (!selectedDraft) return
    if (selectedDraft.is_published) {
      toast.error("Unpublish before deleting.")
      return
    }
    if (!confirm(`Delete "${selectedDraft.name}"? This cannot be undone.`)) {
      return
    }
    startTransition(async () => {
      const result = await deleteDraft(selectedDraft.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Deleted.")
      const next = drafts.find((d) => d.id !== selectedDraft.id)
      if (next) selectDraft(next.id)
      else router.push("/production")
      router.refresh()
    })
  }

  function onPublish() {
    if (!selectedDraft) return
    const currentlyPublished = drafts.find(
      (d) => d.is_published && d.id !== selectedDraft.id,
    )
    const msg = currentlyPublished
      ? `Publish "${selectedDraft.name}"? This will unpublish "${currentlyPublished.name}".`
      : `Publish "${selectedDraft.name}"? It becomes visible to the whole team.`
    if (!confirm(msg)) return
    const targetId = selectedDraft.id
    startTransition(async () => {
      const result = await publishDraft(targetId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Published.")
      selectDraft(targetId)
      router.refresh()
    })
  }

  function onUnpublish() {
    if (!selectedDraft) return
    if (!confirm(`Unpublish "${selectedDraft.name}"?`)) return
    const targetId = selectedDraft.id
    startTransition(async () => {
      const result = await unpublishDraft(targetId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Unpublished.")
      selectDraft(targetId)
      router.refresh()
    })
  }

  if (drafts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start a draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No drafts yet. Give your first one a name — something like
            &quot;Working draft v1&quot;.
          </p>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Draft name"
              className="max-w-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate()
              }}
            />
            <Button onClick={onCreate} disabled={pending || !newName.trim()}>
              Create draft
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Drafts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid gap-1.5 min-w-[240px]">
              <label className="text-xs font-medium text-muted-foreground">
                Current draft
              </label>
              <Select
                value={selectedDraft?.id}
                onValueChange={(v) => v && selectDraft(v)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) => {
                      const d = drafts.find((x) => x.id === v)
                      if (!d) return ""
                      return d.is_published ? `${d.name} · Published` : d.name
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {drafts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.is_published ? "· Published" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDraft?.is_published && (
              <Badge className="mt-5" variant="default">
                Published
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-2 mt-5">
              {renaming ? (
                <>
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    className="w-64"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onRenameSubmit()
                      if (e.key === "Escape") setRenaming(false)
                    }}
                  />
                  <Button size="sm" onClick={onRenameSubmit} disabled={pending}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRenaming(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRenameValue(selectedDraft?.name ?? "")
                      setRenaming(true)
                    }}
                    disabled={!selectedDraft}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSettingsOpen(true)}
                    disabled={!selectedDraft || selectedDraft.is_published}
                    title={
                      selectedDraft?.is_published
                        ? "Duplicate to edit"
                        : undefined
                    }
                  >
                    Settings
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onDuplicate}
                    disabled={!selectedDraft || pending}
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onDelete}
                    disabled={!selectedDraft || pending || selectedDraft?.is_published}
                    title={
                      selectedDraft?.is_published ? "Unpublish first" : undefined
                    }
                  >
                    Delete
                  </Button>
                  {selectedDraft?.is_published ? (
                    <Button
                      size="sm"
                      onClick={onUnpublish}
                      disabled={pending}
                      variant="secondary"
                    >
                      Unpublish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={onPublish}
                      disabled={!selectedDraft || pending}
                    >
                      Publish
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New draft name"
              className="max-w-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate()
              }}
            />
            <Button
              variant="secondary"
              onClick={onCreate}
              disabled={pending || !newName.trim()}
            >
              New draft
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedDraft && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Schedule</h2>
            <p className="text-xs text-muted-foreground">
              {selectedDraft.is_published
                ? "Published drafts are read-only. Duplicate to edit."
                : "Click and drag on any day to create a show block."}
            </p>
          </div>
          <ScheduleCanvas
            draftId={selectedDraft.id}
            isPublished={selectedDraft.is_published}
            viewerRole="admin"
            blocks={blocks}
            venues={selectedDraft.venues}
            venueColors={selectedDraft.venue_colors}
            windowStartTime={selectedDraft.window_start_time}
            windowEndTime={selectedDraft.window_end_time}
            eligibleSubmissions={eligibleSubmissions}
            tagsByBlock={tagsByBlock}
            commentsByBlock={commentsByBlock}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {selectedDraft && (
        <DraftSettingsDialog
          draftId={selectedDraft.id}
          venues={selectedDraft.venues}
          venueColors={selectedDraft.venue_colors}
          windowStartTime={selectedDraft.window_start_time}
          windowEndTime={selectedDraft.window_end_time}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
