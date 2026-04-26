"use client"

import { VideoLinkEditor } from "@/components/video-link-editor"
import { looksLikeUrl, toEmbedUrl } from "@/lib/video"

export type ActSubmission = {
  id: string
  type: string
  name: string | null
  email: string | null
  data: Record<string, unknown> | null
  supplemental_video_url: string | null
}

export type Verdict = "yes" | "no" | "maybe"

export type ActJudgment = {
  user_id: string
  verdict: Verdict | null
  notes: string | null
  author_name: string | null
  author_email: string | null
}

export function pickStr(
  data: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!data) return null
  const v = data[key]
  if (v == null) return null
  const s = String(v).trim()
  return s.length === 0 ? null : s
}

const BLURB_PATTERNS: RegExp[] = [
  /^bio$/i,
  /^blurb$/i,
  /^about$/i,
  /^description$/i,
  /short.*(bio|description|blurb)/i,
  /^promo(tional)?\s*(text|copy|description)?$/i,
  /elevator/i,
  /tagline/i,
  /one.?liner/i,
]

export function pickBlurb(sub: ActSubmission): string | null {
  const data = sub.data ?? {}
  for (const re of BLURB_PATTERNS) {
    for (const [k, v] of Object.entries(data)) {
      if (!re.test(k)) continue
      if (v == null) continue
      const s = String(v).trim()
      if (s.length > 0) return s
    }
  }
  // Fallback: first multi-sentence non-URL text field that isn't a header.
  for (const [k, v] of Object.entries(data)) {
    if (
      /name|email|contact|location|city|region|state|country|phone|date|time|website|url|link|instagram|tiktok|youtube|vimeo|drive|file/i.test(
        k,
      )
    ) {
      continue
    }
    if (v == null) continue
    const s = String(v).trim()
    if (s.length < 30) continue
    if (/^https?:\/\//i.test(s)) continue
    return s
  }
  return null
}

export function pickFirstEmbedUrl(sub: ActSubmission): {
  src: string
  rawUrl: string
  fieldKey: string
} | null {
  if (sub.supplemental_video_url) {
    const embed = toEmbedUrl(sub.supplemental_video_url)
    if (embed) {
      return {
        src: embed,
        rawUrl: sub.supplemental_video_url,
        fieldKey: "Performance video (added)",
      }
    }
  }
  const data = sub.data ?? {}
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue
    const s = String(v).trim()
    if (!/^https?:\/\//i.test(s)) continue
    const embed = toEmbedUrl(s)
    if (embed) return { src: embed, rawUrl: s, fieldKey: k }
  }
  return null
}

const HIDDEN_KEYS = new Set([
  "Submitted On",
  "Submission Date",
  "Submission ID",
  "Form ID",
  "Source",
])

export function ActMarketingPanel({ submission }: { submission: ActSubmission }) {
  const data = submission.data ?? {}
  const entries = Object.entries(data).filter(([k, v]) => {
    if (HIDDEN_KEYS.has(k)) return false
    if (v == null) return false
    const s = String(v).trim()
    return s.length > 0
  })

  const supplemental = submission.supplemental_video_url
  const supplementalEmbed = supplemental ? toEmbedUrl(supplemental) : null

  // Auto-detected video (used to know whether the editor's "Override" or
  // "Add" wording is appropriate).
  const hasAutoDetectedVideo = !supplemental && pickFirstEmbedUrl(submission) !== null

  if (entries.length === 0 && !supplemental) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          No marketing material on file for this act.
        </p>
        <VideoLinkEditor
          submissionId={submission.id}
          supplementalUrl={supplemental}
          hasAutoDetectedVideo={hasAutoDetectedVideo}
        />
      </div>
    )
  }

  return (
    <dl className="grid gap-2 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3">
        <dt className="text-muted-foreground font-medium">
          Performance video{supplemental ? " (added)" : ""}
        </dt>
        <dd className="min-w-0 space-y-1.5">
          {supplemental && (
            <a
              href={supplemental}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-primary hover:underline underline-offset-4 break-all"
            >
              {supplemental}
            </a>
          )}
          {supplementalEmbed && (
            <div className="aspect-video overflow-hidden rounded-md border bg-muted max-w-md">
              <iframe
                src={supplementalEmbed}
                title="Performance video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="size-full"
              />
            </div>
          )}
          <VideoLinkEditor
            submissionId={submission.id}
            supplementalUrl={supplemental}
            hasAutoDetectedVideo={hasAutoDetectedVideo}
          />
        </dd>
      </div>
      {entries.map(([key, value]) => {
        const str = String(value).trim()
        const isUrl = looksLikeUrl(str)
        const embed = isUrl ? toEmbedUrl(str) : null
        return (
          <div
            key={key}
            className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3"
          >
            <dt className="text-muted-foreground font-medium">{key}</dt>
            <dd className="min-w-0 space-y-1.5">
              {isUrl ? (
                <a
                  href={str}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-primary hover:underline underline-offset-4 break-all"
                >
                  {str}
                </a>
              ) : (
                <p className="whitespace-pre-wrap break-words">{str}</p>
              )}
              {embed && (
                <div className="aspect-video overflow-hidden rounded-md border bg-muted max-w-md">
                  <iframe
                    src={embed}
                    title={key}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="size-full"
                  />
                </div>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
